# ZupuVault — Sovereign Chinese Family Lineage System (宗族譜牒保管庫)

ZupuVault is a private, encrypted Chinese-style genealogy (*Zupu* / 宗族譜牒) web application designed for families who want full custody over their ancestral records, living relatives' privacy, and heritage archives.

---

## Core Capabilities

- **Client-Side Zero-Knowledge Cryptography**: All member records—including compressed **encrypted portraits**—are encrypted in the browser using `PBKDF2-SHA256` (310,000 iterations) + `AES-256-GCM` before leaving the device. The server stores encrypted envelopes and ciphertext metadata without holding the family decryption passphrase.
- **Lineage Tree, Custom Branches, Chronology & Memorial Calendar**: Interactive hierarchical tree with parent-centered subtree layout, generation poem (`字輩`) plaques, marriage bridges (`姻`), bloodline tracing, **configurable & expandable branches** (beyond the default three branches), **Clan Chronology & Statistics**, and a **Lunar/Solar Ancestral Memorial Calendar** (`忌辰 / 壽誕 / 清明 / 重陽`) with `.ics` export.
- **Editable Metadata, Duplicate Merge & Conflict Protection**: Post-creation editing of clan titles, hall name (`堂號`), ancestral origin, generation poem characters, custom branches, parent/spouse links, lunar dates, portraits, biographies, Elder-Sealed testaments, one-click **Duplicate Merge & Relationship Audit**, and **optimistic server revision locking** (`HTTP 409` conflict guard).
- **Trilingual Support, Self-Hosted Fonts & Auto-Romanisation**: Instant switching across **EN**, **繁體 (Traditional Chinese HK)**, and **简体 (Simplified Chinese)**, bundled local CJK/serif/sans fonts (zero external Google Fonts dependency), and automatic **HK Cantonese** / **Mandarin Pinyin** name generation.
- **Ceremonial PDF, Heir Custody Sheet, CSV & GEDCOM Import/Export**: Exports a three-part A4 PDF edition (Cover, Landscape Tree, Portrait Ouyang Chronicles), a printable **Heir Custody & Passphrase Recovery Sheet (PDF)**, and UTF-8 CSV / GEDCOM 5.5.1 (`.ged`) archives—strictly respecting RBAC redaction rules—and imports existing CSV/GEDCOM family files directly into the encrypted vault.
- **Search-Engine Opt-Out & Access Control**: Strict `noindex, nofollow, noarchive` directives across HTML meta, `/robots.txt`, and `X-Robots-Tag` HTTP headers; single-use invites (`ZUPU-XXXX-XXXX`), persistent HMAC sessions, RFC 6238 TOTP MFA, Custodian password/MFA reset with forced rotation, defense-in-depth auth rate limiting, and immutable audit logs.
- **Hybrid Sync & Air-Gapped Offline Mode**: Works both synced to your self-hosted Express node (`./data/zupu-vault-store.json`) and locally in browser IndexedDB (`ZupuSovereignDB`) with portable `.zupu.json` backup files.

---

## Architecture Overview

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4 | UI, WebCrypto (`AES-256-GCM` / `PBKDF2`), IndexedDB, Canvas PDF export (`jsPDF`) |
| **Backend** | Node.js, Express, `tsx` (`server.ts`) | Authentication, TOTP MFA, RBAC enforcement, encrypted vault sync, invite & audit APIs |
| **Persistence** | Atomic JSON file (`./data/zupu-vault-store.json`) | Stores user credential hashes, sealed TOTP secrets, invites, audit logs, and encrypted vault bundles |

> **Important Security Note on HTTPS & WebCrypto:**  
> Browsers disable `window.crypto.subtle` (required for `AES-256-GCM` and `PBKDF2` vault encryption) on plain `http://` public IP addresses. Only `https://` domains and `http://localhost` are treated as Secure Contexts. Always proxy ZupuVault over HTTPS via Nginx + Let's Encrypt when hosting on Oracle Cloud.

