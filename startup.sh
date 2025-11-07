#!/bin/bash
set -e
echo "---- Azure Startup Script (with local venv) ----"

cd /home/site/wwwroot || cd /home/site

# --- Ensure Python3 exists ---
python3 -V || echo "⚠️ Python3 not found!"

# --- Create a local venv if missing ---
if [ ! -d "venv" ]; then
  echo "📦 Creating new virtual environment..."
  python3 -m venv venv
fi

# --- Activate venv ---
source venv/bin/activate

# --- Ensure pip is available inside venv ---
if ! python -m pip --version &> /dev/null; then
  echo "⚙️ Installing pip into venv..."
  curl -sS https://bootstrap.pypa.io/get-pip.py -o get-pip.py
  python get-pip.py
fi

# --- Install dependencies into venv ---
if [ -f "requirements.txt" ]; then
  echo "Installing Python dependencies in venv..."
  pip install --upgrade pip
  pip install -r requirements.txt
else
  echo "⚠️ No requirements.txt found!"
fi

# --- Start Node.js app ---
echo "---- Starting Node.js server ----"
npm start
