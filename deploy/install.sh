#!/usr/bin/env bash
# Deploys vainie-web on this machine:
#   - installs the systemd service
#   - installs the nginx site
#   - reloads both
#
# Run as root (or with sudo):
#   sudo ./deploy/install.sh
#
# This does NOT run certbot — that's a separate step once DNS is ready:
#   sudo certbot --nginx -d vainie.pl -d www.vainie.pl

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ $EUID -ne 0 ]]; then
    echo "Run with sudo." >&2
    exit 1
fi

echo "==> repo: $REPO_DIR"

# ---------- deps check ----------
command -v node >/dev/null || { echo "Node.js not installed."; exit 1; }
command -v nginx >/dev/null || { echo "nginx not installed (apt install nginx)."; exit 1; }

# ---------- build the app ----------
echo "==> installing npm deps + building"
sudo -u "$(stat -c '%U' "$REPO_DIR")" bash -c "cd '$REPO_DIR' && npm install && npm run build"

# ---------- systemd unit ----------
echo "==> installing systemd unit"
cp "$SCRIPT_DIR/vainie-web.service" /etc/systemd/system/vainie-web.service
systemctl daemon-reload
systemctl enable vainie-web
systemctl restart vainie-web
sleep 2
systemctl --no-pager status vainie-web | head -n 12

# ---------- nginx site ----------
echo "==> installing nginx site"
cp "$SCRIPT_DIR/nginx-vainie.pl.conf" /etc/nginx/sites-available/vainie.pl
ln -sf /etc/nginx/sites-available/vainie.pl /etc/nginx/sites-enabled/vainie.pl

# remove default site if it's still linked (optional, prevents conflicts)
if [[ -L /etc/nginx/sites-enabled/default ]]; then
    rm /etc/nginx/sites-enabled/default
    echo "   removed default site"
fi

nginx -t
systemctl reload nginx

cat <<EOF

==> done.

Next steps:
  1. Point DNS at domena.pl:
       A  @    -> $(curl -s ifconfig.me 2>/dev/null || echo '<your-public-IP>')
       A  www  -> <same>

  2. Make sure your router forwards 80 and 443 to this machine's LAN IP:
       $(hostname -I | awk '{print $1}')

  3. Once vainie.pl resolves to your IP, get HTTPS:
       sudo certbot --nginx -d vainie.pl -d www.vainie.pl

  Internal access right now:
       http://$(hostname -I | awk '{print $1}'):6967
       http://vainie.pl           (after DNS propagates)

  Logs:
       journalctl -u vainie-web -f

EOF
