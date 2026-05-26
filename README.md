# Notes App — 2-Tier Dockerized Application with CI/CD

A minimal but production-structured notes application demonstrating a complete DevOps workflow:
local development with Docker, automated testing, containerized builds, and continuous deployment
via GitHub Actions.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [How the Application Works](#4-how-the-application-works)
5. [Local Development Setup](#5-local-development-setup)
6. [Running Tests](#6-running-tests)
7. [Docker Deep Dive](#7-docker-deep-dive)
8. [CI/CD Pipeline](#8-cicd-pipeline)
9. [API Reference](#9-api-reference)
10. [Environment Variables & Secrets](#10-environment-variables--secrets)
11. [Deploying to a Server](#11-deploying-to-a-server)
12. [Extending the Project](#12-extending-the-project)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Developer Machine                     │
│                                                             │
│   git push  ──►  GitHub Repository                         │
│                       │                                     │
│                       ▼                                     │
│              GitHub Actions (CI)                            │
│         ┌────────────────────────┐                         │
│         │  backend tests (Jest)  │                         │
│         │  frontend tests + build│  ◄── runs in parallel  │
│         │  docker image check    │                         │
│         └────────────┬───────────┘                         │
│                      │ all pass                             │
│                      ▼                                      │
│              GitHub Actions (CD)  ── merge to main only    │
│         ┌────────────────────────┐                         │
│         │  build + push images   │                         │
│         │  → Docker Hub          │                         │
│         │  SSH deploy to server  │                         │
│         └────────────┬───────────┘                         │
└──────────────────────┼──────────────────────────────────────┘
                       │
                       ▼
         ┌─────────────────────────┐
         │   Production Server      │
         │  ┌─────────────────────┐│
         │  │  nginx (port 80)    ││  ◄── serves React SPA
         │  │  React frontend     ││      proxies /api → backend
         │  └──────────┬──────────┘│
         │             │ /api/*     │
         │  ┌──────────▼──────────┐│
         │  │  Express API        ││  ◄── REST CRUD on port 5000
         │  │  (port 5000)        ││      (internal only)
         │  └─────────────────────┘│
         └─────────────────────────┘
```

This is a **2-tier architecture**:

- **Tier 1 — Presentation**: React frontend served by Nginx. The browser talks only to Nginx on port 80.
- **Tier 2 — Application/Data**: Express REST API on port 5000 (not exposed publicly). Nginx proxies any `/api/*` request to it. The backend owns all data (in-memory store, swappable for a database).

The two tiers communicate through Docker's internal network — the frontend container never exposes the backend port to the outside world.

---

## 2. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18 | UI component library |
| Frontend server (prod) | Nginx 1.25 Alpine | Serves static build, proxies API calls |
| Backend | Node.js 20 + Express 4 | REST API server |
| Data store | In-memory (JS array) | Swap for Postgres/SQLite in production |
| Containerisation | Docker + Docker Compose | Consistent environments everywhere |
| CI/CD | GitHub Actions | Automated test → build → deploy pipeline |
| Image registry | Docker Hub | Stores versioned Docker images |
| Backend testing | Jest + Supertest | Unit + integration tests for the API |
| Frontend testing | React Testing Library + Jest | Component + interaction tests |

---

## 3. Project Structure

```
notes-app/
│
├── backend/                        # Express REST API
│   ├── src/
│   │   ├── server.js               # App entry point, middleware, port binding
│   │   ├── db.js                   # In-memory data layer (CRUD operations)
│   │   ├── routes/
│   │   │   └── notes.js            # Route handlers for /api/notes
│   │   └── __tests__/
│   │       └── notes.test.js       # 9 API tests (Jest + Supertest)
│   ├── Dockerfile                  # Single-stage Node 20 Alpine image
│   ├── .dockerignore
│   └── package.json                # deps: express, cors, uuid | dev: jest, supertest, nodemon
│
├── frontend/                       # React SPA
│   ├── public/
│   │   └── index.html              # HTML shell — CRA entry point (required)
│   ├── src/
│   │   ├── App.js                  # Root component — all UI and state logic
│   │   ├── api.js                  # Fetch wrapper for all backend calls
│   │   ├── index.js                # React DOM render entry point
│   │   ├── index.css               # Global styles (DM Sans + DM Mono)
│   │   └── __tests__/
│   │       └── App.test.js         # 27 component tests (React Testing Library)
│   ├── nginx.conf                  # Nginx: serve SPA + proxy /api to backend
│   ├── Dockerfile                  # Multi-stage: Node build → Nginx serve
│   ├── .dockerignore
│   └── package.json                # deps: react, react-dom, react-scripts | dev: @testing-library/*
│
├── docker-compose.yml              # Production: builds final images, wires services
├── docker-compose.override.yml     # Dev only: hot reload, mounts src as volumes
├── .gitignore
│
└── .github/
    └── workflows/
        ├── ci.yml                  # Runs on every push/PR — tests + build check
        └── cd.yml                  # Runs on main after CI passes — push + deploy
```

### Why this structure?

- **`backend/src/db.js` is a dedicated data layer.** All reads and writes go through it. To add Postgres later, only this file changes — routes and tests stay the same.
- **`frontend/src/api.js` is a dedicated API client.** Components never call `fetch` directly. This means you can change the base URL or add auth headers in one place.
- **Two Compose files** (`docker-compose.yml` + `docker-compose.override.yml`). Docker Compose automatically merges them during `docker compose up`. The override adds hot-reload volumes and dev ports that are not wanted in production.
- **Two workflow files** (`ci.yml` + `cd.yml`). CI runs on every branch. CD only runs when CI passes on `main`. This separation prevents accidental deploys from feature branches.

---

## 4. How the Application Works

### Data flow — creating a note

```
User types title + content → clicks "Add note"
  │
  ▼
App.js: handleCreate(payload)
  │
  ▼
api.js: createNote({ title, content })
  │  POST /api/notes   (JSON body)
  ▼
[browser → Nginx :80 → Express :5000]
  │
  ▼
routes/notes.js: POST handler
  │
  ▼
db.js: create({ title, content })
  │  assigns uuid, timestamps
  ▼
Returns new note object (201 Created)
  │
  ▼
App.js: setNotes(prev => [newNote, ...prev])
  │
  ▼
React re-renders — note card appears in grid
```

### Nginx proxy (why port 80 works for everything)

In production, only port 80 is exposed. Nginx handles two responsibilities:

```nginx
# Serve the React SPA for all non-API routes
location / {
    root /usr/share/nginx/html;
    try_files $uri $uri/ /index.html;   # enables React Router
}

# Proxy API calls to the backend container on the Docker network
location /api {
    proxy_pass http://backend:5000;
}
```

`backend` resolves to the backend container's internal IP via Docker's built-in DNS. The backend port is never exposed to the host machine in production.

### Health check

The backend exposes `GET /health` → `{ status: "ok", timestamp: "..." }`.
Docker Compose uses this to gate the frontend — it won't start until the backend is healthy:

```yaml
depends_on:
  backend:
    condition: service_healthy
```

---

## 5. Local Development Setup

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- Node.js 18+ (only needed if you want to run outside Docker)
- Git

### Clone and start

```bash
git clone https://github.com/<your-username>/notes-app.git
cd notes-app
docker compose up
```

Docker Compose automatically merges `docker-compose.yml` and `docker-compose.override.yml`.
The override enables hot reload for both services.

| Service | URL | Notes |
|---|---|---|
| Frontend | http://localhost:3000 | React dev server with hot reload |
| Backend API | http://localhost:5000 | Express with nodemon |
| Health check | http://localhost:5000/health | Returns `{ status: "ok" }` |

### Hot reload behaviour

- **Backend**: nodemon watches `backend/src/`. Any `.js` file save restarts the Express server automatically.
- **Frontend**: CRA dev server watches `frontend/src/`. Any save triggers a browser hot-module reload with no page refresh.

This works because `docker-compose.override.yml` mounts the local `src/` directories as Docker volumes:

```yaml
volumes:
  - ./backend/src:/app/src    # local file changes sync into the container
  - ./frontend/src:/app/src
```

### Stopping

```bash
docker compose down          # stop containers
docker compose down -v       # stop and remove volumes
```

---

## 6. Running Tests

### Backend tests (Jest + Supertest)

```bash
cd backend
npm install
npm test
```

Expected output:

```
PASS src/__tests__/notes.test.js
  GET /health
    ✓ returns status ok
  GET /api/notes
    ✓ returns empty array initially
    ✓ returns all notes
  POST /api/notes
    ✓ creates a note
    ✓ rejects missing title
  PUT /api/notes/:id
    ✓ updates a note
    ✓ returns 404 for unknown id
  DELETE /api/notes/:id
    ✓ deletes a note
    ✓ returns 404 for unknown id

Tests: 9 passed, 9 total
```

**How the tests work**: Supertest mounts the Express `app` directly — no network required.
`db.reset()` runs in `beforeEach` so every test starts with a clean slate.
`server.close()` runs in `afterAll` to release the port.

### Frontend tests (React Testing Library)

```bash
cd frontend
npm install
npm test
```

27 tests across 7 suites:

| Suite | Tests | What is verified |
|---|---|---|
| Initial render | 4 | Logo, header button, spinner, getNotes called on mount |
| Empty state | 2 | "No notes yet." message, CTA button |
| Notes list | 4 | Titles render, content renders, empty content not rendered |
| Error state | 2 | Error banner shown on fetch failure, dismissed on click |
| Create note | 9 | Form open/close, submit disabled without title, createNote called with correct payload, note added to list, form closes, cancel works, API error shown |
| Edit note | 5 | Form opens with prefilled values, updateNote called correctly, list updates, cancel restores card |
| Delete note | 3 | deleteNote called with correct id, note removed from DOM, error shown on failure |

**How the tests work**: The `api` module is fully mocked with `jest.mock('../api')`.
Tests control exactly what the API returns, so they run instantly with no server dependency.
`userEvent` simulates real browser interactions (type, click) rather than firing synthetic events directly.

---

## 7. Docker Deep Dive

### Backend image — single stage

```dockerfile
FROM node:20-alpine          # small base (~50MB)

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production # installs only production deps, no devDependencies

COPY src/ ./src/

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000
CMD ["node", "src/server.js"]
```

Result: ~130MB image. `node_modules` is inside the image; `devDependencies` (jest, nodemon, supertest) are excluded.

### Frontend image — multi-stage build

```dockerfile
# ── Stage 1: build ──────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci                   # needs devDeps for react-scripts build
COPY public/ ./public/
COPY src/ ./src/
RUN npm run build            # outputs static files to /app/build

# ── Stage 2: serve ──────────────────────────────
FROM nginx:1.25-alpine       # ~25MB base
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

The final image contains **only Nginx + the compiled static files** — no Node.js, no npm, no source code. This brings the image from ~600MB (if you shipped the Node build stage) down to ~30MB.

### Docker Compose — production vs development

| Setting | `docker-compose.yml` (prod) | `docker-compose.override.yml` (dev) |
|---|---|---|
| Frontend command | `nginx` (default) | `npm start` (CRA dev server) |
| Backend command | `node src/server.js` | `npm run dev` (nodemon) |
| Frontend port | 80 | 3000 |
| Backend port | not exposed (internal only) | 5000 |
| Source volumes | none | `./src` mounted for hot reload |
| NODE_ENV | production | development |

In production the backend is not port-mapped to the host. It is only reachable via the Docker internal network at `http://backend:5000`, which only Nginx can reach.

### Useful Docker commands

```bash
# View running containers
docker compose ps

# Follow logs for a specific service
docker compose logs -f backend
docker compose logs -f frontend

# Rebuild images after a Dockerfile change
docker compose build --no-cache

# Open a shell inside the backend container
docker compose exec backend sh

# Check backend health manually
docker compose exec backend wget -qO- http://localhost:5000/health
```

---

## 8. CI/CD Pipeline

The pipeline is split into two workflow files. CI runs on every push; CD runs only when CI succeeds on `main`.

### CI workflow (`ci.yml`)

**Trigger**: every `git push` to any branch, and every pull request targeting `main`.

```
push / pull_request
        │
        ├──► Job: backend-test
        │    ├── actions/checkout@v4
        │    ├── setup-node@v4  (Node 20, npm cache)
        │    ├── npm ci
        │    └── npm test  (9 Jest tests)
        │
        ├──► Job: frontend-test  (runs in parallel with backend-test)
        │    ├── actions/checkout@v4
        │    ├── setup-node@v4  (Node 20, npm cache)
        │    ├── npm ci
        │    ├── npm test  (27 React Testing Library tests)
        │    └── npm run build  (verifies production build succeeds)
        │
        └──► Job: docker-build  (runs AFTER both test jobs pass)
             ├── actions/checkout@v4
             ├── docker/setup-buildx-action@v3
             ├── docker/build-push-action  → backend image (push: false)
             └── docker/build-push-action  → frontend image (push: false)
```

**npm cache**: The `cache: npm` option in `setup-node` saves `node_modules` between runs using the `package-lock.json` as a cache key. This cuts install time from ~60s to ~5s on repeat runs.

**`push: false`** in the Docker build step means images are built but not pushed to a registry. This catches Dockerfile errors on feature branches without publishing broken images.

### CD workflow (`cd.yml`)

**Trigger**: `workflow_run` — fires when the CI workflow completes on the `main` branch, but only if it succeeded.

```yaml
on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]

jobs:
  deploy:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
```

```
CI passes on main
        │
        ▼
Job: deploy
  ├── actions/checkout@v4
  ├── docker/setup-buildx-action@v3
  │
  ├── docker/login-action@v3
  │    └── authenticates to Docker Hub using secrets
  │
  ├── docker/build-push-action  → backend
  │    └── tags:
  │         your-username/notes-backend:latest
  │         your-username/notes-backend:<commit-sha>
  │
  ├── docker/build-push-action  → frontend
  │    └── tags:
  │         your-username/notes-frontend:latest
  │         your-username/notes-frontend:<commit-sha>
  │
  └── appleboy/ssh-action@v1.0.0
       └── runs on production server:
            cd ~/notes-app
            docker compose pull          # pull new :latest images
            docker compose up -d --remove-orphans
            docker image prune -f        # clean up old images
```

**Why tag with commit SHA?** The `latest` tag is convenient for deployment. The commit SHA tag (`abc1234`) gives you an immutable record of exactly which code is in each image — essential for rollbacks:

```bash
# Roll back to a previous version
docker compose down
docker pull your-username/notes-backend:abc1234
# update docker-compose.yml image tag and redeploy
```

### Branch protection (recommended setup)

In your GitHub repo under **Settings → Branches → Add rule** for `main`:

- ✅ Require status checks to pass before merging
  - Select: `Backend — test & lint`
  - Select: `Frontend — test & build`
  - Select: `Docker — verify images build`
- ✅ Require branches to be up to date before merging
- ✅ Do not allow bypassing the above settings

This makes it impossible to merge a PR that breaks tests.

---

## 9. API Reference

Base URL (local): `http://localhost:5000`
Base URL (production via Nginx): `http://your-server/api`

### `GET /health`

Health check endpoint. Used by Docker Compose to gate the frontend startup.

```
Response 200
{
  "status": "ok",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

### `GET /api/notes`

Returns all notes, newest first.

```
Response 200
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "My first note",
    "content": "Some content here",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
]
```

### `POST /api/notes`

Creates a new note. `title` is required.

```
Request body
{ "title": "My note", "content": "Optional content" }

Response 201
{ "id": "...", "title": "My note", "content": "Optional content", "createdAt": "...", "updatedAt": "..." }

Response 400 (missing title)
{ "error": "Title is required" }
```

### `GET /api/notes/:id`

Returns a single note by ID.

```
Response 200  →  note object
Response 404  →  { "error": "Note not found" }
```

### `PUT /api/notes/:id`

Updates a note. Send only the fields you want to change.

```
Request body
{ "title": "Updated title", "content": "Updated content" }

Response 200  →  updated note object
Response 404  →  { "error": "Note not found" }
Response 400  →  { "error": "Title cannot be empty" }
```

### `DELETE /api/notes/:id`

Deletes a note.

```
Response 204  →  (no body)
Response 404  →  { "error": "Note not found" }
```

---

## 10. Environment Variables & Secrets

### Backend environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Port the Express server listens on |
| `NODE_ENV` | `production` | Enables production optimisations |
| `FRONTEND_URL` | `*` | CORS origin (set to your domain in prod) |

### Frontend environment variables (build time)

| Variable | Default | Description |
|---|---|---|
| `REACT_APP_API_URL` | `/api` | Base URL for all API calls |

In local dev (`docker-compose.override.yml`) this is set to `http://localhost:5000/api` so the CRA dev server talks directly to the backend. In production the Nginx proxy handles this, so the value stays `/api`.

### GitHub Actions secrets

Add these under **Settings → Secrets and variables → Actions → New repository secret**:

| Secret name | What to put in it |
|---|---|
| `DOCKER_USERNAME` | Your Docker Hub username |
| `DOCKER_PASSWORD` | A Docker Hub access token (not your password) — create at hub.docker.com → Account Settings → Security |
| `SERVER_HOST` | IP address or domain name of your production server |
| `SERVER_USER` | SSH username on the server (e.g. `ubuntu` on AWS, `root` on DigitalOcean) |
| `SSH_PRIVATE_KEY` | Contents of your private key file (the full text of `~/.ssh/id_rsa`) |

---

## 11. Deploying to a Server

### 1. Provision a server

Any Linux VPS works. Recommended for learning:
- DigitalOcean Droplet (Ubuntu 22.04, $6/month)
- AWS EC2 t2.micro (free tier)

### 2. Install Docker on the server

```bash
# SSH into your server
ssh ubuntu@your-server-ip

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version
```

### 3. Set up the project directory

```bash
mkdir ~/notes-app
cd ~/notes-app

# Create a production-only docker-compose.yml that uses registry images
# instead of building from source
cat > docker-compose.yml << 'EOF'
version: '3.9'
services:
  backend:
    image: your-dockerhub-username/notes-backend:latest
    container_name: notes-backend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 5000
    expose:
      - "5000"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:5000/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  frontend:
    image: your-dockerhub-username/notes-frontend:latest
    container_name: notes-frontend
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      backend:
        condition: service_healthy
EOF
```

### 4. Open firewall ports

```bash
# Ubuntu UFW
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw enable
```

On AWS: update the EC2 Security Group to allow inbound TCP 22 and 80.

### 5. First deploy (manual)

```bash
cd ~/notes-app
docker compose pull
docker compose up -d
```

Visit `http://your-server-ip` — the app should be live.

### 6. All future deploys

Just merge a PR to `main`. The CD workflow automatically:
1. Builds new images
2. Pushes them to Docker Hub
3. SSHs into your server and runs `docker compose pull && docker compose up -d`

---

## 12. Extending the Project

### Add a real database (Postgres)

Replace `backend/src/db.js` with a Postgres client (e.g. `pg` or `knex`). Add to `docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: notes
      POSTGRES_USER: notes
      POSTGRES_PASSWORD: secret
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Add `DATABASE_URL` as a GitHub secret and pass it as an environment variable to the backend service.

### Add HTTPS with Let's Encrypt

Install Certbot on the server and update `nginx.conf` to redirect HTTP to HTTPS and serve the certificate. Or use a reverse proxy like Traefik or Caddy in front of the frontend container.

### Add staging environment

Create a `staging` branch. Add a second CD job that deploys to a staging server on merge to `staging`, and only deploys to production on merge to `main`.

### Add image scanning

Add a security scan step to `ci.yml` after the Docker build:

```yaml
- name: Scan image for vulnerabilities
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: notes-backend:latest
    severity: CRITICAL,HIGH
    exit-code: 1
```

This fails the pipeline if critical CVEs are found in the image.