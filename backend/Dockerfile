FROM python:3.11-slim AS base

# Reduce image size / don't write .pyc files
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

#  System deps 
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

#  Python deps 
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

#  App source 
COPY app/ ./app/

#  Non-root user 
RUN addgroup --system anon && adduser --system --ingroup anon anon
USER anon

#  Run 
# Secrets injected at runtime via .env or platform env vars - never baked in
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]