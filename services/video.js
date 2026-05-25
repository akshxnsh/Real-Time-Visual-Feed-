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
 * @param {string}  topic
 * @param {string}  mode
 * @param {object}  sentimentProfile
 * @param {string}  countryCode
 * @param {object|null} newsArticle
 * @param {string|null} preBuiltPrompt - When supplied (from /api/feed/generate), this
 *   prompt is forwarded verbatim to the RTVF server so context_agent enriches the
 *   exact prompt the user's feed generated, not a newly constructed one.
 */
export async function generateVideoJob(topic, mode, sentimentProfile, countryCode, newsArticle = null, preBuiltPrompt = null) {
  const endpoint = getNearestEndpoint(countryCode);
  
  if (!endpoint) {
    throw new Error('No valid IO_NET_ENDPOINT configured for routing');
  }

  // Use the pre-built prompt when provided; otherwise build a simple base prompt.
  // context_agent.enrich_prompt() on the RTVF server will further enrich either way.
  const prompt = preBuiltPrompt
    || (mode === 'news' && newsArticle
      ? `Create a visually animated news explanation video about: ${newsArticle.title}`
      : `Create a high-quality, engaging video about ${topic}`);

  // Log routing
  const region = countryToRegion(countryCode);
  console.log(`Routing ${countryCode} → ${region} → ${endpoint}`);
  if (preBuiltPrompt) console.log(`Using pre-built prompt (${preBuiltPrompt.length} chars)`);

  const body = {
    prompt: prompt,
    topic: topic,
    user_region: countryCode,
    mode: mode,
  };
  if (newsArticle) body.news_article = newsArticle;

  const response = await fetch(`${endpoint}generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Failed to generate video: ${response.statusText} — ${errBody}`);
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

// Per-mode variant angle definitions (8 slots, cycles via variant index)
const LEARN_VARIANTS = [
  { angle: 'general overview',                  caption: (t) => `Exploring ${t}` },
  { angle: 'historical origins and evolution',  caption: (t) => `The History of ${t}` },
  { angle: 'latest breakthroughs',              caption: (t) => `The Future of ${t}` },
  { angle: 'impact on everyday life',           caption: (t) => `How ${t} Shapes Daily Life` },
  { angle: 'science and mechanics',             caption: (t) => `The Science of ${t}` },
  { angle: 'controversies and open debates',    caption: (t) => `${t}: The Great Debate` },
  { angle: 'surprising statistics and records', caption: (t) => `${t} by the Numbers` },
  { angle: 'global and cultural perspectives',  caption: (t) => `${t} Around the World` },
];

const ENTERTAIN_VARIANTS = [
  { angle: 'mind-blowing and unexpected facts',      caption: (t) => `${t}: Mind-Blowing Facts` },
  { angle: 'dark secrets and controversies',         caption: (t) => `The Dark Side of ${t}` },
  { angle: 'untold backstory',                       caption: (t) => `${t}: The Untold Story` },
  { angle: 'incredible coincidences and ironies',    caption: (t) => `${t}: Stranger Than Fiction` },
  { angle: 'record-breaking and extreme moments',    caption: (t) => `Record-Breaking ${t}` },
  { angle: 'behind-the-scenes revelations',          caption: (t) => `${t}: Behind the Scenes` },
  { angle: 'what mainstream media ignores',          caption: (t) => `${t}: Hidden from View` },
  { angle: 'weirdest and most bizarre aspects',      caption: (t) => `The Weirdest Side of ${t}` },
];

/**
 * Derive a short, engaging display caption for a video card.
 * For news, uses the article headline directly.
 * For learn/entertain, picks a variant-specific hook title.
 *
 * @param {string} topic
 * @param {string} mode - 'learn' | 'entertain' | 'news'
 * @param {object|null} newsArticle
 * @param {number} variant - 0-based index to pick different angles for the same topic
 * @returns {string}
 */
export function deriveCaption(topic, mode, newsArticle = null, variant = 0) {
  if (mode === 'news' && newsArticle?.title) {
    return newsArticle.title;
  }
  const variants = mode === 'entertain' ? ENTERTAIN_VARIANTS : LEARN_VARIANTS;
  const slot = variants[variant % variants.length];
  return slot.caption(topic);
}

/**
 * Build a preview of the final LTX-Video prompt that would be produced
 * by context_agent.py on the io.net node.
 * Static regional templates are applied here; pytrends + NewsData parts
 * are shown as placeholders since those only run inside the Docker container.
 *
 * @returns {{ prompt: string, caption: string }}
 */
export function buildVideoPromptPreview(topic, mode, countryCode = 'US', newsArticle = null, variant = 0) {
  const region = countryToRegion(countryCode);
  const ctx = REGIONAL_CONTEXT[region] || {
    country: region,
    visualStyle: 'modern, clear, professional',
    culturalMarkers: ['global', 'worldwide', 'international'],
    currency: 'Local Currency',
    economicRefs: ['global markets', 'international trade'],
  };

  const caption = deriveCaption(topic, mode, newsArticle, variant);

  const basePrompt = mode === 'news' && newsArticle
    ? `Create a visually animated news explanation video about: ${newsArticle.title}`
    : `Create a high-quality, engaging video about ${topic}`;

  if (mode === 'news' && newsArticle) {
    return {
      caption,
      prompt: `${basePrompt}

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

→ LTX-Video-0.9.8-13B-distilled · 257 frames @ 30fps · 704×480`,
    };
  }

  const variants = mode === 'entertain' ? ENTERTAIN_VARIANTS : LEARN_VARIANTS;
  const angleDesc = variants[variant % variants.length].angle;

  return {
    caption,
    prompt: `${basePrompt}

Focus angle: ${angleDesc}

Regional Context (${region}):
Location: ${ctx.country}
Cultural markers: ${ctx.culturalMarkers.join(', ')}
Currency: ${ctx.currency}
Visual style: ${ctx.visualStyle}

Economic references to include if relevant: ${ctx.economicRefs.join(', ')}

Local Trends for Topic: [fetched live via pytrends on io.net node]
Top Local Headline: [fetched live via NewsData API on io.net node]

→ LTX-Video-0.9.8-13B-distilled · 257 frames @ 30fps · 704×480`,
  };
}
