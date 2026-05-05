import asyncio
import uuid
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import generator
from storage import upload_video
from context_agent import enrich_prompt  # ← CHANGE 1: import

jobs: dict = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 RTVLF Video Server ready")
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
    return {"status": "ok", "model": "ltxv-0.9.8-13b-distilled"}

@app.post("/generate")
async def generate(req: GenerateRequest):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "pending", "videoUrl": None}

    # ← CHANGE 3: enrich prompt before passing to generator
    enriched = enrich_prompt(
        base_prompt=req.prompt,
        topic=req.topic,
        user_region=req.user_region,
        mode=req.mode,
        news_article=req.news_article
    )

    asyncio.create_task(run_generation(job_id, enriched))
    return {"jobId": job_id}

@app.get("/status/{job_id}")
def get_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"status": job["status"], "videoUrl": job.get("videoUrl")}

async def run_generation(job_id: str, prompt: str):
    jobs[job_id]["status"] = "processing"
    try:
        print(f"[{job_id}] Generating...")
        path = await asyncio.to_thread(
            generator.generate_video, prompt
        )
        print(f"[{job_id}] Uploading...")
        url = await asyncio.to_thread(upload_video, path, job_id)
        jobs[job_id] = {"status": "complete", "videoUrl": url}
        print(f"[{job_id}] Done → {url}")
    except Exception as e:
        traceback.print_exc()
        jobs[job_id]["status"] = "failed"