# RTVLF — Real-Time Visual Learning Feed

An AI-powered infinite feed of short-form educational and entertaining content. Each card is generated fresh in real-time using Groq's Llama model — nothing is pre-stored.

**Phase 1 Features:**
- Text-only feed with learn/entertain modes
- Real-time card generation via Groq API
- Automatic infinite scrolling
- Session-aware history to prevent concept repetition
- SSE streaming for responsive UI

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React 18
- **Backend:** Node.js + Express
- **LLM:** Groq API (llama-3.3-70b-versatile)
- **Streaming:** Server-Sent Events (SSE)

## Project Structure

```
rtvlf/
├── apps/
│   ├── api/           # Express backend
│   │   ├── server.js
│   │   └── package.json
│   └── web/           # Next.js frontend
│       ├── app/
│       ├── components/
│       └── package.json
├── services/
│   └── llm.js         # LLM abstraction layer (Groq now, io.net in Phase 4)
├── package.json       # Root workspace config
├── .env.example       # Environment variable template
└── README.md
```

## Getting Started

### 1. Clone and Install

```bash
cd rtvlf
npm install
```

### 2. Set Up Environment

Copy `.env.example` to `.env` and add your Groq API key:

```bash
cp .env.example .env
```

Then edit `.env`:

```
GROQ_API_KEY=your_actual_groq_api_key
```

Get a free Groq API key at [console.groq.com](https://console.groq.com).

### 3. Run Both Apps

```bash
npm run dev
```

This runs the backend on `http://localhost:3001` and frontend on `http://localhost:3000` concurrently.

### 4. Start Generating

- Open `http://localhost:3000` in your browser
- Enter a topic (e.g., "quantum computing")
- Toggle between "Learn" and "Entertain" modes
- Watch cards stream in real-time
- Scroll to auto-load more cards

## API Reference

### POST `/api/feed/generate`

Generate a single feed card and stream the response via SSE.

**Request:**
```json
{
  "topic": "climate change",
  "mode": "learn",
  "history": ["Previous card summary 1", "Previous card summary 2"]
}
```

**Response:** Server-Sent Events stream
```
data: {"chunk": "You are on a planet..."}
data: {"chunk": "with a delicate..."}
...
data: {"done": true}
```

## Architecture Notes

### Why `services/llm.js`?

All LLM calls go through a single abstraction layer in `services/llm.js`. This means:
- **Phase 1:** Groq API (now)
- **Phase 4:** Swap to io.net Llama 3 with zero changes to the rest of the codebase

Never call any AI API directly from routes or components.

### History & Repetition Prevention

Each card request includes a `history` array of previous card summaries. The system prompt uses this to ensure the model never repeats concepts in a session.

### Mode as First-Class Citizen

The `mode` parameter ("learn" or "entertain") is passed:
- Through the API request
- To the system prompt
- Eventually to user profiles (Phase 2)

This ensures consistent behavior across the app.

## Development Guide

**Backend:**
- Edit `apps/api/server.js` for routes
- Edit `services/llm.js` for LLM logic
- Restart with `npm run dev`

**Frontend:**
- Edit `apps/web/app/page.js` for main feed logic
- Edit `apps/web/components/` for UI components
- Hot-reload happens automatically

## What's Next?

**Phase 2:** Add PostgreSQL user profiles and embeddings-based memory with pgvector.

**Phase 3:** Transform text cards into visual content with SVG diagrams and DALL-E images.

**Phase 4:** Replace Groq with open-source Llama 3 on io.net GPU infrastructure, add BullMQ worker queue and Redis caching.

**Phase 5:** Voice I/O, mid-scroll follow-up questions, knowledge graphs, and curriculum mode.

---

**Status:** Phase 1 — Core loop working end-to-end ✅
