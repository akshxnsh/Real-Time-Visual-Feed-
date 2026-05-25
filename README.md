# RTVF — Real-Time Visual Feed

An AI-powered infinite feed of short-form educational, entertaining, and live news content. The platform dynamically routes video generation tasks to regional GPU nodes (io.net) via MCP agent integration and provides a highly contextualized scroll experience powered by Groq and real-time news data.

## Features

- **Multi-Mode Feed:** Toggle seamlessly between `LEARN`, `ENTERTAIN`, and `LIVE NEWS` modes.
- **Geographic GPU Routing:** Automatically routes video generation workloads to specific io.net nodes (e.g., US vs. India) based on the user's region for optimized latency.
- **MCP Agent Integration:** Uses io.net's MCP (Model Context Protocol) agent for dynamic GPU container management, including cold start/teardown and regional node selection. The Groq-powered fleet agent applies activity-probability rules to provision and teardown containers automatically.
- **Stateful Polling:** The Express backend maintains state via `activityTracker.js` to track which regional GPU node generated which video job, with TTL-based cleanup, persisting to `data/activity.json`.
- **Contextual Video Enrichment:** The Python video backend uses Google Trends RSS and geographic IP data to inject local trending context into video generation prompts.
- **Live News Mode:** Fetches breaking news via the GNews API and NewsData API, formats it into digestible feed cards, and can generate anchored video content around a real headline.
- **AI-Curated Trending Section:** Calls Groq directly to generate a pool of 20 diverse, regionally-relevant trending topics. The UI cycles through them every 10 seconds and personalises them to the user's detected country.
- **Graceful Fallbacks:** Seamlessly falls back to text-only streaming cards if GPU nodes are temporarily offline or unconfigured.
- **User Auth & Onboarding:** Google OAuth via NextAuth v5. New users are guided through a two-step onboarding flow (topic interests + content genre preferences) before reaching the feed. Preferences seed a local sentiment profile that shapes every subsequent prompt.
- **Sentiment-Driven Personalisation:** A silent engagement tracker (`sentiment.js`) watches watch time, replays, likes, saves, and early scrolls to continuously re-weight a per-session preference profile stored in `localStorage`.

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React 18
- **API Backend:** Node.js + Express
- **Video Backend:** Python + FastAPI + LTX-Video 0.9.8-13B Distilled
- **LLM Engine:** Groq API (`llama-3.3-70b-versatile`) — feed card generation, trending topics, GPU fleet decisions
- **News Engine:** GNews API (card prompts + breaking news), NewsData API (video server regional enrichment)
- **Storage:** Supabase Storage (S3-compatible)
- **Auth:** NextAuth v5 with Google OAuth
- **Infrastructure:** io.net GPU Cloud with MCP agent, Docker (`brocode27/rtvf-video-server`)

## Project Structure

```
rtvf/
├── apps/
│   ├── api/                 # Express backend (Feed Generation, Video Routing, Trending)
│   │   ├── routes/
│   │   │   └── video.js     # POST /api/video/generate, GET /api/video/status/:jobId
│   │   ├── server.js        # Entry point — also starts MCP agent on boot
│   │   └── package.json
│   └── web/                 # Next.js 14 frontend
│       ├── app/
│       │   ├── page.jsx              # Home — server component, SSR trends
│       │   ├── api/auth/[...nextauth] # NextAuth route handler
│       │   ├── api/trends/           # Trends route (cached 15 min)
│       │   ├── auth/signin|signup/   # Google OAuth pages
│       │   ├── onboard/              # Two-step interest onboarding
│       │   ├── trends/               # Browse AI-curated trending topics
│       │   └── explore/              # Redirect relay → /?topic=
│       ├── components/
│       │   └── HomePageClient.js     # All feed logic, streaming, sentiment, UI phases
│       ├── lib/
│       │   └── trends/               # Groq trend fetching, caching, display helpers
│       ├── auth.js                   # NextAuth config (Google provider)
│       ├── middleware.js             # Auth guard + onboarding redirect
│       └── package.json
├── rtvf Video Server/       # Python GPU Worker (runs inside io.net Docker container)
│   ├── main.py              # FastAPI server — job queue, async generation
│   ├── context_agent.py     # Google Trends RSS + NewsData enrichment per node location
│   ├── generator.py         # LTX-Video pipeline (257 frames, 704×480, 8 inference steps)
│   ├── storage.py           # Upload to Supabase Storage via S3-compatible API
│   ├── Dockerfile           # nvidia/cuda:12.2.2 base, model cached at /app/models
│   └── requirements.txt
├── services/
│   ├── agents/
│   │   └── mcpAgent.js      # Groq-powered GPU fleet manager (provision/teardown via MCP)
│   ├── activityTracker.js   # Per-region ping history, deployment state, activity persistence
│   ├── llm.js               # Groq abstraction — trending topics + feed card generation
│   ├── news.js              # GNews API wrapper with 15-min in-memory cache
│   ├── sentiment.js         # EMA-based engagement scoring, localStorage profile
│   └── video.js             # Regional endpoint routing + LTX-Video prompt builder
├── data/                    # Runtime state (activity.json — gitignored)
├── .env.example             # All required environment variables with comments
├── .gitignore
└── package.json             # npm workspaces root (apps/api + apps/web)
```

## Getting Started

### 1. Clone and Install Dependencies

```bash
git clone <repository_url>
cd "Real TIme Visual Feed"
npm install
```

### 2. Set Up Environment Variables

**Root `.env`** (used by the Express API server and services):

```bash
cp .env.example .env
```

