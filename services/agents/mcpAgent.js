/**
 * MCP Agent — Dynamic GPU Fleet Manager
 *
 * Connects to io.net Agent Cloud MCP server and manages GPU containers
 * per region based on user activity tracked by activityTracker.js.
 *
 * Thresholds:
 *   Soft (warning) : 8 minutes idle  → status = 'warning'
 *   Hard (teardown): 10 minutes idle → teardown container via io.net REST API
 *
 * Poll interval: every 3 minutes
 *
 * MCP tools used (via https://mcp.io.solutions/mcp):
 *   caas_list_deployments  — sync existing containers on startup
 *   vmaas_get_hardware_list — (optional) browse available GPU types
 *   caas_deploy_container  — provision a new container
 *
 * Teardown: direct io.net REST API (no MCP teardown tool available yet)
 */

import {
  REGIONS,
  getIdleMinutes,
  getRegionState,
  setStatus,
  setDeployment,
  clearDeployment,
} from './activityTracker.js';

// ── Config ────────────────────────────────────────────────────────────────────

const MCP_SERVER_URL = 'https://mcp.io.solutions/mcp';
const IONET_REST_BASE = 'https://api.io.solutions/api/v1';

const POLL_INTERVAL_MS = 3 * 60 * 1000;   // 3 minutes
const SOFT_THRESHOLD_MIN = 8;              // warn at 8 min idle
const HARD_THRESHOLD_MIN = 10;            // teardown at 10 min idle

// Map region → Docker image env var name
const REGION_IMAGE_ENV = {
  US: 'IO_NET_CONTAINER_IMAGE_US',
  IN: 'IO_NET_CONTAINER_IMAGE_IN',
};

// GPU type to request per region (cheapest available — can be changed)
const REGION_GPU_TYPE = {
  US: process.env.IO_NET_GPU_TYPE_US || 'RTX4090',
  IN: process.env.IO_NET_GPU_TYPE_IN || 'RTX4090',
};

// ── MCP HTTP+SSE transport helpers ───────────────────────────────────────────

function getApiKey() {
  const key = process.env.IO_NET_API_KEY;
  if (!key) throw new Error('IO_NET_API_KEY is not set');
  return key;
}

/**
 * Call a single MCP tool via HTTP POST (JSON-RPC 2.0 over SSE transport).
 * io.net's MCP server supports direct JSON-RPC POST requests.
 *
 * @param {string} toolName
 * @param {object} args
 * @returns {Promise<object>} — parsed tool result content
 */
async function callMcpTool(toolName, args = {}) {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: { name: toolName, arguments: args },
  });

  const response = await fetch(MCP_SERVER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'x-api-key': getApiKey(),
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MCP tool '${toolName}' failed [${response.status}]: ${text}`);
  }

  const contentType = response.headers.get('content-type') || '';

  // Handle SSE response — read the first 'data:' line
  if (contentType.includes('text/event-stream')) {
    const text = await response.text();
    const dataLine = text.split('\n').find(l => l.startsWith('data:'));
    if (!dataLine) throw new Error(`MCP tool '${toolName}': no data in SSE response`);
    const json = JSON.parse(dataLine.slice('data:'.length).trim());
    if (json.error) throw new Error(`MCP tool '${toolName}' error: ${JSON.stringify(json.error)}`);
    return json.result;
  }

  const json = await response.json();
  if (json.error) throw new Error(`MCP tool '${toolName}' error: ${JSON.stringify(json.error)}`);
  return json.result;
}

// ── io.net REST API helpers ───────────────────────────────────────────────────

/**
 * List active deployments from the REST API.
 * Used to reconcile routing table on startup in case MCP also returns them.
 */
async function restListDeployments() {
  const response = await fetch(`${IONET_REST_BASE}/caas/deployments`, {
    headers: { 'x-api-key': getApiKey() },
  });
  if (!response.ok) {
    throw new Error(`REST list deployments failed [${response.status}]`);
  }
  return response.json();
}

/**
 * Tear down a container by deployment ID via io.net REST API.
 * Agent Cloud MCP does not expose a teardown tool yet.
 * @param {string} deploymentId
 */
async function restTeardownContainer(deploymentId) {
  const response = await fetch(`${IONET_REST_BASE}/caas/deployments/${deploymentId}`, {
    method: 'DELETE',
    headers: { 'x-api-key': getApiKey() },
  });
  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(`Teardown failed for ${deploymentId} [${response.status}]: ${text}`);
  }
}

// ── Core logic ────────────────────────────────────────────────────────────────

/**
 * Extract a usable base URL from a deployment object returned by io.net.
 * The exact field name may vary — this handles common shapes.
 * @param {object} deployment
 * @returns {string|null}
 */
function extractEndpointUrl(deployment) {
  // Try common field names returned by io.net API
  const raw =
    deployment?.endpoint ||
    deployment?.url ||
    deployment?.serviceUrl ||
    deployment?.service_url ||
    deployment?.ip ||
    null;

  if (!raw) return null;

  // Ensure it ends with a trailing slash so /generate can be appended
  const base = raw.startsWith('http') ? raw : `https://${raw}`;
  return base.endsWith('/') ? base : `${base}/`;
}

