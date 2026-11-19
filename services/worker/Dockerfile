# TensorLM ingestion worker. Build from the REPO ROOT (the image needs contracts/ingestion.json):
#   docker build -f services/worker/Dockerfile -t tensorlm-worker .
#
# - Multi-stage: build tools and pip caches stay in the builder.
# - CPU-only torch (no CUDA wheels), every dependency pinned in requirements.txt.
# - Docling layout/table models and RapidOCR models are downloaded at BUILD time and the
#   container runs with HF_HUB_OFFLINE=1, so nothing is downloaded at run time.
# - Runs as an unprivileged user; HEALTHCHECK hits /health (use /ready for traffic readiness).

FROM python:3.12-slim AS builder
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python -m venv /opt/venv
ENV PATH=/opt/venv/bin:$PATH
COPY services/worker/requirements.txt /tmp/requirements.txt
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch==2.15.0 torchvision==0.29.2 \
 && pip install -r /tmp/requirements.txt
RUN docling-tools models download -o /opt/docling-models layout tableformer rapidocr

FROM python:3.12-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 curl \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --uid 10001 worker
COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /opt/docling-models /opt/docling-models
ENV PATH=/opt/venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    DOCLING_ARTIFACTS_PATH=/opt/docling-models \
    HF_HUB_OFFLINE=1 \
    INGESTION_CONTRACT_PATH=/app/contracts/ingestion.json \
    OMP_NUM_THREADS=2
WORKDIR /app
COPY contracts/ingestion.json /app/contracts/ingestion.json
COPY services/worker/app /app/app
USER worker
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT:-8000}/health" || exit 1
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --timeout-keep-alive 75"]
