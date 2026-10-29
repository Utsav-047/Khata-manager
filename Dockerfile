# Multi-stage production build for Khata Management System

# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Python FastAPI production server
FROM python:3.11-slim
WORKDIR /app

# System dependencies for PyMySQL and Cryptography
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    default-mysql-client \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt \
    && pip install --no-cache-dir gunicorn

COPY backend/ ./backend/
COPY --from=frontend-builder /app/client/dist ./client/dist

ENV APP_ENV=production
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["gunicorn", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "backend.app.main:app"]

