import { CATEGORY_EMOJI, normalizeCategorySlug } from "./categoryEmoji";

/** Volume → "12.5k people exploring" or "Trending" */
export function formatTweetVolumeLabel(vol) {
  if (vol == null || vol === 0 || Number.isNaN(vol)) return "Trending";
  const n = Number(vol);
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1)}M people exploring`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k people exploring`;
  return `${n} people exploring`;
}

/**
 * Maps API trend rows → TrendingSection / TrendingCard shape.
 * @param {Array<{ name: string, tweetVolume: number|null, category: string, rank: number }>} records
 */
export function mapTrendRecordsToDisplay(records) {
  if (!Array.isArray(records) || records.length === 0) return [];
  return records.slice(0, 6).map((t, idx) => {
    const cat = normalizeCategorySlug(t.category);
    const emoji = CATEGORY_EMOJI[cat] || "📌";
    const topic =
      typeof t.name === "string" ? t.name : String(t.name ?? "").trim();
    const id =
      typeof t.rank === "number" && !Number.isNaN(t.rank) ? t.rank : idx + 1;
    return {
      id,
      topic,
      emoji,
      category: cat,
      exploringLabel: formatTweetVolumeLabel(t.tweetVolume),
    };
  });
}
