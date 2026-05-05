import { categorizeTrendName } from "./categorize";

/** Fallback when X API / env keys unavailable — read-only placeholder list */
export function getMockTrends() {
  const raw = [
    "Artificial Intelligence",
    "Climate Summit",
    "Premier League",
    "Summer Blockbusters",
    "James Webb Telescope",
    "Street Food Culture",
    "Quantum Computing",
    "Olympics Training",
    "Grammy Awards",
    "Mars Mission",
    "Digital Art NFTs",
    "Global Markets",
  ];
  return raw.map((name, i) => ({
    name,
    tweetVolume: Math.floor(15000 + Math.random() * 180000),
    category: categorizeTrendName(name),
    rank: i + 1,
  }));
}
