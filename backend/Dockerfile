# FastAPI backend: OCR + local LLM. Build context is the repository root (see docker-compose.yml).
# The AI models are NOT baked in; compose mounts ./backend/models read-only.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HUB_OFFLINE=1

# libgomp1: OpenMP for PyTorch on CPU; libglib2.0-0: needed by OpenCV (pulled in by EasyOCR).
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# CPU-only PyTorch first: the default Linux wheels add GBs of GPU libraries we don't use.
RUN pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt

COPY backend/ backend/

RUN useradd --system --uid 10001 --home-dir /app app && chown -R app /app
USER app

EXPOSE 8000
# One worker: the models load into memory once and inference runs one image at a time.
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
