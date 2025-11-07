#!/bin/bash
set -e
echo "---- Azure Startup Script (safe venv creation) ----"

cd /home/site/wwwroot || cd /home/site

# --- Ensure Python3 exists ---
python3 -V || echo "⚠️ Python3 not found!"

# --- Create virtual environment if missing ---
if [ ! -d "venv" ]; then
  echo "📦 Creating virtual environment..."
  python3 -m venv venv
fi

# --- Double-check that it was created ---
if [ ! -f "venv/bin/activate" ]; then
  echo "⚠️ venv activation script not found, retrying..."
  rm -rf venv
  python3 -m venv venv
fi

# --- Activate the venv safely ---
if [ -f "venv/bin/activate" ]; then
  source venv/bin/activate
else
  echo "❌ Could not find venv/bin/activate even after retry."
  exit 1
fi

# --- Install pip if missing ---
if ! python -m pip --version &> /dev/null; then
  echo "⚙️ Installing pip into venv..."
  curl -sS https://bootstrap.pypa.io/get-pip.py -o get-pip.py
  python get-pip.py
fi

# --- Install dependencies ---
if [ -f "requirements.txt" ]; then
  echo "📦 Installing Python dependencies..."
  pip install --upgrade pip
  pip install -r requirements.txt
else
  echo "⚠️ No requirements.txt found!"
fi

# --- Start Node.js app ---
echo "---- Starting Node.js server ----"
npm start
