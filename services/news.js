// In-memory cache for news API responses
const _newsCache = {};
const NEWS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(prefix, ...args) {
  return `${prefix}:${args.join(":")}`;
}

function getCached(key) {
  const entry = _newsCache[key];
  if (entry && (Date.now() - entry.time < NEWS_CACHE_TTL)) {
    return entry.value;
  }
  return null;
}

function setCached(key, value) {
  _newsCache[key] = { value, time: Date.now() };
}
/**
 * News Fetching Service
 * This is the ONLY place in the codebase where we interact with NewsAPI.
 * All NewsAPI calls route through here. Never call NewsAPI from frontend.
 * 
 * In Phase 4, we swap NewsAPI for another provider by changing only this file.
 * Nothing else in the app needs to change.
 */

const NEWS_API_KEY = process.env.GNEWS_API_KEY;
const NEWS_API_BASE = "https://gnews.io/api/v4";

/**
 * Fetch breaking news headlines from NewsAPI
 * Prioritizes breaking news with filters for relevance and recency
 * 
 * @param {string} category - News category (e.g., "breaking", "business", "tech", "politics")
 * @param {string} country - Country code (e.g., "us", "gb", "in")
 * @returns {Promise<Array>} - Array of news articles with title, description, link, image
 * @throws {Error} - If API call fails
 */
export async function fetchBreakingNews(category = "breaking", country = "us") {
    const cacheKey = getCacheKey("breaking", category, country);
    const cached = getCached(cacheKey);
    if (cached) {
      return cached;
    }
  if (!NEWS_API_KEY) {
    console.warn("⚠️  NEWSDATA_API_KEY not configured");
    return [];
  }

  try {
    // Construct query with category preference

    // GNews does not support category filtering in free tier, so we use topic as a query
    const query = category !== "breaking" ? category : "";
    const url = `${NEWS_API_BASE}/top-headlines?token=${NEWS_API_KEY}&lang=en&country=${country}&q=${encodeURIComponent(query)}&max=10`;

    console.log(`📰 Fetching news: category=${category}, country=${country}`);

    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`GNews API error ${response.status}: ${errText}`);
      throw new Error(`NewsAPI error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.articles || data.articles.length === 0) {
      console.log("ℹ️  No news results found");
      return [];
    }

    // Transform API response to our format
    const articles = data.articles.map((article) => ({
      id: article.url || `${Date.now()}-${Math.random()}`,
      title: article.title,
      description: article.description || article.title,
      source: article.source?.name || "Unknown",
      url: article.url,
      image: article.image,
      timestamp: article.publishedAt || new Date().toISOString(),
      category: category,
    }));

    console.log(`✅ Fetched ${articles.length} articles`);
    setCached(cacheKey, articles);
    return articles;
  } catch (error) {
    console.error("❌ News fetch failed:", error);
    return [];
  }
}

/**
 * Fetch regional breaking news for video context injection
 * Used to enrich video prompts with region-specific trending topics
 * 
 * @param {string} country - Country code (e.g., "us", "in", "gb")
 * @param {number} limit - Number of articles to fetch (default 5)
 * @returns {Promise<Array>} - Array of trending articles for the region
 */
export async function fetchRegionalNews(country = "us", limit = 5) {
    const cacheKey = getCacheKey("regional", country, limit);
    const cached = getCached(cacheKey);
    if (cached) {
      return cached;
    }
  if (!NEWS_API_KEY) {
    return [];
  }

  try {
    const url = `${NEWS_API_BASE}/top-headlines?token=${NEWS_API_KEY}&lang=en&country=${country}&max=${limit}`;
    
    console.log(`🌍 Fetching regional news for: ${country}`);

    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!data.articles || data.articles.length === 0) {
      return [];
    }

    // Extract trending keywords from regional news titles
    const keywords = [];
    data.articles.slice(0, 3).forEach((article) => {
      const title = article.title || "";
      const words = title
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3 && !/[^a-z]/i.test(word));
      keywords.push(...words);
    });

    const result = keywords.slice(0, 5);
    setCached(cacheKey, result);
    return result;

  } catch (error) {
    console.error("Regional news fetch failed:", error);
    return [];
  }
}

/**
 * Fetch news articles for a specific topic (search)
 * Useful for topic-based news cards
 * 
 * @param {string} topic - Search query/topic
 * @param {string} country - Country code
 * @returns {Promise<Array>} - Array of matching articles
 */
export async function searchNews(topic, country = "us") {
    const cacheKey = getCacheKey("search", topic, country);
    const cached = getCached(cacheKey);
    if (cached) {
      return cached;
    }
  if (!NEWS_API_KEY) {
    console.warn("⚠️  NEWSDATA_API_KEY not configured");
    return [];
  }

  try {
    const url = `${NEWS_API_BASE}/search?token=${NEWS_API_KEY}&lang=en&q=${encodeURIComponent(topic)}&country=${country}&max=10`;

    console.log(`🔍 Searching news for: "${topic}"`);

    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`NewsAPI search error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.articles || data.articles.length === 0) {
      return [];
    }

    const articles = data.articles.map((article) => ({
      id: article.url || `${Date.now()}-${Math.random()}`,
      title: article.title,
      description: article.description || article.title,
      source: article.source?.name || "Unknown",
      url: article.url,
      image: article.image,
      timestamp: article.publishedAt || new Date().toISOString(),
      category: "search",
    }));

    setCached(cacheKey, articles);
    return articles;
  } catch (error) {
    console.error("❌ News search failed:", error);
    return [];
  }
}

/**
 * Get trending/most viewed news topics
 * Useful for suggesting what's trending
 * 
 * @returns {Promise<Array>} - Array of trending topics
 */
export async function getTrendingNewsTopics() {
    const cacheKey = getCacheKey("trending");
    const cached = getCached(cacheKey);
    if (cached) {
      return cached;
    }
  if (!NEWS_API_KEY) {
    return [];
  }

  try {
    // Fetch top headlines to extract trending topics
    const url = `${NEWS_API_BASE}/top-headlines?token=${NEWS_API_KEY}&lang=en&max=5`;

    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    
    if (!data.articles) {
      return [];
    }

    // Extract topics from article titles
    const topics = data.articles
      .slice(0, 5)
      .map((article) => ({
        topic: article.title.split(/[\s:]+/)[0], // First word as quick topic
        count: 1,
      }));

    setCached(cacheKey, topics);
    return topics;
  } catch (error) {
    console.error("❌ Trending topics fetch failed:", error);
    return [];
  }
}
