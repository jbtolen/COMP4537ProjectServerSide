#!/bin/bash
set -e
echo "---- Azure Startup Script (install pip manually) ----"

cd /home/site/wwwroot || cd /home/site

# --- Ensure pip exists ---
if ! python3 -m pip --version &> /dev/null; then
  echo "⚙️  Installing pip manually..."
  curl -sS https://bootstrap.pypa.io/get-pip.py -o get-pip.py
  python3 get-pip.py --user
fi

# --- Install Python packages globally ---
if [ -f "requirements.txt" ]; then
  echo "Installing Python dependencies..."
  python3 -m pip install --upgrade pip --user
  python3 -m pip install -r requirements.txt --user
else
  echo "⚠️ No requirements.txt found."
fi

# --- Start Node server ---
echo "---- Starting Node.js server ----"
npm start
