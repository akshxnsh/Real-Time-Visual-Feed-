/**
 * Recently explored topics — key rtvlf_history, shape [{ topic, mode, timestamp }].
 * Max 10 entries, newest first, dedupe by topic (moves to top on repeat).
 */

export const STORAGE_EXPLORED = "rtvlf_history";

/** @typedef {{ topic: string, mode: string, timestamp: number }} ExploredEntry */

/** @returns {ExploredEntry[]} */
export function loadExplored() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_EXPLORED);
    if (!raw) return [];
    const p = JSON.parse(raw);
    if (!Array.isArray(p)) return [];
    return p
      .filter((e) => e && typeof e.topic === "string" && e.topic.trim())
      .map((e) => ({
        topic: e.topic.trim(),
        mode: e.mode === "entertain" ? "entertain" : "learn",
        timestamp:
          typeof e.timestamp === "number" ? e.timestamp : Date.now(),
      }));
  } catch {
    return [];
  }
}

/** @param {ExploredEntry[]} entries */
export function saveExplored(entries) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_EXPLORED,
      JSON.stringify(entries.slice(0, 10))
    );
  } catch (e) {
    console.warn("rtvlf_history save failed", e);
  }
}

/**
 * @param {string} topic
 * @param {string} mode
 * @returns {ExploredEntry[]}
 */
export function pushExplored(topic, mode) {
  const t = topic.trim();
  if (!t) return loadExplored();
  const m = mode === "entertain" ? "entertain" : "learn";
  const rest = loadExplored().filter(
    (e) => e.topic.toLowerCase() !== t.toLowerCase()
  );
  const next = [
    { topic: t, mode: m, timestamp: Date.now() },
    ...rest,
  ].slice(0, 10);
  saveExplored(next);
  return next;
}
