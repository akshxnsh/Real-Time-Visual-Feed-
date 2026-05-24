import asyncio
import uuid
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import generator
from storage import upload_video
from context_agent import enrich_prompt

jobs: dict = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 RTVF Video Server ready")
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class GenerateRequest(BaseModel):
    prompt: str
    mode: str = "learn"
    topic: str = ""
    user_region: str = "US"
    news_article: dict = None

@app.get("/health")
def health():
    if not generator.model_ready:
        raise HTTPException(status_code=503, detail="Model still loading")
    return {"status": "ok", "model": "ltxv-0.9.8-13b-distilled"}

@app.post("/generate")
async def generate(req: GenerateRequest):
    if req.mode not in ("learn", "entertain", "news"):
        raise HTTPException(status_code=400, detail='mode must be "learn", "entertain" or "news"')

    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "pending", "videoUrl": None, "error": None}

    # Enrichment (calls pytrends + NewsData.io) runs inside the background task
    # so /generate returns the jobId immediately without blocking on HTTP calls
    asyncio.create_task(run_generation(job_id, req))
    return {"jobId": job_id}

@app.get("/status/{job_id}")
def get_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "status": job["status"],
        "videoUrl": job.get("videoUrl"),
        "error": job.get("error"),
    }

async def run_generation(job_id: str, req: GenerateRequest):
    jobs[job_id]["status"] = "processing"
    try:
        print(f"[{job_id}] Enriching prompt...")
        enriched = await asyncio.to_thread(
            enrich_prompt,
            base_prompt=req.prompt,
            topic=req.topic,
            user_region=req.user_region,
            mode=req.mode,
            news_article=req.news_article,
        )
        print(f"[{job_id}] Generating video...")
        path = await asyncio.to_thread(generator.generate_video, enriched)
        print(f"[{job_id}] Uploading...")
        url = await asyncio.to_thread(upload_video, path, job_id)
        jobs[job_id] = {"status": "complete", "videoUrl": url, "error": None}
        print(f"[{job_id}] Done → {url}")
    except Exception as e:
        traceback.print_exc()
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)