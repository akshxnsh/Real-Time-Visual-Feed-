/**
 * Video Generation API Routes
 * POST /api/video/generate - Submit a video generation job
 * GET  /api/video/status/:jobId - Check job status
 * 
 * The video server handles geographic routing and load balancing internally.
 * All requests go to a single entry point (IO_NET_ENDPOINT).
 */

import express from 'express'
import geoip from 'geoip-lite'
import { generateVideoJob, pollJobStatus } from '../../../services/video.js'
import { ping as pingActivity, countryToRegion } from '../../../services/activityTracker.js'

const router = express.Router()

// Store which node each job is on, with a creation timestamp for TTL cleanup
const jobEndpoints = {}
// Auto-delete job endpoint entries after 2 hours to prevent unbounded memory growth
const JOB_TTL_MS = 2 * 60 * 60 * 1000

function setJobEndpoint(jobId, endpoint) {
  jobEndpoints[jobId] = endpoint
  setTimeout(() => {
    delete jobEndpoints[jobId]
  }, JOB_TTL_MS)
}

/**
 * POST /api/video/generate
 * Submit a new video generation job
 * 
 * Body: {
 *   topic: string (required),
 *   mode: "learn" | "entertain" (required),
 *   history: array (optional),
 *   sentimentProfile: object (optional),
 *   timezone: string (optional - from browser Intl.DateTimeFormat)
 * }
 * 
 * Returns: { jobId, countryCode }
 */
router.post('/generate', async (req, res) => {
  const {
    topic,
    mode = 'learn',
    history = [],
    sentimentProfile = null,
    timezone = '',
    // Optional pre-built prompt from the frontend (from /api/feed/generate).
    // When provided this is sent directly to the RTVF server, bypassing the
    // internal prompt builder in generateVideoJob().
    prompt: preBuiltPrompt = null,
  } = req.body

  if (!topic) {
    return res.status(400).json({ error: 'topic is required' })
  }

  if (!['learn', 'entertain', 'news'].includes(mode)) {
    return res.status(400).json({ error: 'mode must be "learn", "entertain" or "news"' })
  }

  // Detect user country from IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0]
         || req.headers['cf-connecting-ip']
         || req.ip
  const geo = geoip.lookup(ip)
  const countryCode = geo?.country || process.env.DEFAULT_COUNTRY || 'IN'

  console.log(`Request from IP: ${ip} → ${countryCode}`)

  // Signal activity so MCP agent knows this region needs a GPU container
  pingActivity(countryToRegion(countryCode))

  try {
    let newsArticle = null;
    if (mode === 'news') {
      const { fetchBreakingNews } = await import('../../../services/news.js');
      const articles = await fetchBreakingNews('breaking', countryCode);
      if (articles && articles.length > 0) {
        newsArticle = articles[0]; // Pick top story
        console.log(`📰 Selected news for video: ${newsArticle.title}`);
      }
    }

    const { jobId, endpoint } = await generateVideoJob(
      topic,
      mode,
      sentimentProfile,
      countryCode,
      newsArticle,
      preBuiltPrompt  // pass through — null means generateVideoJob builds its own
    )

    setJobEndpoint(jobId, endpoint)

    res.json({ jobId, countryCode })

  } catch (error) {
    console.error('Video generation failed:', error.message)
    res.status(500).json({ error: 'Generation failed' })
  }
})

/**
 * GET /api/video/status/:jobId
 * Check the status of a video generation job
 * 
 * Returns: {
 *   status: "pending" | "processing" | "complete" | "failed",
 *   videoUrl: string (if complete),
 *   error: string (if failed)
 * }
 */
router.get('/status/:jobId', async (req, res) => {
  const { jobId } = req.params

  try {
    // Poll always hits same node
    const endpoint = jobEndpoints[jobId]
    
    if (!endpoint) {
      return res.status(404).json({ error: 'Job endpoint not found' })
    }

    const result = await pollJobStatus(jobId, endpoint)
    res.json(result)
  } catch (error) {
    console.error('Status check failed:', error.message)
    res.status(500).json({ error: 'Status check failed' })
  }
})

export default router
