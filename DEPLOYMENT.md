# Deploying vainie.pl

Complete guide to hosting this site on your own machine — accessible both
internally on your LAN **and** publicly at `vainie.pl`.

**Your setup (assumed):**
- The Next.js app runs on port `6967`.
- You have port forwarding configured on your router.
- Domain `vainie.pl` is registered at domena.pl.
- You're on Linux.
- Nginx as reverse proxy + Let's Encrypt for HTTPS.
- systemd to keep the Node process alive.

---

## Overview of the traffic flow

```
 Internet ─► your router (80/443 forwarded) ─► server :80/:443
                                                    │
                                                    ▼
                                              nginx (reverse proxy)
                                                    │
                                                    ▼
                                       Next.js app on 127.0.0.1:6967

 LAN device ─► http://<server-lan-ip>:6967   (direct, no proxy needed)
 LAN device ─► http://vainie.lan             (optional, via nginx if you want)
```

So on LAN you reach it at `http://192.168.x.x:6967` directly. Publicly,
nginx listens on 443 and proxies to `127.0.0.1:6967`.

---

## 1. Install prerequisites on the server

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx curl

# Node.js 20+ (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify:

```bash
node --version   # should be v20+ (yours is v22, fine)
nginx -v
```

---

## 2. Build the site for production

```bash
cd /home/VAINIE/Dokumenty/Projects/vainie-web
npm install
npm run build
```

Test manually:

```bash
npm start
# open http://localhost:6967 in a browser, Ctrl+C to stop
```

---

## 3. Create the systemd service

This keeps the app running in the background, restarts it on crash, and
starts it at boot.

Create the file:

```bash
sudo nano /etc/systemd/system/vainie-web.service
```

Paste:

```ini
[Unit]
Description=vainie.pl Next.js website
After=network.target

[Service]
Type=simple
User=VAINIE
WorkingDirectory=/home/VAINIE/Dokumenty/Projects/vainie-web
Environment=NODE_ENV=production
Environment=PORT=6967
# Bind only to loopback for production (nginx proxies to it).
# Use 0.0.0.0 if you ALSO want LAN devices to hit port 6967 directly.
Environment=HOSTNAME=0.0.0.0
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5

# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=read-only

[Install]
WantedBy=multi-user.target
```

Notes:
- `User=VAINIE` — runs as your user (matches the project path).
- `HOSTNAME=0.0.0.0` — binds to all interfaces so LAN devices can reach
  `http://<lan-ip>:6967` directly. Set to `127.0.0.1` if you want the port
  only reachable through nginx.

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now vainie-web
sudo systemctl status vainie-web
```

Useful commands:

```bash
sudo systemctl restart vainie-web
sudo systemctl stop vainie-web
journalctl -u vainie-web -f           # live logs
journalctl -u vainie-web --since "10 min ago"
```

---

## 4. DNS at domena.pl

Log into domena.pl → DNS/Strefa DNS panel for `vainie.pl` and add:

| Type  | Host  | Value              | TTL   |
|-------|-------|--------------------|-------|
| A     | `@`   | `<your-public-IP>` | 600   |
| A     | `www` | `<your-public-IP>` | 600   |

Find your public IP:

```bash
curl ifconfig.me
```

If your public IP is dynamic, set up Dynamic DNS (your router probably
supports it — Cloudflare DNS + a cron script, or services like
noip.com / duckdns.org, then point a CNAME from `vainie.pl` to your
dynamic hostname).

DNS propagation takes anywhere from a few minutes to a couple of hours.
Check with:

```bash
dig vainie.pl +short
dig www.vainie.pl +short
```

---

## 5. Router port forwarding

In your router admin panel (usually `192.168.0.1` or `192.168.1.1`):

| External port | Internal IP              | Internal port | Protocol |
|---------------|--------------------------|---------------|----------|
| 80            | `<server-LAN-IP>`        | 80            | TCP      |
| 443           | `<server-LAN-IP>`        | 443           | TCP      |

You mentioned you already have port forwarding — make sure **80 and 443**
are forwarded to the machine running nginx. Port `6967` does NOT need to
be forwarded publicly (nginx handles the public side).

Check your server's LAN IP:

```bash
ip -4 addr show | grep inet
```

---

## 6. Nginx reverse proxy config

Create the site config:

```bash
sudo nano /etc/nginx/sites-available/vainie.pl
```

Paste (HTTP only for now — HTTPS added by certbot in the next step):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name vainie.pl www.vainie.pl;

    # Needed for Let's Encrypt HTTP-01 challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        proxy_pass http://127.0.0.1:6967;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/vainie.pl /etc/nginx/sites-enabled/
sudo nginx -t          # should say "syntax is ok" + "test is successful"
sudo systemctl reload nginx
```

