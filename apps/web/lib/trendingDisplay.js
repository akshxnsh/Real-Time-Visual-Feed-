export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function randomExploringCount() {
  const min = 1200;
  const max = 98000;
  return Math.floor(min + Math.random() * (max - min));
}

export function formatExploringLabel(n) {
  if (n >= 1000) {
    const k = n / 1000;
    const s = k >= 10 ? Math.round(k) : Math.round(k * 10) / 10;
    return `${s}k people exploring`;
  }
  return `${n} people exploring`;
}

/** Pick 6 from 12 with shuffle + fake counts for UI */
export function buildTrendingDisplay(allTopics) {
  if (!Array.isArray(allTopics) || allTopics.length === 0) return [];
  return shuffle(allTopics)
    .slice(0, 6)
    .map((t, idx) => {
      if (!t || typeof t !== "object") return null;
      const topic =
        typeof t.topic === "string" ? t.topic : String(t.topic ?? "");
      const parsedId = Number(t.id);
      const id =
        typeof t.id === "number" && !Number.isNaN(t.id)
          ? t.id
          : Number.isFinite(parsedId)
            ? parsedId
            : idx + 1;
      const emoji = typeof t.emoji === "string" ? t.emoji : "📌";
      const category =
        typeof t.category === "string" ? t.category : "tech";
      return {
        id,
        topic,
        emoji,
        category,
        exploringLabel: formatExploringLabel(randomExploringCount()),
      };
    })
    .filter(
      (row) =>
        row &&
        typeof row.topic === "string" &&
        row.topic.trim().length > 0
    );
}
