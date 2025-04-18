#!/bin/bash

REPO_PATH="$1"
BRANCH="$2"
PROCESS_NAME="$3"
IS_BACKEND="$4"

echo "Starting deployment for $REPO_PATH [$BRANCH]..."

cd "$REPO_PATH" || {
  echo "Directory not found: $REPO_PATH"
  exit 1
}

# Ensure we're on the correct branch
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

# Clean install
npm ci

if [ "$IS_BACKEND" = "true" ]; then
  echo "Detected backend project - running Prisma commands..."
  npm run prisma:generate
  npm run prisma:migrate:deploy
fi

# Build and restart
npm run build
pm2 restart "$PROCESS_NAME"

echo "Deployment finished."
