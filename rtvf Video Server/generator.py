import os
os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "0"

import time
import torch
import tempfile
import subprocess
from diffusers import LTXConditionPipeline
from diffusers.utils import export_to_video

MOCK_MODE = os.getenv("MOCK_MODE", "false").lower() == "true"

MODEL_DIR = "/app/models/ltx"
MODEL_ID  = "Lightricks/LTX-Video-0.9.8-13B-distilled"

# Frame rules: must be (N × 8) + 1
# 15s at 30fps = 450 frames → nearest valid = 449 (56×8 + 1)
NUM_FRAMES = 257   # ~8.5s — safe max for A100 at this resolution
WIDTH      = 704
HEIGHT     = 480
FPS        = 30

model_ready = False
pipe = None

def load_model():
    """Download and load the LTX model into GPU VRAM.
    Called once from main.py lifespan in a background thread so uvicorn
    can start accepting connections (and serve /health → 503) immediately.
    """
    global pipe, model_ready

    if MOCK_MODE:
        model_ready = True
        print("⚠️ MOCK MODE — model loading skipped")
        return

    if not os.path.exists(MODEL_DIR) or not os.listdir(MODEL_DIR):
        os.makedirs(MODEL_DIR, exist_ok=True)

    from huggingface_hub import snapshot_download

    for attempt in range(1, 4):
        try:
            print(f"⏳ Downloading model (attempt {attempt}/3) — resumes from partial progress...")
            snapshot_download(MODEL_ID, local_dir=MODEL_DIR)
            print("✅ Download complete")
            break
        except Exception as e:
            print(f"❌ Download attempt {attempt}/3 failed: {e}")
            if attempt == 3:
                raise RuntimeError("Model download failed after 3 attempts. Container will exit.") from e
            wait = 30 * attempt  # 30s, 60s
            print(f"⏳ Retrying in {wait}s...")
            time.sleep(wait)

    print("⏳ Loading model into GPU VRAM...")
    pipe = LTXConditionPipeline.from_pretrained(
        MODEL_DIR,
        torch_dtype=torch.bfloat16,
    )
    pipe.to("cuda")
    pipe.vae.enable_tiling()
    model_ready = True
    print("✅ Model ready.")


def generate_video(prompt: str) -> str:
    if MOCK_MODE:
        if not os.path.exists("/tmp/mock.mp4"):
            subprocess.run([
                "ffmpeg", "-f", "lavfi",
                "-i", "color=black:size=704x480:duration=2",
                "-r", "30", "/tmp/mock.mp4"
            ])
        return "/tmp/mock.mp4"

    result = pipe(
        prompt=prompt,
        negative_prompt=(
            "worst quality, inconsistent motion, blurry, jittery, "
            "distorted, static, frozen, ugly, watermark, text"
        ),
        num_frames=NUM_FRAMES,
        width=WIDTH,
        height=HEIGHT,
        num_inference_steps=8,      # distilled = 8 steps
        guidance_scale=3.0,
        generator=torch.Generator("cuda").manual_seed(
            torch.randint(0, 2**32, (1,)).item()
        ),
    )

    tmp = tempfile.NamedTemporaryFile(
        suffix=".mp4", delete=False, dir="/tmp"
    )
    export_to_video(result.frames[0], tmp.name, fps=FPS)
    return tmp.name