/**
 * Determine which region a deployment belongs to by inspecting its tags/name.
 * io.net allows setting name/tags on caas_deploy_container — we use the region name.
 * @param {object} deployment
 * @returns {string|null} 'US' | 'IN' | null
 */
function extractRegionFromDeployment(deployment) {
  const name = (deployment?.name || deployment?.tags?.region || '').toUpperCase();
  for (const region of REGIONS) {
    if (name.includes(region)) return region;
  }
  return null;
}

/**
 * Provision a new GPU container for the given region via MCP.
 * @param {string} region
 */
async function provisionContainer(region) {
  const imageEnvVar = REGION_IMAGE_ENV[region];
  const image = process.env[imageEnvVar];

  if (!image) {
    console.warn(`⚠️  [MCP Agent] ${imageEnvVar} not set — cannot provision ${region}`);
    return;
  }

  console.log(`🚀 [MCP Agent] Provisioning GPU container for region ${region} (image: ${image})`);
  setStatus(region, 'provisioning');

  try {
    const result = await callMcpTool('caas_deploy_container', {
      name: `rtvlf-${region.toLowerCase()}-${Date.now()}`,
      image,
      gpu_type: REGION_GPU_TYPE[region],
      tags: { region },
    });

    // Extract deployment details from MCP response
    // The result.content array contains text or JSON blocks
    let deployment = null;
    if (Array.isArray(result?.content)) {
      for (const block of result.content) {
        if (block.type === 'text') {
          try { deployment = JSON.parse(block.text); } catch { /* not JSON */ }
        }
      }
    } else if (result?.deployment) {
      deployment = result.deployment;
    }

    const endpoint = deployment ? extractEndpointUrl(deployment) : null;
    const deploymentId = deployment?.id || deployment?.deployment_id || null;

    if (endpoint && deploymentId) {
      setDeployment(region, deploymentId, endpoint);
      console.log(`✅ [MCP Agent] ${region} container live: ${endpoint} (id: ${deploymentId})`);
    } else {
      // Container is provisioning — endpoint may not be ready yet
      // Status stays 'provisioning'; next poll will check caas_list_deployments
      console.log(`⏳ [MCP Agent] ${region} container provisioning — endpoint not ready yet`);
      if (deploymentId) {
        setDeployment(region, deploymentId, null);
        setStatus(region, 'provisioning');
      }
    }
  } catch (err) {
    console.error(`❌ [MCP Agent] Failed to provision ${region}:`, err.message);
    setStatus(region, 'active'); // revert so we retry next poll
  }
}

/**
 * Tear down the running container for a region.
 * @param {string} region
 */
async function teardownContainer(region) {
  const { deploymentId } = getRegionState(region);

  if (!deploymentId) {
    clearDeployment(region);
    return;
  }

  console.log(`🗑️  [MCP Agent] Tearing down ${region} container (id: ${deploymentId})`);

  try {
    await restTeardownContainer(deploymentId);
    clearDeployment(region);
    console.log(`✅ [MCP Agent] ${region} container torn down`);
  } catch (err) {
    console.error(`❌ [MCP Agent] Teardown failed for ${region}:`, err.message);
    // Don't leave in warning state — set back to active to avoid loop
    setStatus(region, 'active');
  }
}

/**
 * Check in-flight provisioning containers via caas_list_deployments.
 * If a container for a region that is 'provisioning' now has an endpoint, update routing table.
 * @param {object[]} deployments — list from caas_list_deployments
 */
function reconcileProvisioningContainers(deployments) {
  for (const region of REGIONS) {
    const { status, deploymentId } = getRegionState(region);
    if (status !== 'provisioning' || !deploymentId) continue;

    const match = deployments.find(d =>
      (d?.id === deploymentId || d?.deployment_id === deploymentId)
    );

    if (!match) continue;

    const endpoint = extractEndpointUrl(match);
    if (endpoint) {
      setDeployment(region, deploymentId, endpoint);
      console.log(`✅ [MCP Agent] ${region} provisioning complete: ${endpoint}`);
    }
  }
}

/**
 * Single poll cycle — evaluate each region and take action.
 */
