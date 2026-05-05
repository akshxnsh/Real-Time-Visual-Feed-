import torch
import tempfile
import os
from diffusers import LTXConditionPipeline
from diffusers.utils import export_to_video

MODEL_ID = "Lightricks/LTX-Video-0.9.8-13B-distilled"

# Frame rules: must be (N × 8) + 1
# 15s at 30fps = 450 frames → nearest valid = 449 (56×8 + 1)
NUM_FRAMES = 257   # ~8.5s — safe max for A100 at this resolution
WIDTH      = 704
HEIGHT     = 480
FPS        = 30

print("⏳ Loading LTX-Video 0.9.8-13B-distilled...")
pipe = LTXConditionPipeline.from_pretrained(
    MODEL_ID,
    torch_dtype=torch.bfloat16,
)
pipe.to("cuda")
pipe.vae.enable_tiling()
print("✅ Model ready.")


def generate_video(prompt: str) -> str:
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