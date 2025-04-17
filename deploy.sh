#!/bin/bash

REPO_PATH="$1"
BRANCH="$2"
PROCESS_NAME="$3"

echo "Starting deployment for $REPO_PATH [$BRANCH]..."

cd "$REPO_PATH" || {
  echo "Directory not found: $REPO_PATH"
  exit 1
}

# Make sure we are on the right branch
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

npm install
npm run build

pm2 restart "$PROCESS_NAME"

echo "Deployment finished."
