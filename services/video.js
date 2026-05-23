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

// Static regional context — mirrors REGIONAL_TEMPLATES in rtvf Video Server/context_agent.py
const REGIONAL_CONTEXT = {
  IN: {
    country: 'India',
    culturalMarkers: ['chai stalls', 'auto-rickshaws', 'cricket', 'colorful markets', 'urban middle class India'],
    currency: 'Indian Rupee (₹)',
    visualStyle: 'vibrant colors, busy Indian streets, warm golden lighting, diverse crowds',
    economicRefs: ['RBI policy', 'EMIs', 'rupee'],
  },
  US: {
    country: 'United States',
    culturalMarkers: ['suburbs', 'highways', 'supermarkets', 'NFL'],
    currency: 'US Dollar ($)',
    visualStyle: 'clean wide shots, American suburbs, modern cities, neutral lighting',
    economicRefs: ['Federal Reserve', 'unemployment', 'dollar'],
  },
  GB: {
    country: 'United Kingdom',
    culturalMarkers: ['red buses', 'Westminster', 'pubs', 'royal events'],
    currency: 'British Pound (£)',
    visualStyle: 'historic architecture, British countryside, rainy weather, formal atmosphere',
    economicRefs: ['Bank of England', 'GBP', 'parliament'],
  },
};

/**
 * Build a preview of the final LTX-Video prompt that would be produced
 * by context_agent.py on the io.net node.
 * Static regional templates are applied here; pytrends + NewsData parts
 * are shown as placeholders since those only run inside the Docker container.
 */
export function buildVideoPromptPreview(topic, mode, countryCode = 'US', newsArticle = null) {
  const region = countryToRegion(countryCode);
  const ctx = REGIONAL_CONTEXT[region] || {
    country: region,
    visualStyle: 'modern, clear, professional',
    culturalMarkers: ['global', 'worldwide', 'international'],
    currency: 'Local Currency',
    economicRefs: ['global markets', 'international trade'],
  };

  const basePrompt = mode === 'news' && newsArticle
    ? `Create a visually animated news explanation video about: ${newsArticle.title}`
    : `Create a high-quality, engaging video about ${topic}`;

  if (mode === 'news' && newsArticle) {
    return `${basePrompt}

BREAKING NEWS CONTEXT:
Headline: ${newsArticle.title}
Description: ${newsArticle.description || ''}
Source: ${newsArticle.source || ''}

Regional Context (${region}):
- Key markers: ${ctx.culturalMarkers.join(', ')}
- Currency: ${ctx.currency}

VISUAL REQUIREMENTS:
- Open with headline in animated text
- Show 3 visual scenarios explaining the impact
- Include location/map visualization
- Timeline showing when this happened
- End with "Stay informed - updates as they develop"
- Color scheme: news-appropriate (reds/blues for urgency, greens for positive)
- NO text overlays inside video (all context should be visual)

→ LTX-Video-0.9.8-13B-distilled · 257 frames @ 30fps · 704×480`;
  }

  return `${basePrompt}

Regional Context (${region}):
Location: ${ctx.country}
Cultural markers: ${ctx.culturalMarkers.join(', ')}
Currency: ${ctx.currency}
Visual style: ${ctx.visualStyle}

Economic references to include if relevant: ${ctx.economicRefs.join(', ')}

Local Trends for Topic: [fetched live via pytrends on io.net node]
Top Local Headline: [fetched live via NewsData API on io.net node]

→ LTX-Video-0.9.8-13B-distilled · 257 frames @ 30fps · 704×480`;
}
