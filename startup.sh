#!/usr/bin/env bash
set -e

# 1) Create a persistent venv under /home/site (survives restarts)
if [ ! -d "/home/site/venv" ]; then
  echo "🧪 Creating Python venv..."
  python3 -m venv /home/site/venv
fi

# 2) Activate venv and install Python deps
source /home/site/venv/bin/activate
python --version
pip install --upgrade pip
pip install -r requirements.txt

# 3) Start Node app (runs under this shell, so venv stays active)
echo "🚀 Starting Node server..."
npm start
