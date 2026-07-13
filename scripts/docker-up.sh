#!/bin/bash
set -e

echo "🚀 Subindo serviços SoundMeet..."
DOCKER_BUILDKIT=1 docker compose up -d --build
echo "✅ Serviços iniciados!"
