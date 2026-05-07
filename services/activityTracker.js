/**
 * Activity Tracker
 * Tracks last-active timestamps per GPU region.
 * Persists to data/activity.json so server restarts don't lose state.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, '../data/activity.json');

// Valid managed regions
export const REGIONS = ['US', 'IN'];

// Status values
// 'idle'         — no GPU running, no recent activity
// 'active'       — GPU running, user traffic present
// 'provisioning' — GPU container being spun up
// 'warning'      — idle 8–10 min, teardown imminent
const DEFAULT_REGION_STATE = () => ({
  lastActive: null,    // ISO timestamp of last request, or null
  status: 'idle',
  deploymentId: null,  // io.net container ID when running
  endpoint: null       // live URL when running
});

let state = {
  US: DEFAULT_REGION_STATE(),
  IN: DEFAULT_REGION_STATE(),
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
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
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
 * @param {string} region — 'US' or 'IN'
 */
export function ping(region) {
  if (!REGIONS.includes(region)) return;
  state[region].lastActive = new Date().toISOString();
  // If currently idle, mark active so the agent knows to provision
  if (state[region].status === 'idle') {
    state[region].status = 'active';
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

// Initialise on first import
loadFromDisk();
