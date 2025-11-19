# Quota & ML Auth Update

## Summary
- Added `src/middleware/usage.js`, which verifies JWTs, increments `api_usage`, records `endpoint_stats`, and stamps `X-API-Usage`/`X-API-Warning` headers.
- `/api/auth/me` now runs through that middleware so the response always contains fresh usage info and an optional warning message.
- `/api/ml/classify` now requires authentication (cookie or `Authorization: Bearer`) and tracks both the caller’s usage and per-endpoint stats while persisting the `userId` on saved classifications.
- Updated README + handoff notes with the new headers/test flow.

## How to verify
1. Start the API (`npm start`) after running `npm install`, `py -m venv venv`, and `venv\Scripts\pip install -r requirements.txt` once.
2. Register/login using PowerShell (commands below) to capture `$session` and `$token`.
3. Call `/api/auth/me` → expect `X-API-Usage` header and JSON `{ usage: { used, limit } }`.
4. Call `/api/ml/classify` with `Authorization: Bearer $token` plus a real image file. Every call increments usage and ultimately returns `X-API-Warning` once `used >= limit`.

```powershell
$login = Invoke-WebRequest http://localhost:3000/api/auth/login `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"test@example.com","password":"pass123"}' `
  -SessionVariable session
$token = ($login.Content | ConvertFrom-Json).token

$profile = Invoke-WebRequest http://localhost:3000/api/auth/me `
  -WebSession $session `
  -Headers @{ Authorization = "Bearer $token" }
$profile.Headers["X-API-Usage"]

curl.exe -i -X POST http://localhost:3000/api/ml/classify `
  -H "Authorization: Bearer $token" `
  -F "image=@C:\path\to\photo.jpg"
```

## Frontend integration notes
- The client must send credentials on every request now. For Fetch: `fetch(url, { method, credentials: 'include', ... })` or include the Bearer token from `SessionStore` in the headers.
- After logging in, call `/api/auth/me` and surface `usage.used/usage.limit` on the user dashboard; display `warning` or `X-API-Warning` when present.
- The classifier UI should reuse the shared API client so it automatically attaches cookies/headers, then read the usage headers to show “quota reached” messages.
- Admin dashboard will eventually consume new stats endpoints (still TODO) that read from the `api_usage` and `endpoint_stats` tables already in place.