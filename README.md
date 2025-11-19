# Server (API)

Express API for registration, login, me, and logout, with JSON storage and bcrypt password hashing.

## Endpoints (with /api prefix)

- POST `/api/auth/register` — `{ email, password }` → `{ id, email, role }`
- POST `/api/auth/login` — `{ email, password }` → sets httpOnly cookie, returns `{ email, role, token }`
- GET `/api/auth/me` — uses cookie or `Authorization: Bearer <token>` → `{ email, role, usage }`
- POST `/api/auth/logout` — clears cookie → `{ ok: true }`

Admin seed: `admin@admin.com` / `111`.

## Run (Local Dev)

```
cd server
npm install
# PowerShell examples:
$env:CLIENT_ORIGINS='http://localhost:5500,http://127.0.0.1:5500'
$env:PORT='3000'
npm start
```

You should see:
- `API listening on http://localhost:3000/api`
- `CORS allowed origins: http://localhost:5500, http://127.0.0.1:5500`

Verify unauthenticated:
- Open `http://localhost:3000/api/auth/me` → `{ "error": "Not authenticated" }`

## Storage

- SQLite database at `server/data/app.db` (auto-created)
- Tables: `users`, `api_usage`, `endpoint_stats`, `classifications`
- Legacy `data/db.json` accounts are imported automatically the first time the DB boots
- To reset, stop the server and delete `data/app.db`

## Config

- `CLIENT_ORIGINS` — comma-separated list of exact allowed origins
- `PORT` — default 3000
- `JWT_SECRET` — set strong secret for production
- Cookies: httpOnly, `SameSite: 'lax'` in dev; set `secure: true` when using HTTPS

## Next (Milestone 2 / teammate)

- ML endpoint: `POST /api/ml/classify` with image upload
- Persist usage increments per call
- Admin listing of users/usage
- Swap JSON store for a DB
