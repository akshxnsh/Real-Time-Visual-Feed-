/**
 * RTVLF Backend API Server
 * Express server with SSE streaming for real-time feed card generation.
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// IMPORTANT: Load dotenv FIRST before any code that uses env variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../../.env");
console.log("📁 Loading .env from:", envPath);
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.warn("⚠️  Could not load .env file:", result.error.message);
} else {
  console.log("✅ .env file loaded successfully");
}

if (!process.env.GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY not found in environment!");
  process.exit(1);
} else {
  console.log("✅ GROQ_API_KEY is set");
}

// Check for video generation environment variables
const hasVideoConfig =
  process.env.IO_NET_ENDPOINT_US;
if (hasVideoConfig) {
  console.log("✅ Video generation configured");
} else {
  console.warn(
    "⚠️  Video generation not configured. Video endpoints disabled."
  );
}

// Use dynamic import to load modules AFTER env vars are loaded
const { generateCard } = await import("../../services/llm.js");
const { fetchBreakingNews, searchNews } = await import("../../services/news.js");
const videoRouter = await import("./routes/video.js");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/**
 * Extract trending topics from breaking news
 * Analyzes news titles to identify frequently mentioned topics
 * @returns {Promise<Array>} - Array of trending topics with metadata
 */
async function extractTrendingTopics() {
  try {
    const { fetchBreakingNews } = await import("../../services/news.js");
    
    // Fetch breaking news from multiple categories
    const categories = ["breaking", "business", "science", "sports", "entertainment"];
    const allArticles = [];
    
    for (const category of categories) {
      try {
        const articles = await fetchBreakingNews(category, "us");
        allArticles.push(...articles);
      } catch (e) {
        console.warn(`Failed to fetch ${category} news:`, e.message);
      }
    }

    if (allArticles.length === 0) {
      console.warn("No articles found for trending extraction");
      return [];
    }

    const { extractTrendsWithGroq } = await import("../../services/llm.js");
    const trending = await extractTrendsWithGroq(allArticles);
    
    console.log(`✅ Extracted ${trending.length} trending topics using Groq`);
    return trending;
  } catch (error) {
    console.error("Failed to extract trending topics:", error.message);
    return [];
  }
}

// Cache trending topics for 5 minutes to avoid excessive API calls
let trendingCache = [];
let trendingCacheTime = 0;
const TRENDING_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

app.get("/api/trending", async (req, res) => {
  try {
    // Return cached trends if still valid
    const now = Date.now();
    if (trendingCache.length > 0 && (now - trendingCacheTime) < TRENDING_CACHE_TTL) {
      return res.json({ topics: trendingCache, cached: true });
    }

    // Fetch fresh trending topics
    const trends = await extractTrendingTopics();
    
    if (trends.length === 0) {
      return res.json({ topics: [], error: "Could not extract trends from news" });
    }

    // Update cache
    trendingCache = trends;
    trendingCacheTime = now;

    res.json({ topics: trends, cached: false });
  } catch (error) {
    console.error("Trending endpoint error:", error);
    res.status(500).json({ error: "Failed to fetch trending topics" });
  }
});

/**
 * GET /api/news/breaking
 * Fetch breaking news articles
 * Query params: category, country
 */
app.get("/api/news/breaking", async (req, res) => {
  try {
    const { category = "breaking", country = "us" } = req.query;
    const articles = await fetchBreakingNews(category, country);
    res.json({ articles, count: articles.length });
  } catch (error) {
    console.error("Breaking news fetch error:", error);
    res.status(500).json({ error: "Failed to fetch breaking news" });
  }
});

/**
 * GET /api/news/search
 * Search for news articles by topic
 * Query params: q (search query), country
 */
app.get("/api/news/search", async (req, res) => {
  try {
    const { q, country = "us" } = req.query;
    
    if (!q || !q.trim()) {
      return res.status(400).json({ error: "q (search query) is required" });
    }

    const articles = await searchNews(q, country);
    res.json({ articles, count: articles.length, query: q });
  } catch (error) {
    console.error("News search error:", error);
    res.status(500).json({ error: "Failed to search news" });
  }
});

// Mount video generation routes (if io.net is configured)
if (hasVideoConfig) {
  app.use("/api/video", videoRouter.default);
}

/**
 * Augment the topic string passed into the LLM user message with personalization
 * and trending hints (llm.js is unchanged — context rides in the topic field).
 */
function augmentTopicForGeneration(topic, { preferences, isTrending, sentimentProfile }) {
  const base = topic.trim();
  const extras = [];

  const liked = preferences?.likedTopics;
  if (Array.isArray(liked) && liked.length > 0) {
    const labels = liked
      .map((item) => {
        if (item && typeof item === "object" && item.topic) return item.topic;
        return null;
      })
      .filter(Boolean);
    const unique = [...new Set(labels)];
    if (unique.length > 0) {
      extras.push(
        `The user has previously enjoyed content about: ${unique.join(", ")}. Lean towards similar angles, depth, and style in this card.`
      );
    }
  }

  // Add sentiment profile personalization if available
  if (sentimentProfile && sentimentProfile.profileConfidence >= 0.3) {
    const topTopics = Object.entries(sentimentProfile.topics)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([t]) => t);
    
    if (topTopics.length > 0) {
      extras.push(
        `User profile suggests interest in: ${topTopics.join(", ")}.`
      );
    }
  }

  if (isTrending === true) {
    extras.push(
      "This is a trending topic right now. Make the content feel timely and current. Reference that this topic is being widely discussed. Keep the energy high."
    );
  }

  if (extras.length === 0) return base;
  return `${base}\n\n---\n${extras.join("\n\n")}`;
}

/**
 * Feed card system prompts (LEARN vs ENTERTAIN) live in services/llm.js → buildSystemPrompt.
 * They are applied inside generateCard(); this route only forwards topic, mode, history, and personalization.
 */

/**
 * POST /api/feed/generate
 * Generate a single feed card and stream it back via SSE.
 *
 * Request body:
 * {
 *   topic: string,
 *   mode: "learn" | "entertain",
 *   history: string[] (optional),
 *   preferences?: { likedTopics?: { topic: string, mode: string, cardText: string }[] },
 *   isTrending?: boolean,
 *   sentimentProfile?: { topics, style, depth, pacing, mode, profileConfidence, ... }
 * }
 */
app.post("/api/feed/generate", async (req, res) => {
  const {
    topic,
    mode,
    history = [],
    preferences,
    isTrending,
    sentimentProfile,
  } = req.body;

  // Validate input
  if (!topic || !topic.trim()) {
    return res.status(400).json({ error: "topic is required" });
  }

  if (!["learn", "entertain"].includes(mode)) {
    return res.status(400).json({ error: 'mode must be "learn" or "entertain"' });
  }

  const effectiveTopic = augmentTopicForGeneration(topic, {
    preferences,
    isTrending,
    sentimentProfile,
  });

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    // Stream the generated card
    for await (const chunk of generateCard(effectiveTopic, mode, history)) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    // Send completion signal
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Feed generation error:", error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 RTVLF API running on http://localhost:${PORT}`);
  console.log(`📡 Feed endpoint: POST http://localhost:${PORT}/api/feed/generate`);
  console.log(`📈 Trending: GET http://localhost:${PORT}/api/trending`);
});
