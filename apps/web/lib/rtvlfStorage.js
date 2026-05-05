/**
 * localStorage persistence for likes/saves — keys and entry shape are stable for Phase 2.
 */

export const STORAGE_LIKED = "rtvlf_liked";
export const STORAGE_SAVED = "rtvlf_saved";

/** @typedef {{ id: number, topic: string, mode: string, text: string, timestamp: number }} RtvlfCardRecord */

export function loadCardRecords(key) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** @param {string} key @param {RtvlfCardRecord[]} records */
export function saveCardRecords(key, records) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(records));
  } catch (e) {
    console.warn("rtvlf storage write failed", e);
  }
}

/** @param {RtvlfCardRecord} a @param {RtvlfCardRecord} b */
export function recordsMatch(a, b) {
  return (
    a.topic === b.topic &&
    a.mode === b.mode &&
    a.text === b.text
  );
}

/** Count likes in storage matching exact card content */
export function countLikesForCard(topic, mode, text, likedRecords) {
  return likedRecords.filter((r) => r.topic === topic && r.mode === mode && r.text === text)
    .length;
}
