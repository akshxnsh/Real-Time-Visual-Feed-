/**
 * Activity Tracker
 * Tracks last-active timestamps, deployment state, and ping history per GPU region.
 * Persists to data/activity.json so server restarts don't lose state.
 *
 * History is used by the Groq agent to predict future activity and make smarter
 * provision/teardown decisions — reducing both cold-start latency and idle GPU cost.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, '../data/activity.json');

// Valid managed regions
export const REGIONS = ['US', 'IN'];

// Keep at most 7 days of per-ping records (7 × 24 × ~10 pings/hr = ~1680 max)
const MAX_HISTORY_ENTRIES = 2000;

// Status values
// 'idle'         — no GPU running, no recent activity
// 'active'       — GPU running, user traffic present
// 'provisioning' — GPU container being spun up
// 'warning'      — idle 8–10 min, teardown imminent
const DEFAULT_REGION_STATE = () => ({
  lastActive: null,    // ISO timestamp of last request, or null
  status: 'idle',
  deploymentId: null,  // io.net container ID when running
  endpoint: null,      // live URL when running
});

let state = {
  US: DEFAULT_REGION_STATE(),
  IN: DEFAULT_REGION_STATE(),
};

// Append-only ping history per region — each entry: { hour, day, ts }
// hour: 0-23 (UTC), day: 0=Sun … 6=Sat
let pingHistory = {
  US: [],
  IN: [],
};

// ── Persistence ──────────────────────────────────────────────────────────────

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadFromDisk() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const saved = JSON.parse(raw);
      // Merge saved state — only update fields we recognise
      for (const region of REGIONS) {
        if (saved[region]) {
          state[region] = { ...DEFAULT_REGION_STATE(), ...saved[region] };
        }
        if (Array.isArray(saved.pingHistory?.[region])) {
          pingHistory[region] = saved.pingHistory[region];
        }
      }
      console.log('📂 Activity state loaded from disk');
    }
  } catch (err) {
    console.warn('⚠️  Could not load activity.json, starting fresh:', err.message);
  }
}

function saveToDisk() {
  try {
    ensureDataDir();
    const payload = { ...state, pingHistory };
    fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    console.warn('⚠️  Could not save activity.json:', err.message);
  }
}

// ── Country → Region mapping ─────────────────────────────────────────────────

const COUNTRY_TO_REGION = {
  // Asia → IN node
  IN: 'IN', SG: 'IN', JP: 'IN', KR: 'IN',
  PK: 'IN', BD: 'IN', LK: 'IN', NP: 'IN',
  AE: 'IN', SA: 'IN',
};

export function countryToRegion(countryCode) {
  return COUNTRY_TO_REGION[countryCode] || 'US';
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Record a user request for a region.
 * Also appends to ping history for activity prediction.
 * @param {string} region — 'US' or 'IN'
 */
export function ping(region) {
  if (!REGIONS.includes(region)) return;
  state[region].lastActive = new Date().toISOString();
  // If currently idle, mark active so the agent knows to provision
  if (state[region].status === 'idle') {
    state[region].status = 'active';
  }

  // Append to history for probability model
  const now = new Date();
  pingHistory[region].push({
    hour: now.getUTCHours(),
    day: now.getUTCDay(),   // 0=Sun … 6=Sat
    ts: now.toISOString(),
  });
  // Trim to cap memory/disk usage
  if (pingHistory[region].length > MAX_HISTORY_ENTRIES) {
    pingHistory[region] = pingHistory[region].slice(-MAX_HISTORY_ENTRIES);
  }

  saveToDisk();
}

/**
 * Minutes since the last request for a region.
 * Returns Infinity if the region has never been active.
 * @param {string} region
 * @returns {number}
 */
export function getIdleMinutes(region) {
  const { lastActive } = state[region];
  if (!lastActive) return Infinity;
  const diffMs = Date.now() - new Date(lastActive).getTime();
  return diffMs / 60_000;
}

/**
 * Update the status string for a region.
 * @param {string} region
 * @param {'idle'|'active'|'provisioning'|'warning'} status
 */
export function setStatus(region, status) {
  if (!REGIONS.includes(region)) return;
  state[region].status = status;
  saveToDisk();
}

/**
 * Store the live container details once provisioned.
 * @param {string} region
 * @param {string} deploymentId — io.net container ID
 * @param {string} endpoint     — base URL including trailing slash
 */
export function setDeployment(region, deploymentId, endpoint) {
  if (!REGIONS.includes(region)) return;
  state[region].deploymentId = deploymentId;
  state[region].endpoint = endpoint;
  state[region].status = 'active';
  saveToDisk();
}

