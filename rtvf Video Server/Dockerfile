FROM nvidia/cuda:12.2.2-cudnn8-runtime-ubuntu22.04

# Stream Python logs immediately (no buffering)
# Set a stable model cache dir so HuggingFace weights persist to a known path
ENV PYTHONUNBUFFERED=1 \
    HF_HOME=/app/models

RUN apt-get update && apt-get install -y \
    python3.10 python3-pip ffmpeg curl \
    && rm -rf /var/lib/apt/lists/*

RUN ln -sf /usr/bin/python3.10 /usr/bin/python3 && \
    ln -sf /usr/bin/python3.10 /usr/bin/python

WORKDIR /app
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip --default-timeout=100 && \
    pip install --default-timeout=100 -r requirements.txt

# Set after pip install so changing this doesn't bust the pip cache layer
ENV HF_HUB_ENABLE_HF_TRANSFER=0

COPY main.py generator.py storage.py context_agent.py ./

EXPOSE 8000

# Runtime secrets must be passed as environment variables at container start.
# Do NOT hardcode API keys here — pass them via the caas_deploy_container env field.

# /health returns 503 until the LTX-Video model finishes loading (~2-5 min on GPU).
# start-period gives the model time to load before health checks can fail the container.
HEALTHCHECK --interval=60s --timeout=10s --start-period=900s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]