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

COPY main.py generator.py storage.py context_agent.py ./  # ← CHANGE 1

EXPOSE 8000

ENV NEWS_API_KEY="pub_b72d3e5def0f468fad31c80b2b76b8ad"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]