---

## Deploying on an Oracle Cloud Always Free Ubuntu Server

### 1. Provision Your OCI Compute Instance

1. In the **Oracle Cloud Console**, create a Compute Instance using **Ubuntu 22.04 LTS** or **Ubuntu 24.04 LTS**:
   - **Recommended Always Free Shape**: `VM.Standard.A1.Flex` (Ampere ARM64 — e.g. 1–2 OCPU, 6–12 GB RAM). Builds Vite cleanly with plenty of memory.
   - **Alternative Always Free Shape**: `VM.Standard.E2.1.Micro` (AMD64, 1 GB RAM). *If using this 1 GB shape, create a 2 GB swapfile below before running `npm run build`.*
2. Assign a public IPv4 address (or attach a Reserved Public IP) and download your SSH private key.

### 2. Open Ports in Oracle Cloud VCN & Ubuntu Firewall

Oracle Cloud blocks HTTP/HTTPS traffic in **two** places by default (the Cloud VCN Security List and the Ubuntu host `iptables`). Open both:

1. **OCI Console → Networking → Virtual Cloud Networks → Your VCN → Security Lists → Default Security List → Add Ingress Rules**:
   - Source CIDR: `0.0.0.0/0`, IP Protocol: `TCP`, Destination Port Range: `80` (for ACME TLS challenge / HTTP redirect)
   - Source CIDR: `0.0.0.0/0`, IP Protocol: `TCP`, Destination Port Range: `443` (HTTPS traffic)
2. **SSH into your Ubuntu instance**:
   ```bash
   ssh -i /path/to/ssh-key.key ubuntu@<YOUR_OCI_PUBLIC_IP>
   ```
3. **Allow ports `80` and `443` in Ubuntu's firewall** (OCI Ubuntu images use `iptables-persistent` / `netfilter-persistent` or `ufw`):
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```
   *(If `ufw` is enabled on your image, also run `sudo ufw allow 80/tcp && sudo ufw allow 443/tcp`.)*

### 3. *(Optional, for 1 GB `E2.1.Micro` Instances Only)* Add a 2 GB Swapfile

Skip this step on `A1.Flex` instances with 4+ GB RAM:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 4. Install Node.js 26 LTS & Build Tools

Works identically on both ARM64 (`A1.Flex`) and AMD64 (`E2.1.Micro`):

```bash
curl -fsSL https://deb.nodesource.com/setup_26.x | sudo -E bash -
sudo apt install -y nodejs git build-essential
node -v
npm -v
```

### 5. Clone & Build ZupuVault

Place the application in `/opt/zupuvault` (owned by your service user, e.g. `ubuntu`):

```bash
sudo mkdir -p /opt/zupuvault
sudo chown -R ubuntu:ubuntu /opt/zupuvault

# Clone the ZupuVault repository into /opt/zupuvault
git clone https://github.com/BaatarChan/zupuvault.git /opt/zupuvault
cd /opt/zupuvault

# Install dependencies
npm install
```

### 6. Configure Environment Variables (`.env`)

Create a `.env` file in `/opt/zupuvault/.env` based on `.env.example`:

```bash
cp /opt/zupuvault/.env.example /opt/zupuvault/.env

cat <<EOF > /opt/zupuvault/.env
NODE_ENV=production
# Change PORT (e.g. 3100) if another app on your server already uses 3000,
# and match the same port in your Nginx proxy_pass directive below.
PORT=3000
APP_URL="https://zupu.yourdomain.com"

# Persistent 32+ byte secret used to sign session tokens and seal TOTP MFA secrets at rest.
# IMPORTANT: Keep this value constant across server restarts so enrolled MFA stays valid.
SESSION_SECRET=$(openssl rand -hex 32)

# Optional: Set a server-side override passcode required when claiming first-run Patriarch custody.
# Leave empty to let the first custodian claim custody directly in the browser setup UI.
FAMILY_ADMIN_PASSCODE=

