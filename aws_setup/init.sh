#!/bin/bash
# ─────────────────────────────────────────────────────────────
# init.sh
# Installs Docker, Docker Compose, Node.js, and npm on Ubuntu
# Safe to run on a fresh EC2 instance (Ubuntu 22.04)
# ─────────────────────────────────────────────────────────────

set -euo pipefail

# ── Config ────────────────────────────────────────────────────
COMPOSE_VERSION="v2.27.0"
NODE_MAJOR="20"

# ── Logging ───────────────────────────────────────────────────
log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] INFO  $*"; }
warn() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARN  $*"; }
die()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR $*" >&2; exit 1; }

log "=== Bootstrap started ==="

# ── 1. System update ──────────────────────────────────────────
log "Updating apt repositories..."
sudo apt update -y
sudo apt upgrade -y

# ── 2. Install Docker ─────────────────────────────────────────
if command -v docker &>/dev/null; then
  warn "Docker already installed: $(docker --version). Skipping."
else
  log "Installing Docker..."
  sudo apt install -y docker.io
  sudo systemctl enable docker
  sudo systemctl start docker
  docker --version || die "Docker installation failed"
  log "Docker installed successfully"
fi

# ── 3. Add current user to docker group ───────────────────────
if groups "$USER" | grep -q docker; then
  warn "User '$USER' is already in the docker group. Skipping."
else
  log "Adding '$USER' to docker group..."
  sudo usermod -aG docker "$USER"
  warn "Group change applied. Run 'newgrp docker' or re-login for it to take effect."
fi

# ── 4. Install Docker Compose (system-wide) ───────────────────
if docker compose version &>/dev/null; then
  warn "Docker Compose already installed: $(docker compose version). Skipping."
else
  log "Installing Docker Compose ${COMPOSE_VERSION}..."
  sudo mkdir -p /usr/local/lib/docker/cli-plugins
  sudo curl -fsSL \
    "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  docker compose version || die "Docker Compose installation failed"
  log "Docker Compose installed successfully"
fi

# ── 5. Install Node.js and npm (via NodeSource) ───────────────
if command -v node &>/dev/null; then
  warn "Node.js already installed: $(node --version). Skipping."
else
  log "Installing Node.js ${NODE_MAJOR}.x and npm..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | sudo -E bash -
  sudo apt install -y nodejs
  node --version || die "Node.js installation failed"
  npm --version  || die "npm installation failed"
  log "Node.js and npm installed successfully"
fi

# ── 6. Summary ────────────────────────────────────────────────
log "=== Bootstrap complete ==="
log "Installed versions:"
log "  Docker:         $(docker --version)"
log "  Docker Compose: $(docker compose version)"
log "  Node.js:        $(node --version)"
log "  npm:            $(npm --version)"
log ""
log "IMPORTANT: Run 'newgrp docker' or log out and back in"
log "           before running docker commands without sudo."