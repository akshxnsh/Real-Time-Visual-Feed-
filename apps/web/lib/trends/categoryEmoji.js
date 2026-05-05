/** Lowercase category slug → headline emoji (product spec) */
export const CATEGORY_EMOJI = {
  tech: "💻",
  sports: "⚽",
  entertainment: "🎬",
  science: "🔬",
  culture: "🌍",
  world: "🌐",
};

export function normalizeCategorySlug(label) {
  if (!label || typeof label !== "string") return "world";
  const s = label.trim().toLowerCase();
  if (
    ["tech", "sports", "entertainment", "science", "culture", "world"].includes(
      s
    )
  ) {
    return s;
  }
  return "world";
}
