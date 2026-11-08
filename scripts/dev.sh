#!/usr/bin/env bash
# Starts backend (8000) and frontend (5173) for local development.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v ffmpeg >/dev/null || { echo "FFmpeg is required (see README)"; exit 1; }
(cd backend && python -m pip install -q -r requirements.txt && python -m uvicorn app.main:app --reload --port 8000) &
BACK=$!
trap 'kill $BACK 2>/dev/null' EXIT
(cd frontend && npm install --no-audit --no-fund && npm run dev)
