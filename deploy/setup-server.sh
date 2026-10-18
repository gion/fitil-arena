#!/usr/bin/env bash
# Pregătește un VPS nou (Ubuntu 24.04) pentru deploy/docker-compose.yml. Se rulează o singură dată, ca root:
#   ssh root@IP 'bash -s' < deploy/setup-server.sh
set -euo pipefail

apt-get update
apt-get install -y ca-certificates curl rsync ufw unattended-upgrades fail2ban

# Docker Engine + plugin-ul compose (scriptul oficial)
if ! command -v docker >/dev/null; then curl -fsSL https://get.docker.com | sh; fi

# firewall: doar SSH și web (80 pentru certificatele Let's Encrypt, 443 TCP + UDP pentru HTTP/3)
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

# actualizări de securitate automate
dpkg-reconfigure -f noninteractive unattended-upgrades

# SSH doar cu cheie
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl reload ssh || systemctl reload sshd

mkdir -p /opt/fuse-arena/deploy
echo "Gata. Urmează: deploy/.env în /opt/fuse-arena/deploy/ (vezi docs/deploy.md)."
