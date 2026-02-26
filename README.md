# Paarthurnax

## Deployment (Docker Compose)

Compose is the best fit here versus raw `docker run` because:
- one command boots both services
- restart policy is kept in versioned config
- service networking and port mapping are explicit

### Files used
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `docker-compose.yml`
- `backend/.env.prod`
- `frontend/.env.prod`

### 1. Set production environment values

Edit:
- `backend/.env.prod`
- `frontend/.env.prod`

Minimum values to change:
- `backend/.env.prod`:
  - `CORS_ORIGIN`
  - `CSP_CONNECT_SRC`
- `frontend/.env.prod`:
  - `VITE_API_BASE_URL`

### 2. Build on the target server

```bash
docker compose build
```

### 3. Launch in detached mode

```bash
docker compose up -d
```

Services are exposed on:
- frontend: `5173`
- backend: `3000`

Database persistence:
- `docker-compose.yml` binds `./backend/data.db` to `/app/data.db` in the backend container.

Restart behavior:
- both services use `restart: unless-stopped` (automatic restart on daemon reboot).

### 4. Operations

View status:
```bash
docker compose ps
```

View logs:
```bash
docker compose logs -f backend
docker compose logs -f frontend
```

Restart a service:
```bash
docker compose restart backend
docker compose restart frontend
```

Rebuild after code changes:
```bash
docker compose up -d --build
```