/**
 * Clear deployment info after teardown.
 * @param {string} region
 */
export function clearDeployment(region) {
  if (!REGIONS.includes(region)) return;
  state[region].deploymentId = null;
  state[region].endpoint = null;
  state[region].status = 'idle';
  saveToDisk();
}

/**
 * Get the full state for a region.
 * @param {string} region
 * @returns {{ lastActive: string|null, status: string, deploymentId: string|null, endpoint: string|null }}
 */
export function getRegionState(region) {
  return { ...state[region] };
}

/**
 * Get the live endpoint for a region, or null if no container is running.
 * @param {string} region
 * @returns {string|null}
 */
export function getEndpoint(region) {
  return state[region]?.endpoint || null;
}

// ── Activity Prediction ───────────────────────────────────────────────────────

/**
 * Compute the probability of activity in a given UTC hour+day bucket
 * based on historical pings over the past 28 days.
 *
 * Returns a value 0.0–1.0.
 * Returns null if fewer than 3 days of data exist (not enough signal).
 *
 * @param {string} region
 * @param {number} hour  — UTC hour 0-23
 * @param {number} day   — UTC day 0=Sun … 6=Sat
 * @returns {number|null}
 */
export function getHourlyProbability(region, hour, day) {
  const history = pingHistory[region];
  if (!history.length) return null;

  const cutoff = Date.now() - 28 * 24 * 60 * 60 * 1000; // 28 days
  const recent = history.filter(e => new Date(e.ts).getTime() > cutoff);

  // Need at least 3 distinct days of data before trusting the model
  const distinctDays = new Set(recent.map(e => {
    const d = new Date(e.ts);
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
  })).size;
  if (distinctDays < 3) return null;

  // Count how many times the same day-of-week occurred in the window
  // (e.g. 4 Mondays in 28 days)
  const dayOccurrences = recent.filter(e => {
    // Count the number of times this specific day-of-week appeared
    const d = new Date(e.ts);
    return d.getUTCDay() === day;
  });
  // Unique weeks that contained this day-of-week
  const weeksSeen = new Set(
    recent
      .filter(e => new Date(e.ts).getUTCDay() === day)
      .map(e => {
        const d = new Date(e.ts);
        // ISO week approximation: floor(dayOfYear / 7)
        const start = new Date(d.getUTCFullYear(), 0, 0);
        const diff = d - start;
        return Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
      })
  ).size || 1;

  // Hits in this exact hour+day bucket
  const hits = recent.filter(e => {
    const d = new Date(e.ts);
    return d.getUTCHours() === hour && d.getUTCDay() === day;
  }).length;

  // P = fraction of weeks where this hour+day had at least one ping
  // Clamped to [0, 1]
  return Math.min(hits / weeksSeen, 1.0);
}

/**
 * Build a compact 24-element array of hourly probabilities for a given region
 * and day-of-week. Used by the agent to identify peak windows at a glance.
 *
 * @param {string} region
 * @param {number} day — UTC day 0=Sun … 6=Sat
 * @returns {number[]} 24 values, index = UTC hour
 */
export function getHourlyProfile(region, day) {
  return Array.from({ length: 24 }, (_, h) => {
    const p = getHourlyProbability(region, h, day);
    return p === null ? 0 : parseFloat(p.toFixed(2));
  });
}

/**
 * Return the full context object the agent needs to make a decision.
 * @param {string} region
 * @returns {object}
 */
export function getAgentContext(region) {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcDay  = now.getUTCDay();

  const pNow      = getHourlyProbability(region, utcHour, utcDay);
  // Look 15 min ahead — next hour bucket if we're in last 15 min of the hour
  const nextHour  = (utcHour + 1) % 24;
  const pNext     = getHourlyProbability(region, nextHour, utcDay);

  const hasHistory = pingHistory[region].length >= 10;

  return {
    region,
    idleMinutes:   parseFloat(getIdleMinutes(region).toFixed(1)),
    status:        state[region].status,
    hasContainer:  !!(state[region].endpoint || state[region].status === 'provisioning'),
    utcHour,
    utcDay,
    pActivityNow:  pNow,          // null = not enough history
    pActivityNext: pNext,         // probability in the next hour bucket
    hourlyProfile: hasHistory ? getHourlyProfile(region, utcDay) : null,
    historyDays:   hasHistory
      ? Math.round(
          (Date.now() - new Date(pingHistory[region][0].ts).getTime()) /
          (24 * 60 * 60 * 1000)
        )
      : 0,
  };
}

// Initialise on first import
loadFromDisk();
