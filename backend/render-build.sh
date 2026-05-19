#!/bin/bash
# render-build.sh — runs during Render build
set -e

echo "📦 Installing dependencies..."
npm install

echo "🗄️ Running database setup..."
node db/schema-init.js

echo "✅ Build complete"