async function poll() {
  console.log('🔄 [MCP Agent] Polling regions...');

  // Fetch current deployments to sync provisioning state
  let deployments = [];
  try {
    const mcpResult = await callMcpTool('caas_list_deployments', {});
    // Result shape varies — try to extract the array
    if (Array.isArray(mcpResult?.content)) {
      for (const block of mcpResult.content) {
        if (block.type === 'text') {
          try {
            const parsed = JSON.parse(block.text);
            deployments = Array.isArray(parsed) ? parsed : (parsed?.deployments || []);
          } catch { /* not JSON */ }
        }
      }
    } else if (Array.isArray(mcpResult?.deployments)) {
      deployments = mcpResult.deployments;
    } else if (Array.isArray(mcpResult)) {
      deployments = mcpResult;
    }

    reconcileProvisioningContainers(deployments);
  } catch (err) {
    console.warn('⚠️  [MCP Agent] Could not list deployments:', err.message);
    // Non-fatal — continue with local state
  }

  for (const region of REGIONS) {
    const idle = getIdleMinutes(region);
    const { status, endpoint } = getRegionState(region);

    const hasContainer = !!endpoint || status === 'provisioning';
    const isProvisioning = status === 'provisioning';

    if (idle < SOFT_THRESHOLD_MIN) {
      // Region is active
      if (!hasContainer && !isProvisioning) {
        await provisionContainer(region);
      }
    } else if (idle >= SOFT_THRESHOLD_MIN && idle < HARD_THRESHOLD_MIN) {
      // Warning zone — log but don't act yet
      if (status !== 'warning') {
        setStatus(region, 'warning');
        console.log(`⚠️  [MCP Agent] ${region} idle ${idle.toFixed(1)} min — teardown in ~${(HARD_THRESHOLD_MIN - idle).toFixed(1)} min`);
      }
    } else if (idle >= HARD_THRESHOLD_MIN) {
      // Hard teardown
      if (hasContainer) {
        await teardownContainer(region);
      }
    }
  }
}

// ── Startup sync ─────────────────────────────────────────────────────────────

/**
 * On startup, call caas_list_deployments and reconcile any already-running
 * containers into the routing table. This handles server restarts gracefully.
 */
async function syncOnStartup() {
  console.log('🔍 [MCP Agent] Syncing existing deployments on startup...');

  try {
    const mcpResult = await callMcpTool('caas_list_deployments', {});

    let deployments = [];
    if (Array.isArray(mcpResult?.content)) {
      for (const block of mcpResult.content) {
        if (block.type === 'text') {
          try {
            const parsed = JSON.parse(block.text);
            deployments = Array.isArray(parsed) ? parsed : (parsed?.deployments || []);
          } catch { /* not JSON */ }
        }
      }
    } else if (Array.isArray(mcpResult?.deployments)) {
      deployments = mcpResult.deployments;
    } else if (Array.isArray(mcpResult)) {
      deployments = mcpResult;
    }

    for (const deployment of deployments) {
      const region = extractRegionFromDeployment(deployment);
      if (!region) continue;

      const endpoint = extractEndpointUrl(deployment);
      const deploymentId = deployment?.id || deployment?.deployment_id;

      if (endpoint && deploymentId) {
        setDeployment(region, deploymentId, endpoint);
        console.log(`↩️  [MCP Agent] Restored ${region} → ${endpoint} (id: ${deploymentId})`);
      }
    }

    console.log('✅ [MCP Agent] Startup sync complete');
  } catch (err) {
    console.warn('⚠️  [MCP Agent] Startup sync failed (will recover on next poll):', err.message);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

let pollTimer = null;

/**
 * Start the MCP agent. Call once after the Express server is listening.
 */
export async function start() {
  if (!process.env.IO_NET_API_KEY) {
    console.warn('⚠️  [MCP Agent] IO_NET_API_KEY not set — agent disabled. Video will use fallback endpoints only.');
    return;
  }

  console.log('🤖 [MCP Agent] Starting dynamic GPU fleet manager...');

  await syncOnStartup();

  // Kick off first poll immediately, then every POLL_INTERVAL_MS
  await poll();

  pollTimer = setInterval(async () => {
    try {
      await poll();
    } catch (err) {
      console.error('❌ [MCP Agent] Unhandled poll error:', err.message);
    }
  }, POLL_INTERVAL_MS);

  console.log(`🤖 [MCP Agent] Running — polling every ${POLL_INTERVAL_MS / 60_000} min`);
}

/**
 * Stop the agent (useful for graceful shutdown).
 */
export function stop() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log('🤖 [MCP Agent] Stopped');
  }
}
