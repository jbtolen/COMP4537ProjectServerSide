# Backend Handoff Notes

added SQLite-backed storage and verified auth/ML flow

## What was done
- Replaced the JSON file store with a `better-sqlite3` database (`src/db.js`), including automatic migration/import of legacy users, plus new tables for `users`, `api_usage`, `endpoint_stats`, and `classifications`.
- Updated the auth service and server bootstrap to use the DB (JWT login/register/me now read/write SQLite); removed `src/store.js`.
- Hooked the ML router up to the DB so every classification is persisted for later CRUD work.
- Created a Python virtual environment (`venv`) and installed the ML stack (`requirements.txt`) so the HuggingFace model runs locally with `venv\Scripts\python.exe`.
- Verified the stack manually: register/login/me via PowerShell, and `curl.exe -F "image=@..."` against `/api/ml/classify`, which now returns predictions and writes rows to `classifications`.

## Local setup instructions
1. `npm install` (installs Node deps including `better-sqlite3`).
2. `py -m venv venv` (Python 3.11 installed via the `py` launcher) and `venv\Scripts\pip install -r requirements.txt`.
3. Start the API: `npm start`.

The server will auto-create `data/app.db` and import any users from `data/db.json` the first time it runs.

## Quick test script
```powershell
# ensure `npm start` is running in another terminal

# Register
Invoke-WebRequest http://localhost:3000/api/auth/register `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"test@example.com","password":"pass123"}'

# Login & capture session/token
$login = Invoke-WebRequest http://localhost:3000/api/auth/login `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"test@example.com","password":"pass123"}' `
  -SessionVariable session
$token = ($login.Content | ConvertFrom-Json).token

# Profile
Invoke-WebRequest http://localhost:3000/api/auth/me `
  -WebSession $session `
  -Headers @{ Authorization = "Bearer $token" }

# ML classify (replace path with a real image)
curl.exe -i -X POST http://localhost:3000/api/ml/classify `
  -H "Cookie: $($session.Cookies.GetCookies('http://localhost:3000').CookieHeader)" `
  -F "image=@C:\path\to\your-photo.jpg"
```
You should see a 200 response for each call, and a new row will appear in `data/app.db` → `classifications`. Every authenticated response also now sends `X-API-Usage` (used/limit) and, once you pass the free quota, `X-API-Warning`.

## Next steps for milestone 2
- Apply the quota/stat middleware to the upcoming `/api/v1/...` CRUD endpoints so every route is tracked consistently.
- Build those CRUD endpoints plus admin stats routes, then surface them in the frontend dashboards.
- Generate Swagger docs at `/doc/`, wire the client to the new APIs (with quota warnings), and wrap up the milestone deliverables bundle.
