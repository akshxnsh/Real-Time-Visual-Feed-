/**
 * Auto-tag trend name into category buckets for UI badges & filtering.
 */

const TECH = /\b(ai|tech|software|crypto|bitcoin|ethereum|apple|google|openai|gpu|chip|iphone|android|cloud|saas|code|developer|startup|nvidia|intel)\b/i;
const SPORTS = /\b(nba|nfl|mlb|nhl|soccer|football|basketball|olympic|premier league|uefa|tennis|golf|f1|formula)\b/i;
const ENT = /\b(movie|film|oscar|grammy|album|netflix|streaming|celebr|music|tv series|show|actor|actress|hollywood)\b/i;
const SCI = /\b(space|nasa|climate|physics|chemistry|biology|medicine|study|research|quantum|mars|moon)\b/i;
const CULT = /\b(museum|art|history|culture|food|cuisine|tradition|language|book|literature)\b/i;

export function categorizeTrendName(name) {
  const t = (name || "").toLowerCase();
  if (TECH.test(t)) return "tech";
  if (SPORTS.test(t)) return "sports";
  if (ENT.test(t)) return "entertainment";
  if (SCI.test(t)) return "science";
  if (CULT.test(t)) return "culture";
  return "world";
}
