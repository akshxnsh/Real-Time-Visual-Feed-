/**
 * LLM Abstraction Layer
 * This is the ONLY place in the codebase where we interact with the LLM API.
 * In Phase 4, we swap Groq for io.net hosted Llama by changing only this file.
 * Nothing else in the app needs to change.
 */

import Groq from "groq-sdk";

// Trends client: uses dedicated key and falls back to GROQ_API_KEY.
const trendsClient = new Groq({
  apiKey: process.env.GROQ_TRENDS_API_KEY || process.env.GROQ_API_KEY,
});

console.log("✅ Groq trends client initialized:", !!trendsClient);

/**
 * Generate trending topics directly via Groq — no external news API needed.
 * Groq picks diverse, interesting topics relevant to the given country.
 * Each call produces fresh variety thanks to temperature 0.9.
 *
 * @param {string} [countryName="the world"] - Country name to tailor trends for (e.g. "India", "United Kingdom")
 * @param {number} [count=20] - How many topics to generate (default 20 for rotation pool)
 * @returns {Promise<Array<{id,topic,emoji,category,exploring}>>}
 */
export async function generateTrendingTopics(countryName = "the world", count = 20) {
  // Sanitize: strip anything that isn't letters, spaces, hyphens, or apostrophes
  const safeCountry = String(countryName).replace(/[^a-zA-Z\s\-']/g, "").trim().slice(0, 60) || "the world";
  const safeCount = Math.min(Math.max(Math.floor(count), 6), 30); // clamp 6–30

  // Inject today's date so the model never produces outdated events (e.g. past seasons/years)
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const systemPrompt = `You are a trend curator for a real-time visual feed app. Today's date is ${today}. Generate exactly ${safeCount} diverse, interesting trending topics that people in ${safeCountry} would want to explore right now.

Return ONLY a valid JSON object with a single key "trends" containing an array of exactly ${safeCount} objects. No conversational text, no markdown.
Each object must have exactly these fields:
{
  "topic": "Specific, vivid topic name — be precise (e.g. 'Quantum Supremacy Race', not just 'Quantum')",
  "emoji": "<single most fitting emoji>",
  "category": "<one of: breaking, business, science, sports, entertainment, health, tech, world>",
  "exploring": <integer between 20000 and 95000>
}

Rules:
- Today is ${today} — all topics must be relevant to this specific point in time. Never reference past years' events (e.g. do not say "IPL 2024" if the current year is 2026).
- Tailor topics to what is culturally and currently relevant in ${safeCountry}
- Cover ALL 8 categories across the ${safeCount} topics — good variety
- Mix locally specific topics with globally relevant ones
- Vary the specificity: mix broad (Space Exploration) and specific (James Webb Exoplanet Find)
- exploring values must be realistic and varied (not all the same number)`;

  const userPrompt = `Today is ${today}. Generate ${safeCount} trending topics for people in ${safeCountry} right now. Return only the JSON object.`;

  try {
    const response = await trendsClient.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.9,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    const trendsList = Array.isArray(parsed)
      ? parsed
      : parsed.trends || parsed.topics || Object.values(parsed)[0] || [];

    return trendsList.slice(0, safeCount).map((item, idx) => ({
      id: idx + 1,
      topic: item.topic || "Unknown Topic",
      emoji: item.emoji || "🔥",
      category: item.category || "breaking",
      exploring: item.exploring || Math.floor(Math.random() * 50000 + 20000),
    }));
  } catch (error) {
    console.error("Groq trending topic generation failed:", error);
    return [];
  }
}