# Optional Passkey RP/Origin pinning (automatically derived from HTTPS Host/Origin when omitted)
# WEBAUTHN_RP_ID=zupu.yourdomain.com
# WEBAUTHN_ORIGIN=https://zupu.yourdomain.com
EOF

chmod 600 /opt/zupuvault/.env
```

> **Why `SESSION_SECRET` matters:**  
> `server/crypto.ts` derives the AES-256-GCM sealing key for stored user TOTP secrets from `SESSION_SECRET`. If `SESSION_SECRET` is omitted, the server generates an ephemeral random key in memory on each boot, which would invalidate enrolled TOTP secrets after a reboot. Setting it in `.env` guarantees persistence across restarts.

### 7. Build & Verify the Production Bundle

```bash
cd /opt/zupuvault
npm run lint
npm run build
```

This compiles the frontend into `/opt/zupuvault/dist/` and copies static assets (including fonts/seal imagery) cleanly.

### 8. Run ZupuVault as a `systemd` Service

Create `/etc/systemd/system/zupuvault.service`:

```bash
sudo tee /etc/systemd/system/zupuvault.service > /dev/null <<'EOF'
[Unit]
Description=ZupuVault Sovereign Family Lineage Server
After=network.target

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/opt/zupuvault
EnvironmentFile=/opt/zupuvault/.env
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5

# Basic process hardening
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable zupuvault
sudo systemctl start zupuvault
sudo systemctl status zupuvault
```

Inspect logs anytime with:

```bash
journalctl -u zupuvault -f
```

You should see: `ZupuVault sovereign server running on http://0.0.0.0:3000`.

### 9. Enable HTTPS & Brute-Force Rate Limiting on Your Existing Nginx Server

Because ZupuVault relies on browser **WebCrypto** (`window.crypto.subtle`) for client-side `AES-256-GCM` encryption and `PBKDF2` key derivation, HTTPS is required in production. Add a dedicated Nginx virtual host for your domain/subdomain (e.g. `zupu.yourdomain.com` pointing to your Oracle Cloud Public IPv4 address) without disturbing your other Nginx sites.

#### Step 9.1: Define Nginx Auth Rate-Limiting Zones

First, define shared rate-limiting memory zones in the `http { ... }` context (for example, in `/etc/nginx/conf.d/zupu-ratelimit.conf`, which Ubuntu Nginx automatically includes inside `http {}`):

```bash
sudo tee /etc/nginx/conf.d/zupu-ratelimit.conf > /dev/null <<'EOF'
# Strict rate limit for credentialed ZupuVault authentication endpoints (5 req/min per IP)
limit_req_zone $binary_remote_addr zone=zupu_auth_strict:10m rate=5r/m;

# Moderate burst limit for general API calls (60 req/min per IP)
limit_req_zone $binary_remote_addr zone=zupu_api_general:10m rate=60r/m;

# Return HTTP 429 Too Many Requests instead of 503 when throttled
limit_req_status 429;
EOF
```

#### Step 9.2 (Method A): Automatic HTTPS with Let's Encrypt & Certbot (Recommended)

1. **Create the initial HTTP vhost (`/etc/nginx/sites-available/zupuvault`)** so Certbot can issue your TLS certificate cleanly:

```bash
sudo tee /etc/nginx/sites-available/zupuvault > /dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name zupu.yourdomain.com;

    # Allows encrypted vault syncs with member portraits (server.ts accepts up to 6MB JSON)
    client_max_body_size 8m;

    # Block search engine indexing & harden MIME/frame/referrer policies
    add_header X-Robots-Tag "noindex, nofollow, noarchive, nosnippet" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self';" always;

    # Strict brute-force rate limiting on authentication, Passkey login, TOTP MFA & invite redemption
    location ~ ^/api/auth/(login|mfa/verify|register-invite|claim-custody|passkeys/login-options|passkeys/login-verify)$ {
        limit_req zone=zupu_auth_strict burst=5 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # General API protection
    location /api/ {
        limit_req zone=zupu_api_general burst=20 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
EOF
```

