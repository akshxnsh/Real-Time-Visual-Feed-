// Using global fetch (Node 18+)

const IO_NET_CLUSTERS = {
  // Asia + India → India node
  IN: process.env.IO_NET_ENDPOINT_IN,
  SG: process.env.IO_NET_ENDPOINT_IN,
  JP: process.env.IO_NET_ENDPOINT_IN,
  KR: process.env.IO_NET_ENDPOINT_IN,
  PK: process.env.IO_NET_ENDPOINT_IN,
  BD: process.env.IO_NET_ENDPOINT_IN,
  LK: process.env.IO_NET_ENDPOINT_IN,
  NP: process.env.IO_NET_ENDPOINT_IN,
  AE: process.env.IO_NET_ENDPOINT_IN,
  SA: process.env.IO_NET_ENDPOINT_IN,

  // Americas + Europe + Rest → US node
  US: process.env.IO_NET_ENDPOINT_US,
  CA: process.env.IO_NET_ENDPOINT_US,
  GB: process.env.IO_NET_ENDPOINT_US,
  DE: process.env.IO_NET_ENDPOINT_US,
  FR: process.env.IO_NET_ENDPOINT_US,
  BR: process.env.IO_NET_ENDPOINT_US,
  AU: process.env.IO_NET_ENDPOINT_US,
  MX: process.env.IO_NET_ENDPOINT_US,
  NG: process.env.IO_NET_ENDPOINT_US,
  ZA: process.env.IO_NET_ENDPOINT_US,
};

function getNearestEndpoint(countryCode) {
  return IO_NET_CLUSTERS[countryCode]
      || process.env.IO_NET_ENDPOINT_US;  // default fallback
}

/**
 * Generate a new video job
 */
export async function generateVideoJob(topic, mode, sentimentProfile, countryCode) {
  const endpoint = getNearestEndpoint(countryCode);
  
  if (!endpoint) {
    throw new Error('No valid IO_NET_ENDPOINT configured for routing');
  }

  // Base prompt (before enrichment)
  const prompt = `Create a high-quality, engaging video about ${topic}`;

  // Log routing as requested
  const region = Object.keys(IO_NET_CLUSTERS).find(key => IO_NET_CLUSTERS[key] === endpoint) || 'US';
  console.log(`Routing ${countryCode} → ${endpoint === process.env.IO_NET_ENDPOINT_IN ? 'IO_NET_ENDPOINT_IN' : 'IO_NET_ENDPOINT_US'}`);

  const response = await fetch(`${endpoint}generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: prompt,
      topic: topic,
      user_region: countryCode,
      mode: mode
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to generate video: ${response.statusText}`);
  }

  const data = await response.json();
  
  return {
    jobId: data.jobId,
    endpoint: endpoint
  };
}

/**
 * Poll the status of a video job
 */
export async function pollJobStatus(jobId, endpoint) {
  if (!endpoint) {
    throw new Error('Endpoint is required to poll job status');
  }

  const response = await fetch(`${endpoint}status/${jobId}`);
  
  if (!response.ok) {
    throw new Error(`Failed to check job status: ${response.statusText}`);
  }

  return response.json();
}
