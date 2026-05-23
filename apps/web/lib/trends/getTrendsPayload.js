import { unstable_cache } from "next/cache";
import { generateTrendingTopics } from "../../../../services/llm.js";

async function loadTrendsUncached(countryName = "the world") {
  try {
    const topics = await generateTrendingTopics(countryName);
    if (topics.length > 0) {
      // Return the raw Groq format: {id, topic, emoji, category, exploring}
      return { trends: topics, source: "groq" };
    }
  } catch (err) {
    console.error("[getTrendsPayload] Groq call failed:", err?.message);
  }

  // Hard fallback — only if Groq is completely unreachable
  const { getMockTrends } = await import("./mockTrends.js");
  return { trends: getMockTrends(), source: "mock" };
}

/**
 * Cached 15 minutes — shared by Route Handler + Server Components.
 * Country defaults to "the world" for SSR (client re-fetches with real country).
 */
export const getTrendsPayload = unstable_cache(
  async (countryName = "the world") => loadTrendsUncached(countryName),
  ["groq-trends-v1"],
  { revalidate: 900 }
);