2. **Enable the site and reload Nginx**:

```bash
sudo ln -sf /etc/nginx/sites-available/zupuvault /etc/nginx/sites-enabled/zupuvault
sudo nginx -t && sudo systemctl reload nginx
```

3. **Issue the SSL certificate and enable automatic HTTP → HTTPS redirection** (Certbot preserves all `location` and `limit_req` rules automatically):

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d zupu.yourdomain.com --redirect --hsts
```

4. **Verify automatic certificate renewal**:

```bash
sudo certbot renew --dry-run
```

#### Step 9.2 (Method B): Explicit HTTPS Server Block (Existing or Custom SSL Certificates)

If you manage TLS certificates manually (for example, Cloudflare Origin CA or existing `/etc/letsencrypt/live/...` certificates), use this complete HTTPS server block in `/etc/nginx/sites-available/zupuvault`:

```nginx
# Redirect all HTTP traffic to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name zupu.yourdomain.com;
    return 301 https://$host$request_uri;
}

# HTTPS Reverse Proxy with Brute-Force Rate Limiting
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name zupu.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/zupu.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/zupu.yourdomain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Robots-Tag "noindex, nofollow, noarchive, nosnippet" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self';" always;

    client_max_body_size 8m;

    # Strict rate limit on login, Passkey login, TOTP verification, invite & custody endpoints
    location ~ ^/api/auth/(login|mfa/verify|register-invite|claim-custody|passkeys/login-options|passkeys/login-verify)$ {
        limit_req zone=zupu_auth_strict burst=5 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    location /api/ {
        limit_req zone=zupu_api_general burst=20 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

Test and reload Nginx:

```bash
sudo ln -sf /etc/nginx/sites-available/zupuvault /etc/nginx/sites-enabled/zupuvault
sudo nginx -t && sudo systemctl reload nginx
```

> **Note:** ZupuVault also enforces an application-level rate limiter inside Express (`server.ts`) as defense-in-depth alongside Nginx `limit_req`. `server.ts` sets `app.set('trust proxy', 1)` so both layers identify the client IP from `X-Forwarded-For` cleanly, and sends `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` plus `Disallow: /` in `/robots.txt`.

#### Step 9.3: Automatic IP Banning with Fail2ban (Nginx `429` & `401` Abuse)

Pair Nginx rate limiting with **Fail2ban** so automated credential-stuffing bots hitting HTTP `429` or repeated `401` responses on `/api/auth/` are banned at the firewall automatically:

```bash
sudo apt install -y fail2ban

sudo tee /etc/fail2ban/filter.d/nginx-zupu-auth.conf > /dev/null <<'EOF'
[Definition]
failregex = ^<HOST> - .* "(POST|GET) /api/auth/.*" (401|429) .*$
ignoreregex =
EOF

sudo tee /etc/fail2ban/jail.d/zupuvault.conf > /dev/null <<'EOF'
[nginx-zupu-auth]
enabled  = true
port     = http,https
filter   = nginx-zupu-auth
logpath  = /var/log/nginx/access.log
maxretry = 12
findtime = 600
bantime  = 3600
EOF

sudo systemctl enable fail2ban
sudo systemctl restart fail2ban
sudo fail2ban-client status nginx-zupu-auth
```

---

## First-Run Custodian Setup

1. Open `https://zupu.yourdomain.com` in your browser.
2. On the **Claim Family Custody** screen, create the initial **Patriarch / Custodian** account (name, Chinese name, email, login password, plus `FAMILY_ADMIN_PASSCODE` if configured in `.env`).
3. Create or import your encrypted family scroll and set your **Family Encryption Passphrase** (stored nowhere on the server — keep it in a password manager or offline safe).
4. Open **MFA & Keys** to enroll a 6-digit TOTP authenticator app, save your single-use recovery codes offline, and download your printable **Heir Custody & Passphrase Recovery Sheet (PDF)**.
5. Open **Roles & Access** to issue single-use relative invite codes (`ZUPU-XXXX-XXXX`), manage family member names/emails/permissions, or reset member passwords and MFA when needed.

---

## Backups, Monitoring & Maintenance

### Server Data Files to Back Up
- `/opt/zupuvault/data/zupu-vault-store.json` — Contains all user accounts, invites, audit logs, and encrypted vault envelopes.
- `/opt/zupuvault/.env` — Contains your `SESSION_SECRET` needed to validate active sessions and unseal TOTP MFA secrets.

Example daily local backup cron job (`crontab -e`, keeps a dated copy locally):

```cron
0 3 * * * mkdir -p /home/ubuntu/zupu-backups && cp /opt/zupuvault/data/zupu-vault-store.json /home/ubuntu/zupu-backups/zupu-vault-store-$(date +\%F).json
```

#### Client-Side Encrypted Off-Instance Backups with `age` + OCI Object Storage

Oracle Cloud Always Free includes **20 GB of Object Storage**. Encrypt both the vault store and `.env` locally with [`age`](https://github.com/FiloSottile/age) **before** uploading to your OCI bucket so nobody holding cloud credentials can inspect user emails, audit logs, or `SESSION_SECRET`:

```bash
# One-time setup on Ubuntu:
sudo apt install -y age
age-keygen -o /home/ubuntu/.zupu-backup-key.txt
chmod 600 /home/ubuntu/.zupu-backup-key.txt
# IMPORTANT: Copy the "public key: age1..." and save the private AGE-SECRET-KEY offline!
grep "public key:" /home/ubuntu/.zupu-backup-key.txt
```

Create a daily cron job that bundles & encrypts `/opt/zupuvault/data/zupu-vault-store.json` + `.env` and uploads it via OCI CLI:

```cron
0 3 * * * tar -C /opt/zupuvault -cf - data/zupu-vault-store.json .env | age -r age1YOUR_PUBLIC_KEY_HERE > /home/ubuntu/zupu-backups/zupu-backup-$(date +\%F).tar.age && oci os object put --bucket-name zupu-offsite-backups --file /home/ubuntu/zupu-backups/zupu-backup-$(date +\%F).tar.age --name "zupu-backup-$(date +\%F).tar.age" --force >/dev/null 2>&1
```

#### Backup Restore Verification Drill

Test restoring a backup once per quarter into a temporary folder (never assume a backup works untested):

```bash
mkdir -p /tmp/zupu-restore-test
age -d -i /home/ubuntu/.zupu-backup-key.txt /home/ubuntu/zupu-backups/zupu-backup-YYYY-MM-DD.tar.age | tar -C /tmp/zupu-restore-test -xf -
ls -lh /tmp/zupu-restore-test/data/zupu-vault-store.json /tmp/zupu-restore-test/.env
rm -rf /tmp/zupu-restore-test
```

You should also periodically export a `.zupu.json` encrypted archive (plus CSV/GEDCOM copies if needed) from the **Offline Vault** tab inside the app and store a copy offline.

### Health Endpoint & Uptime Monitoring

ZupuVault exposes a lightweight, unauthenticated liveness probe (no sensitive user/family data returned):

```bash
curl -fsS https://zupu.yourdomain.com/api/health
# {"ok":true,"service":"zupuvault","timestamp":"...","custodyClaimed":true,"hasVaultBundle":true,"vaultRevision":12}
```

Point UptimeRobot, Healthchecks.io, or an OCI monitoring check at `https://zupu.yourdomain.com/api/health` to alert you if the Node process or TLS certificate goes down.

### Updating ZupuVault

```bash
cd /opt/zupuvault
git pull
npm install
npm run lint
npm run build
sudo systemctl restart zupuvault
```

---

## Local Development

```bash
npm install
npm run dev
```

The development server runs at `http://localhost:3000` (port `3000` by default, or set `PORT=...` / `--port ...`, serving Vite middleware and Express APIs together).
