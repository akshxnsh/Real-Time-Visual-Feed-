/**
 * localStorage persistence for likes/saves — keys and entry shape are stable for Phase 2.
 */

export const STORAGE_LIKED = "rtvf_liked";
export const STORAGE_DISLIKED = "rtvf_disliked";
export const STORAGE_SAVED = "rtvf_saved";
export const STORAGE_GENRES = "rtvf_genres";

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
    console.warn("rtvf storage write failed", e);
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

/** Load preferred genres from localStorage */
export function loadGenres() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_GENRES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Save preferred genres to localStorage */
export function saveGenres(genres) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_GENRES, JSON.stringify(genres));
  } catch (e) {
    console.warn("rtvf genres write failed", e);
  }
}
