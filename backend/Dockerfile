# FastAPI backend: OCR + local LLM. Build context is the repository root (see docker-compose.yml).
# The AI models in backend/models/ are baked in (~1.1 GB): copy them here before building.
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

RUN useradd --system --uid 10001 --home-dir /app app && chown app /app
# --chown on the copy: a separate chown -R would duplicate the 1 GB of models in another layer.
COPY --chown=app backend/ backend/
USER app

ENV BACKEND_PORT=8000
EXPOSE 8000
# One worker: the models load into memory once and inference runs one image at a time.
# Shell form so BACKEND_PORT from .env applies; exec keeps uvicorn as PID 1 for clean stops.
CMD exec uvicorn backend.main:app --host 0.0.0.0 --port "$BACKEND_PORT" --workers 1