Test: open `http://vainie.pl` in a browser. You should see the site
(over plain HTTP for now).

---

## 7. HTTPS with Let's Encrypt

Once DNS is pointing at your IP and port 80 works, run:

```bash
sudo certbot --nginx -d vainie.pl -d www.vainie.pl
```

Certbot will:
1. Verify you control the domain via the `/.well-known/acme-challenge/` path.
2. Get certificates.
3. Edit your nginx config to add the `listen 443 ssl;` block and an HTTP→HTTPS redirect.
4. Set up automatic renewal (via a systemd timer — `systemctl list-timers | grep certbot`).

Verify:

```bash
sudo certbot renew --dry-run
```

Then hit `https://vainie.pl` — you should have a green padlock and your
site.

---

## 8. Firewall (if you run ufw)

```bash
sudo ufw allow 'Nginx Full'        # opens 80 + 443
sudo ufw allow 6967/tcp            # optional — for direct LAN access
sudo ufw enable
sudo ufw status
```

If you **don't** want LAN devices to hit port 6967 directly, skip the
`6967/tcp` line and set `HOSTNAME=127.0.0.1` in the systemd unit.

---

## 9. Internal LAN access

Option A — **direct**: just visit `http://<server-lan-ip>:6967` from any
device on your network. Works as long as the service binds to `0.0.0.0`
(the default in the unit file above).

Option B — **nice local hostname** (`vainie.lan` or `vainie.local`):

Edit your router's DNS or your devices' `hosts` files:

```
192.168.x.x    vainie.lan
```

Then add a second server block in nginx:

```nginx
server {
    listen 80;
    server_name vainie.lan;

    location / {
        proxy_pass http://127.0.0.1:6967;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Reload nginx — now `http://vainie.lan` works internally too.

---

## 10. Updating the site

```bash
cd /home/VAINIE/Dokumenty/Projects/vainie-web
git pull                 # if you use git
npm install              # if dependencies changed
npm run build
sudo systemctl restart vainie-web
```

---

## Troubleshooting

**502 Bad Gateway** on vainie.pl
→ Next.js isn't running. `sudo systemctl status vainie-web` and
`journalctl -u vainie-web -f`.

**Site loads on LAN but not publicly**
→ Check: `curl -I http://<your-public-ip>` from a phone on mobile data.
If it fails, port 80 forwarding isn't working. Verify in your router.

**Certbot fails**
→ Make sure DNS has propagated (`dig vainie.pl +short` shows your IP)
and port 80 is reachable from outside (`curl http://vainie.pl` from
an external network).

**"Address already in use" when starting service**
→ Something else is on port 6967. `sudo lsof -i :6967`

**Let's Encrypt rate limit**
→ Use `--staging` flag while testing:
`sudo certbot --nginx --staging -d vainie.pl -d www.vainie.pl`

**Page loads but hot-reload doesn't work**
→ That's normal in production. `npm run dev` is only for local development.

---

## Quick checklist

- [ ] `npm run build` succeeds
- [ ] systemd service running: `systemctl is-active vainie-web`
- [ ] `curl http://127.0.0.1:6967` returns HTML on the server
- [ ] DNS A records for `vainie.pl` + `www.vainie.pl` point to your public IP
- [ ] Router forwards 80 and 443 → server LAN IP
- [ ] `curl http://vainie.pl` works from outside your network
- [ ] Certbot succeeded → `https://vainie.pl` has a valid cert
- [ ] LAN: `http://<lan-ip>:6967` works from your phone
