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

console.log("✅ Groq client initialized:", !!client);

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
