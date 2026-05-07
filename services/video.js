// Using global fetch (Node 18+)

import { getEndpoint, countryToRegion } from './activityTracker.js';

function getNearestEndpoint(countryCode) {
  const region = countryToRegion(countryCode);
  // Live dynamic endpoint from MCP agent routing table
  const live = getEndpoint(region);
  if (live) return live;

  // Fallback to static env vars if MCP agent has not provisioned a container yet
  // (covers cold start, disabled agent, or missing IO_NET_API_KEY)
  if (region === 'IN') return process.env.IO_NET_ENDPOINT_IN || null;
  return process.env.IO_NET_ENDPOINT_US || null;
}

/**
 * Generate a new video job
 */
export async function generateVideoJob(topic, mode, sentimentProfile, countryCode, newsArticle = null) {
  const endpoint = getNearestEndpoint(countryCode);
  
  if (!endpoint) {
    throw new Error('No valid IO_NET_ENDPOINT configured for routing');
  }

  // Base prompt (before enrichment)
  const prompt = mode === 'news' && newsArticle 
    ? `Create a visually animated news explanation video about: ${newsArticle.title}`
    : `Create a high-quality, engaging video about ${topic}`;

  // Log routing
  const region = countryToRegion(countryCode);
  console.log(`Routing ${countryCode} → ${region} → ${endpoint}`);

  const response = await fetch(`${endpoint}generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: prompt,
      topic: topic,
      user_region: countryCode,
      mode: mode,
      news_article: newsArticle
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
