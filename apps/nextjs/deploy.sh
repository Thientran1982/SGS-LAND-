#!/bin/bash
# ─── SGS LAND Deploy Script ─────────────────────────────────────────
# Chạy trên server VPS: bash deploy.sh
# Yêu cầu: Node.js 20+, npm, PM2 đã cài trên server
set -e  # Exit on error
APP_DIR="/var/www/sgsland-nextjs"
REPO_URL="https://github.com/Thientran1982/sgsland-nextjs.git"
BRANCH="main"
echo ""
echo "🚀 SGS LAND — Deploy bắt đầu..."
echo "📁 App dir: $APP_DIR"
echo ""
# ── 1. Pull code ─────────────────────────────────────────────────────
if [ -d "$APP_DIR/.git" ]; then
    echo "📥 Pulling latest code from GitHub..."
    cd "$APP_DIR"
    git pull origin "$BRANCH"
else
    echo "📥 Cloning repository..."
    git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi
# ── 2. Install dependencies ──────────────────────────────────────────
echo "📦 Installing dependencies..."
npm ci --production=false
# ── 3. Build ─────────────────────────────────────────────────────────
echo "🔨 Building Next.js..."
npm run build
# ── 4. PM2 restart ───────────────────────────────────────────────────
echo "🔄 Restarting PM2..."
if pm2 list | grep -q "sgsland-nextjs"; then
    pm2 reload ecosystem.config.js --env production
else
    pm2 start ecosystem.config.js --env production
fi
pm2 save
# ── 5. Done ──────────────────────────────────────────────────────────
echo ""
echo "✅ Deploy hoàn thành!"
echo "🌐 Website: https://sgsland.vn"
echo ""
pm2 status sgsland-nextjs