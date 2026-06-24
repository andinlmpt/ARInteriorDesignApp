# AR Interior Design — Backend API

Express API server for authentication, projects, layouts, AI design, and related features.

## Quick start

```bash
cd backend
npm install
npm run dev
```

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with file watching (`node --watch`) |
| `npm start` | Start without watch |

Server defaults to **port 3000**. Override with `PORT` in `.env`.

## Endpoints

| URL | Description |
|-----|-------------|
| `GET /health` | Health check |
| `POST /api/v1/users/login` | Login |
| `POST /api/v1/users/signup` | Register |
| `GET /api/v1/projects` | Projects (auth required) |

Full API base: `http://localhost:3000/api/v1`

## Environment variables

Copy `.env` and adjust as needed:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=your-mongodb-uri
MONGODB_DB_NAME=ARINTERIORDESIGNAPP
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19006
```

The server binds to `0.0.0.0` so mobile devices on your LAN can reach it during development.

## Port 3000 already in use (`EADDRINUSE`)

If you see:

```
Error: listen EADDRINUSE: address already in use :::3000
```

the backend is **already running**. Check:

```powershell
# Windows
Invoke-WebRequest http://localhost:3000/health
```

If you get `{"status":"ok",...}`, no action is needed.

When you run `npm run dev` while the server is up, the process detects the existing instance and prints:

```
✅ Backend is already running — no need to start another instance.
```

### Restart the server

```powershell
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
npm run dev
```

```bash
# macOS / Linux
lsof -ti:3000 | xargs kill -9
npm run dev
```

## Connecting from Expo Go (physical device)

The frontend (`frontend/services/apiClient.ts`) auto-detects your computer’s LAN IP from the Expo bundler when using Expo Go.

Requirements:

1. Backend running on this machine
2. Phone and PC on the **same Wi‑Fi**
3. Frontend started with `npx expo start` in `frontend/`

Optional override in `frontend/.env`:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:3000/api/v1
```

## Test login credentials

| Email | Password |
|-------|----------|
| test@test.com | test123 |
| john@example.com | password123 |
| jane@example.com | password123 |
| admin@ardesign.com | admin123 |

Example:

```powershell
$body = '{"email":"test@test.com","password":"test123"}'
Invoke-WebRequest -Uri "http://localhost:3000/api/v1/users/login" `
  -Method POST -Body $body -ContentType "application/json"
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `EADDRINUSE` on 3000 | Backend already running — see above |
| Login works on PC but not phone | Set `EXPO_PUBLIC_API_BASE_URL` to your LAN IP |
| MongoDB connection warning | Server continues with in-memory fallback; check `MONGODB_URI` in `.env` |
| CORS errors (web only) | Add your Expo dev URL to `ALLOWED_ORIGINS` in `.env` |

## Related docs

- [Frontend getting started](../frontend/GETTING_STARTED.md) — Expo Go, AR, and full app setup
