FROM python:3.11-slim

WORKDIR /workspace

# Install system dependencies needed for compiling python packages (e.g. pgvector, psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependencies first to leverage Docker layer caching
COPY backend/requirements.txt /workspace/backend/requirements.txt
RUN pip install --no-cache-dir -r /workspace/backend/requirements.txt

# Copy source code
COPY backend /workspace/backend

ENV PYTHONPATH=/workspace

# Build-time smoke test: fail immediately if any dependency or app module fails to import
RUN python -c "from backend.app.main import app; print('FinSight app loaded cleanly during image build')"

EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
