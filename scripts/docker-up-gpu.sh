#!/bin/bash
set -e

echo "🚀 Subindo SoundMeet com AI Cifra Worker GPU (modelo 8 épocas)..."
DOCKER_BUILDKIT=1 docker compose --profile gpu up -d --build
echo "✅ Serviços iniciados! Worker GPU: http://localhost:8002/health"
