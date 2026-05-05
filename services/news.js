/**
 * News Fetching Service
 * This is the ONLY place in the codebase where we interact with NewsAPI.
 * All NewsAPI calls route through here. Never call NewsAPI from frontend.
 * 
 * In Phase 4, we swap NewsAPI for another provider by changing only this file.
 * Nothing else in the app needs to change.
 */

const NEWS_API_KEY = process.env.NEWSDATA_API_KEY;
const NEWS_API_BASE = "https://newsdata.io/api/1";

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
  if (!NEWS_API_KEY) {
    console.warn("⚠️  NEWSDATA_API_KEY not configured");
    return [];
  }

  try {
    // Construct query with category preference
    const categoryQuery = category !== "breaking" ? `&category=${category}` : "";

    const url = `${NEWS_API_BASE}/latest?apikey=${NEWS_API_KEY}&country=${country}${categoryQuery}&sortby=published_date&limit=10`;

    console.log(`📰 Fetching news: category=${category}, country=${country}`);

    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`NewsAPI error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      console.log("ℹ️  No news results found");
      return [];
    }

    // Transform API response to our format
    const articles = data.results.map((article) => ({
      id: article.article_id || `${Date.now()}-${Math.random()}`,
      title: article.title,
      description: article.description || article.title,
      source: article.source_id || "Unknown",
      url: article.link,
      image: article.image_url,
      timestamp: article.pubDate || new Date().toISOString(),
      category: article.category?.[0] || category,
    }));

    console.log(`✅ Fetched ${articles.length} articles`);
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
  if (!NEWS_API_KEY) {
    return [];
  }

  try {
    const url = `${NEWS_API_BASE}/latest?apikey=${NEWS_API_KEY}&country=${country}&sortby=published_date&limit=${limit}`;
    
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
    if (!data.results || data.results.length === 0) {
      return [];
    }

    // Extract trending keywords from regional news titles
    const keywords = [];
    data.results.slice(0, 3).forEach((article) => {
      const title = article.title || "";
      const words = title
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3 && !/[^a-z]/i.test(word));
      keywords.push(...words);
    });

    return keywords.slice(0, 5);

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
  if (!NEWS_API_KEY) {
    console.warn("⚠️  NEWSDATA_API_KEY not configured");
    return [];
  }

  try {
    const url = `${NEWS_API_BASE}/news?apikey=${NEWS_API_KEY}&q=${encodeURIComponent(
      topic
    )}&country=${country}&sortby=published_date&limit=10`;

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

    if (!data.results || data.results.length === 0) {
      return [];
    }

    const articles = data.results.map((article) => ({
      id: article.article_id || `${Date.now()}-${Math.random()}`,
      title: article.title,
      description: article.description || article.title,
      source: article.source_id || "Unknown",
      url: article.link,
      image: article.image_url,
      timestamp: article.pubDate || new Date().toISOString(),
      category: "search",
    }));

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
  if (!NEWS_API_KEY) {
    return [];
  }

  try {
    // Fetch breaking news which represents trending
    const url = `${NEWS_API_BASE}/latest?apikey=${NEWS_API_KEY}&sortby=published_date&limit=5`;

    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    
    if (!data.results) {
      return [];
    }

    // Extract topics from article titles
    const topics = data.results
      .slice(0, 5)
      .map((article) => ({
        topic: article.title.split(/[\s:]+/)[0], // First word as quick topic
        count: 1,
      }));

    return topics;
  } catch (error) {
    console.error("❌ Trending topics fetch failed:", error);
    return [];
  }
}
