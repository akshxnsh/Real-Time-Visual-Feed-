/**
 * RTVF Backend API Server
 * Express server with SSE streaming for real-time feed card generation.
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import geoip from "geoip-lite";

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

if (!process.env.GROQ_TRENDS_API_KEY && !process.env.GROQ_API_KEY) {
  console.error("❌ No Groq API key found! Set GROQ_TRENDS_API_KEY (or GROQ_API_KEY as fallback).");
  process.exit(1);
} else {
  console.log("✅ Groq key available for trends generation");
}

// Check for video generation environment variables
// Dynamic GPU routing is managed by the MCP agent (IO_NET_API_KEY).
// Static endpoint env vars are optional fallbacks for cold starts.
const hasVideoConfig =
  process.env.IO_NET_API_KEY || process.env.IO_NET_ENDPOINT_US || process.env.IO_NET_ENDPOINT_IN;
if (hasVideoConfig) {
  console.log("✅ Video generation configured (MCP agent or static endpoint)");
} else {
  console.log("ℹ️  No io.net endpoint set — video routes still mounted. Set IO_NET_ENDPOINT_US or IO_NET_ENDPOINT_IN to point at a local/remote RTVF server.");
}

// Use dynamic import to load modules AFTER env vars are loaded
const { generateTrendingTopics } = await import("../../services/llm.js");
const { fetchBreakingNews, searchNews } = await import("../../services/news.js");
const { buildVideoPromptPreview } = await import("../../services/video.js");
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

// Cache trending topics per country for 5 minutes to avoid excessive API calls
// Key: countryName (lowercase), Value: { topics, time }
const trendingCache = {};
const TRENDING_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

app.get("/api/trending", async (req, res) => {
  try {
    // Sanitize country param — letters, spaces, hyphens, apostrophes only
    const rawCountry = typeof req.query.country === "string" ? req.query.country : "";
    const country = rawCountry.replace(/[^a-zA-Z\s\-']/g, "").trim().slice(0, 60) || "the world";
    const cacheKey = country.toLowerCase();

    // Return cached trends for this country if still valid
    const now = Date.now();
    const cached = trendingCache[cacheKey];
    if (cached && now - cached.time < TRENDING_CACHE_TTL) {
      return res.json({ topics: cached.topics, cached: true, country });
    }

    // Generate fresh trending topics directly via Groq (no external news API)
    // Request 20 so the client has a full rotation pool
    const trends = await generateTrendingTopics(country, 20);

    if (trends.length === 0) {
      return res.json({ topics: [], error: "Could not generate trending topics" });
    }

    // Update per-country cache
    trendingCache[cacheKey] = { topics: trends, time: now };

    res.json({ topics: trends, cached: false, country });
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

// Mount video generation routes — always, so local RTVF server testing works
// without io.net credentials. Route will return 500 gracefully if no endpoint is set.
app.use("/api/video", videoRouter.default);

/**
 * POST /api/feed/generate
 * Returns the LTX-Video prompt that would be sent to the io.net Docker container.
 * For "news" mode: fetches a real regional news article from GNews, then builds
 * a news-enriched video prompt from it — regionally targeted via geoip.
 *
 * Request body: { topic: string, mode: "learn" | "entertain" | "news", variant?: number }
 */
app.post("/api/feed/generate", async (req, res) => {
  const { topic, mode } = req.body;
  // variant ensures each card for the same topic generates a unique prompt/caption
  const variant = Math.max(0, Math.min(99, Math.floor(Number(req.body.variant) || 0)));

  if (!topic || !topic.trim()) {
    return res.status(400).json({ error: "topic is required" });
  }

  if (!['learn', 'entertain', 'news'].includes(mode)) {
    return res.status(400).json({ error: 'mode must be "learn", "entertain" or "news"' });
  }

  // Detect user region from IP — drives both regional context and news country targeting
  const rawIp = req.headers['x-forwarded-for'];
  const ip =
    (typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : null) ||
    req.headers['cf-connecting-ip'] ||
    req.ip;
  const geo = geoip.lookup(ip);
  const countryCode = geo?.country || 'US';

  // For news mode: fetch one regional article to anchor the video prompt
  // topic is the news category chosen by the user (e.g. 'breaking', 'business')
  let newsArticle = null;
  if (mode === 'news') {
    try {
      // GNews country param is lowercase 2-letter code
      const countryParam = countryCode.toLowerCase();
      const articles = await fetchBreakingNews(topic, countryParam);
      if (articles.length > 0) {
        // Pick a random article from the batch so each card feels fresh
        const idx = Math.floor(Math.random() * Math.min(articles.length, 5));
        newsArticle = articles[idx];
      }
    } catch (err) {
      console.warn('⚠️  News fetch for prompt failed, building topic-only prompt:', err.message);
    }
  }

  const promptTopic = newsArticle?.title || topic;
  const { prompt, caption } = buildVideoPromptPreview(promptTopic, mode, countryCode, newsArticle, variant);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.write(`data: ${JSON.stringify({ chunk: prompt })}\n\n`);
  res.write(`data: ${JSON.stringify({ done: true, caption })}\n\n`);
  res.end();
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 RTVF API running on http://localhost:${PORT}`);
  console.log(`📡 Feed endpoint: POST http://localhost:${PORT}/api/feed/generate`);
  console.log(`📈 Trending: GET http://localhost:${PORT}/api/trending`);

  // Start MCP GPU fleet manager in the background
  try {
    const { start: startMcpAgent } = await import('../../services/agents/mcpAgent.js');
    await startMcpAgent();
  } catch (err) {
    console.error('❌ MCP agent failed to start:', err.message);
  }
});
