/**
 * LLM Abstraction Layer
 * This is the ONLY place in the codebase where we interact with the LLM API.
 * In Phase 4, we swap Groq for io.net hosted Llama by changing only this file.
 * Nothing else in the app needs to change.
 */

import Groq from "groq-sdk";

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Separate client for trends generation — uses its own API key so it doesn't
// compete with card generation quota.
const trendsClient = new Groq({
  apiKey: process.env.GROQ_TRENDS_API_KEY || process.env.GROQ_API_KEY,
});

console.log("✅ Groq client initialized:", !!client);
console.log("✅ Groq trends client initialized:", !!trendsClient);

/**
 * Generate a single feed card using Groq's llama-3.3-70b-versatile model.
 * Returns an async generator that yields chunks of the response via SSE.
 *
 * @param {string} topic - The topic for the card (e.g., "quantum computing")
 * @param {string} mode - "learn" or "entertain" — controls tone of response
 * @param {string[]} history - Array of previous card summaries (prevents repetition)
 * @returns {AsyncGenerator<string>} - Yields response chunks for streaming to client
 */
export async function* generateCard(topic, mode, history) {
  // Build the system prompt with mode-specific instructions
  const systemPrompt = buildSystemPrompt(mode, history);

  // Build user prompt with topic and constraints
  const userPrompt = `Topic: ${topic}\n\nGenerate a single feed card on this topic in ${mode} mode.`;

  try {
    // Stream the response from Groq using chat.completions.create
    const stream = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: true,
      max_tokens: 200,
      temperature: 0.8,
    });

    // Yield each chunk as it arrives
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || "";
      if (token) {
        yield token;
      }
    }
  } catch (error) {
    console.error("LLM generation error:", error);
    throw new Error(`Failed to generate card: ${error.message}`);
  }
}

/**
 * Build a system prompt that enforces constraints and mode-specific behavior.
 * @param {string} mode - "learn" or "entertain"
 * @param {string[]} history - Previous card summaries for context
 * @returns {string} - Complete system prompt
 */
function buildSystemPrompt(mode, history) {
  const historyText =
    history && history.length > 0
      ? history.map((card, i) => `${i + 1}. ${card}`).join("\n")
      : "(none yet for this topic session)";

  if (mode === "learn") {
    return `You are an expert educator creating a single scroll card for a visual learning feed.

Rules:
- Start with a clear, direct statement of fact or concept
- Write in second person ("you")
- 70-90 words maximum
- Structure: [Core concept] → [Why it works this way] → [One mind-expanding implication]
- Use analogies to make complex ideas concrete
- End with a question that makes the reader think deeper about the concept
- Tone: intelligent, warm, clear — like a brilliant professor who respects your time
- Never use filler phrases like "did you know" or "fascinating"
- The last sentence must make the reader want to learn the next concept
- Do NOT use markdown, asterisks, or formatting — plain prose only
- Do NOT explain what you're doing — deliver only the card text

Topic history (do not repeat these concepts): ${historyText}`;
  }

  return `You are a viral content creator for a scroll feed. Your job is to make people stop scrolling.

Rules:
- Open with the single most shocking, counterintuitive, or bizarre fact about this topic — no warmup
- Write in second person ("you")
- 60-80 words maximum
- Structure: [Mind-blowing hook] → [The insane detail that makes it real] → [Twist or consequence that changes how they see the world]
- Tone: urgent, punchy, slightly unhinged with excitement — like a friend who just found out something wild
- Use em-dashes, short punchy sentences, and sentence fragments for rhythm
- Never be boring. If a sentence doesn't earn its place, cut it.
- End with a cliffhanger that makes scrolling feel mandatory
- Do NOT use markdown, asterisks, or formatting — plain prose only
- Do NOT explain what you're doing — deliver only the card text

Topic history (do not repeat these concepts): ${historyText}`;
}

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