```env
# LLM
GROQ_API_KEY=your_groq_api_key
GROQ_TRENDS_API_KEY=your_groq_api_key        # can be same key
GROQ_AGENT_API_KEY=                           # optional — falls back to GROQ_API_KEY

# News
GNEWS_API_KEY=your_gnews_api_key
NEWSDATA_API_KEY=your_newsdata_api_key        # also used by the Python video server

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001

# Google OAuth (NextAuth v5)
AUTH_SECRET=                                  # generate: npx auth secret
AUTH_GOOGLE_ID=your_google_oauth_client_id
AUTH_GOOGLE_SECRET=your_google_oauth_client_secret

# io.net — only needed for live GPU deployment, not local demo
IO_NET_API_KEY=your_io_net_api_key
IO_NET_CONTAINER_IMAGE_US=your-user/rtvf-video-server:latest
IO_NET_CONTAINER_IMAGE_IN=your-user/rtvf-video-server:latest

# For local testing with the Python video server running on localhost:
IO_NET_ENDPOINT_US=http://localhost:8000/
IO_NET_ENDPOINT_IN=http://localhost:8000/
```

**`rtvf Video Server/.env`** (injected into the Docker container at runtime):

```env
STORAGE_ENDPOINT=https://<project-ref>.supabase.co/storage/v1/s3
STORAGE_ACCESS_KEY=your_supabase_s3_access_key
STORAGE_SECRET_KEY=your_supabase_s3_secret_key
STORAGE_REGION=ap-south-1
STORAGE_BUCKET=your_bucket_name
SUPABASE_PROJECT_URL=https://<project-ref>.supabase.co
NEWSDATA_API_KEY=your_newsdata_api_key
```

**`apps/web/.env.local`** (Next.js only — auth credentials must live here):

```env
AUTH_SECRET=your_auth_secret
AUTH_GOOGLE_ID=your_google_oauth_client_id
AUTH_GOOGLE_SECRET=your_google_oauth_client_secret
```

### 3. Run the Application (Local Demo)

```bash
npm run dev
```

Starts:
- Express API on `http://localhost:3001`
- Next.js frontend on `http://localhost:3000`

For video generation to work locally, also run the Python server:

```bash
cd "rtvf Video Server"
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

> The Python server downloads the LTX-Video model (~20 GB) on first run. Set `MOCK_MODE=true` to skip model loading and return a dummy video for UI testing.

### 4. Deploy the Video Server to io.net (Production)

```bash
cd "rtvf Video Server"
docker build -t your-user/rtvf-video-server:latest .
docker push your-user/rtvf-video-server:latest
```

Set `IO_NET_API_KEY`, `IO_NET_CONTAINER_IMAGE_US`, and `IO_NET_CONTAINER_IMAGE_IN` in the root `.env`. The MCP agent will provision and teardown GPU containers automatically based on user activity.

## Architecture Notes

### MCP Agent — Autonomous GPU Fleet Manager
`services/agents/mcpAgent.js` polls every 3 minutes and asks a Groq LLM to decide the optimal action (`PROVISION`, `TEARDOWN`, `KEEP`, or `PRE_PROVISION`) for each region (US, IN) based on idle time, ping history, and predicted activity probabilities derived from 7 days of rolling history. Hard safety rules prevent teardown within 2 minutes of last activity. Teardowns use the io.net REST API directly (no MCP teardown tool exists yet).

### Feed Generation Pipeline
1. Client POSTs `{ topic, mode, sentimentProfile }` to `POST /api/feed/generate`
2. Express detects user region via GeoIP, optionally fetches a live news article (news mode), then calls Groq to build an LTX-Video prompt + display caption — streamed back via SSE
3. Client simultaneously POSTs `POST /api/video/generate` which routes to the correct regional GPU endpoint via the MCP routing table (or static `.env` fallback)
4. Python server enriches the prompt further with Google Trends RSS data local to that GPU node's physical location, then runs LTX-Video
5. Generated `.mp4` is uploaded to Supabase Storage; public URL is returned to the client
6. Client polls `GET /api/video/status/:jobId` until complete, then renders the `VideoCard`

### AI-Curated Trending Topics
The `/api/trending` endpoint calls Groq directly with today's date and the user's detected country to generate 20 diverse, time-aware trending topics (no external news API call required). Results are cached per-country for 5 minutes on the server and 15 minutes at the Next.js route layer. The UI rotates through a window of 6 topics every 10 seconds client-side without re-fetching.

### Sentiment-Driven Personalisation
`services/sentiment.js` maintains a profile of weighted scores across topics, visual styles, content depth, and pacing using an exponential moving average (α = 0.15). Engagement signals (watch time, replays, likes, saves, early scrolls) update scores silently. The profile is seeded from onboarding choices and stored in `localStorage` — suitable for single-device demo use.

### Geographic Node Routing
`services/video.js` maps country codes to regions (IN for Asia, US for everything else). It first checks the live MCP routing table for an active container endpoint, then falls back to static `IO_NET_ENDPOINT_US/IN` env vars. Job-to-endpoint mappings are stored in memory with a 2-hour TTL to prevent unbounded growth.

### Supabase Storage
Generated videos are uploaded via the S3-compatible Supabase Storage API from inside the Docker container. Public URLs follow the pattern `{SUPABASE_PROJECT_URL}/storage/v1/object/public/{bucket}/{job_id}.mp4`.

---

**Status:** Demo-ready. GPU deployment requires `IO_NET_API_KEY` + Docker image push to activate the MCP agent fleet manager.
