#!/bin/bash
# ─────────────────────────────────────────────────────────────
# init.sh
# Installs Docker, Docker Compose, Node.js, and npm on Ubuntu
# Safe to run on a fresh EC2 instance (Ubuntu 22.04)
# ─────────────────────────────────────────────────────────────

set -euo pipefail

sudo apt update -y && sudo apt upgrade -y

sudo apt install docker.io docker-compose-v2 -y
sudo systemctl enable docker && sudo systemctl start docker
docker --version 

sudo usermod -aG docker $USER
newgrp docker
