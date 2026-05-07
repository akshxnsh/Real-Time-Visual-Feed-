# RTVLF — Real-Time Visual Learning Feed

An AI-powered infinite feed of short-form educational, entertaining, and live news content. The platform dynamically routes video generation tasks to regional GPU nodes (io.net) via MCP agent integration and provides a highly contextualized scroll experience powered by Groq and real-time news data.

## Features

- **Multi-Mode Feed:** Toggle seamlessly between `LEARN`, `ENTERTAIN`, and `LIVE NEWS` modes.
- **Geographic GPU Routing:** Automatically routes video generation workloads to specific io.net nodes (e.g., US vs. India) based on the user's region for optimized latency.
- **MCP Agent Integration:** Uses io.net's MCP (Model Context Protocol) agent for dynamic GPU container management, including cold start/teardown and regional node selection.
- **Stateful Polling:** The Express backend maintains state via `activityTracker.js` to track which regional GPU node generated which video job, ensuring reliable polling and persistence to `data/activity.json`.
- **Contextual Video Enrichment:** The Python video backend uses `pytrends` and geographic data to inject local trends into the video generation prompts.
- **Live News Mode:** Fetches breaking news via the NewsData API and formats it into digestible feed cards.
- **Intelligent Trending Section:** Scrapes live breaking news headlines and uses Groq (LLM) to intelligently extract and format the top overarching trending topics into the UI.
- **Graceful Fallbacks:** Seamlessly falls back to text-only streaming cards if GPU nodes are temporarily offline.
- **User Onboarding:** Planned Firebase Auth integration with Firestore for user sign-in, username/topics selection, and age/gender collection.

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React 18, Tailwind CSS
- **API Backend:** Node.js + Express
- **Video Backend:** Python + FastAPI + LTX-Video
- **LLM Engine:** Groq API (`llama-3.3-70b-versatile`)
- **News Engine:** NewsData API
- **Storage:** Cloudflare R2
- **Auth:** Firebase Auth + Firestore (planned)
- **Infrastructure:** io.net GPU Cloud with MCP agent, Docker (brocode27/rtvf-video-server)

## Project Structure

```
rtvlf/
├── apps/
│   ├── api/                 # Express backend (Routing, WebSockets, State Management)
│   │   ├── routes/          # Video & News API Routes
│   │   ├── server.js        # Entry point
│   │   └── package.json
│   └── web/                 # Next.js frontend (UI, Streaming, Feed Logic)
│       ├── app/
│       ├── components/
│       ├── lib/
│       └── package.json
├── rtvf Video Server/       # Python GPU Worker Node Code
│   ├── main.py              # FastAPI server handling LTX-Video jobs
│   ├── context_agent.py     # Geographic trend enrichment (pytrends)
│   ├── generator.py         # Video generation logic
│   ├── storage.py           # Cloudflare R2 integration
│   ├── Dockerfile           # Docker build for brocode27/rtvf-video-server
│   └── requirements.txt
├── services/
│   ├── agents/
│   │   └── mcpAgent.js      # io.net MCP agent integration for GPU management
│   ├── activityTracker.js   # Stateful polling and activity persistence
│   ├── llm.js               # Groq integrations (Card Generation, Trend Extraction)
│   ├── news.js              # NewsData API integration
│   ├── sentiment.js         # Sentiment analysis for personalization
│   └── video.js             # Regional GPU routing logic
├── components/              # Shared UI components
├── data/                    # Persistent data (activity.json, etc.)
├── .env.example             # Environment variable template
├── .gitignore               # Git ignore rules (includes data/)
└── package.json             # Root workspace config
```

## Getting Started

### 1. Clone and Install Dependencies

```bash
git clone <repository_url>
cd "Real TIme Visual Feed"

# Install Node.js dependencies
npm install
cd apps/api && npm install
cd ../web && npm install
```

### 2. Set Up Environment Variables

Copy `.env.example` to `.env` in the root directory:

```bash
cp .env.example .env
```

Edit the `.env` file with your actual keys:
```env
GROQ_API_KEY=your_groq_api_key
NEWSDATA_API_KEY=your_newsdata_api_key
NEXT_PUBLIC_API_URL=http://localhost:3001

# io.net MCP Configuration
IO_NET_CONTAINER_IMAGE_US=brocode27/rtvf-video-server:latest
IO_NET_CONTAINER_IMAGE_IN=brocode27/rtvf-video-server:latest

# Cloudflare R2 Storage
CLOUDFLARE_R2_ACCESS_KEY_ID=your_r2_access_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_r2_secret_key
CLOUDFLARE_R2_ENDPOINT=your_r2_endpoint
CLOUDFLARE_R2_BUCKET=your_r2_bucket

# Firebase Auth (planned)
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
```

### 3. Deploying the Python Video Servers (Optional)
If you want to run the video generation pipeline, you can build and push the Docker image:
```bash
cd "rtvf Video Server"
docker build -t brocode27/rtvf-video-server:latest .
docker push brocode27/rtvf-video-server:latest
```
Then deploy to io.net GPU nodes via MCP agent. The MCP agent handles container deployment, cold starts, and teardowns dynamically.

### 4. Run the Web Application

```bash
npm run dev
```

This starts the Express backend on `http://localhost:3001` and the Next.js frontend on `http://localhost:3000`.

## Architecture Notes

### MCP Agent Integration
The platform integrates with io.net's MCP agent for intelligent GPU container management. The `services/agents/mcpAgent.js` module communicates with the MCP server to deploy containers on-demand, route requests to regional nodes (US/IN), and handle lifecycle management including cold starts and teardowns.

### Stateful Activity Tracking
`services/activityTracker.js` maintains persistent state of video generation jobs, mapping job IDs to regional nodes and storing activity data in `data/activity.json` for reliable polling and analytics.

### Intelligent Trending Extraction
The UI's trending chips are powered entirely by live data. The Node backend fetches breaking news headlines using `NewsData API`, and then passes them to `Groq`. The LLM intelligently parses the headlines, identifies the overarching global narratives, and returns a formatted JSON array to the frontend.

### Geographic Node Routing
Video requests hit the Express backend first. The `services/video.js` module looks at the user's `timezone` or `countryCode` and dynamically routes the request via MCP agent to either the US GPU node or the India GPU node. The backend maps the resulting `jobId` to the specific node in memory so that subsequent polling requests query the correct physical machine.

### Cloudflare R2 Storage
Generated videos are stored in Cloudflare R2 for efficient, global distribution with low latency.

---

**Status:** Ready for Production GPU Deployment with MCP Agent ✅
