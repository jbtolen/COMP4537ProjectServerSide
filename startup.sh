#!/bin/bash
echo "---- Setting up Python environment ----"

# Detect environment (Azure or local)
if [ -d "/home/site/wwwroot" ]; then
  APP_HOME="/home/site/wwwroot"
else
  APP_HOME="$(pwd)"
fi

echo "App home: $APP_HOME"

# ✅ Create and activate venv
if [ ! -d "$APP_HOME/venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv "$APP_HOME/venv"
fi

source "$APP_HOME/venv/bin/activate"

# ✅ Install dependencies
if [ -f "$APP_HOME/requirements.txt" ]; then
  echo "Installing requirements..."
  pip install --upgrade pip
  pip install -r "$APP_HOME/requirements.txt"
else
  echo "No requirements.txt found"
fi

echo "---- Starting Node.js server ----"
npm start
