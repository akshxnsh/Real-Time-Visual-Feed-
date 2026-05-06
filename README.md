# RTVF — Real-Time Visual Feed

An AI-powered infinite feed of short-form educational, entertaining, and live news content. The platform dynamically routes video generation tasks to regional GPU nodes (io.net) and provides a highly contextualized scroll experience powered by Groq and real-time news data.

## Features

- **Multi-Mode Feed:** Toggle seamlessly between `LEARN`, `ENTERTAIN`, and `LIVE NEWS` modes.
- **Geographic GPU Routing:** Automatically routes video generation workloads to specific io.net nodes (e.g., US vs. India) based on the user's region for optimized latency.
- **Stateful Polling:** The Express backend maintains state to track which regional GPU node generated which video job, ensuring reliable polling.
- **Contextual Video Enrichment:** The Python video backend uses `pytrends` and geographic data to inject local trends into the video generation prompts.
- **Live News Mode:** Fetches breaking news via the NewsData API and formats it into digestible feed cards.
- **Intelligent Trending Section:** Scrapes live breaking news headlines and uses Groq (LLM) to intelligently extract and format the top overarching trending topics into the UI.
- **Graceful Fallbacks:** Seamlessly falls back to text-only streaming cards if GPU nodes are temporarily offline.

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React 18, Tailwind CSS
- **API Backend:** Node.js + Express
- **Video Backend:** Python + FastAPI + ComfyUI
- **LLM Engine:** Groq API (`llama-3.3-70b-versatile`)
- **News Engine:** NewsData API
- **Infrastructure:** io.net GPU Cloud

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
├── rtvlf Video Server/      # Python GPU Worker Node Code
│   ├── main.py              # FastAPI server handling ComfyUI video jobs
│   ├── context_agent.py     # Geographic trend enrichment (pytrends)
│   └── requirements.txt
├── services/
│   ├── llm.js               # Groq integrations (Card Generation, Trend Extraction)
│   ├── news.js              # NewsData API integration
│   └── video.js             # Regional GPU routing logic
├── .env.example             # Environment variable template
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

# Production GPU Nodes (io.net)
IO_NET_ENDPOINT_US=http://<US_NODE_IP>:8000/
IO_NET_ENDPOINT_IN=http://<INDIA_NODE_IP>:8000/
```

### 3. Deploying the Python Video Servers (Optional)
If you want to run the video generation pipeline, you need to deploy the `rtvf Video Server` folder to your GPU instances:
```bash
cd "rtvf Video Server"
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```
*(Make sure to update your `.env` file with the public IPs of these instances).*

### 4. Run the Web Application

```bash
npm run dev
```

This starts the Express backend on `http://localhost:3001` and the Next.js frontend on `http://localhost:3000`.

## Architecture Notes

### Intelligent Trending Extraction
The UI's trending chips are powered entirely by live data. The Node backend fetches breaking news headlines using `NewsData API`, and then passes them to `Groq`. The LLM intelligently parses the headlines, identifies the overarching global narratives, and returns a formatted JSON array to the frontend.

### Geographic Node Routing
Video requests hit the Express backend first. The `services/video.js` module looks at the user's `timezone` or `countryCode` and dynamically routes the request to either the US GPU node (`IO_NET_ENDPOINT_US`) or the India GPU node (`IO_NET_ENDPOINT_IN`). The backend maps the resulting `jobId` to the specific node in memory so that subsequent polling requests query the correct physical machine.

---

**Status:** Ready for Production GPU Deployment ✅
