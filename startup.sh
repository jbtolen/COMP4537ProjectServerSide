#!/bin/bash
set -e
echo "---- Azure Startup Script (force pip install) ----"

cd /home/site/wwwroot || cd /home/site

# --- Ensure pip exists ---
if ! python3 -m pip --version &> /dev/null; then
  echo "⚙️ Installing pip manually..."
  curl -sS https://bootstrap.pypa.io/get-pip.py -o get-pip.py
  python3 get-pip.py --user
fi

# --- Install Python dependencies globally ---
if [ -f "requirements.txt" ]; then
  echo "Installing Python dependencies (with override)..."
  python3 -m pip install --upgrade pip --user --break-system-packages
  python3 -m pip install -r requirements.txt --user --break-system-packages
else
  echo "⚠️ No requirements.txt found."
fi

# --- Start Node.js server ---
echo "---- Starting Node.js server ----"
npm start
