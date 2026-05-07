FROM nvidia/cuda:12.2.2-cudnn8-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y \
    python3.10 python3-pip ffmpeg git wget \
    && rm -rf /var/lib/apt/lists/*

RUN ln -sf /usr/bin/python3.10 /usr/bin/python3 && \
    ln -sf /usr/bin/python3.10 /usr/bin/python

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY main.py generator.py storage.py context_agent.py ./

EXPOSE 8000

# Runtime secrets must be passed as environment variables at container start.
# Do NOT hardcode API keys here — pass them via the caas_deploy_container env field.

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]