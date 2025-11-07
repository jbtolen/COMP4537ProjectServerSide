#!/bin/bash
set -e
echo "---- Azure Startup Script ----"

cd /home/site/wwwroot || cd /home/site

echo "Installing Python dependencies globally (no venv)..."
if command -v python3 &> /dev/null; then
  python3 -m pip install --upgrade pip --user
  if [ -f "requirements.txt" ]; then
    python3 -m pip install -r requirements.txt --user
  fi
else
  echo "⚠️ Python3 not found. You may need a hybrid Node+Python plan."
fi

echo "---- Starting Node.js server ----"
npm start
