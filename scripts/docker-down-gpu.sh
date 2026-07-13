#!/bin/bash
set -e

docker compose --profile gpu down --remove-orphans
