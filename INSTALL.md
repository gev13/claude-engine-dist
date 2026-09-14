# Installing the engine on a server

From a bare Ubuntu server to a site you can log into. About twenty minutes, most
of it waiting for things to download.

If you only want to try it on your own machine, skip to
[Running it locally](#running-it-locally) at the end.

---

## What you need

| | |
| --- | --- |
| A server | 2 GB of memory is comfortable; 1 GB works if nothing else runs on it |
| **Node** | 22.12 or newer, or 24 |
| **PostgreSQL** | 16 or newer |
| A domain | pointed at the server's IP address |

You do **not** need Docker, a build toolchain, or any paid service.

---

## 1. Install Node and PostgreSQL

```bash
sudo apt update
sudo apt install -y curl git postgresql
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
```

Check both:

```bash
node --version && psql --version
```

---

## 2. Create the database

The engine creates its own **tables**, but not the database itself. Make one,
with a user that owns it:

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE engine;
CREATE USER engine WITH PASSWORD 'put-a-real-password-here';
ALTER DATABASE engine OWNER TO engine;
\q
```

Use a long random password — you will paste it into the installer once and
never type it again.

---

## 3. Get the code

```bash
sudo mkdir -p /var/www && sudo chown "$USER" /var/www
git clone https://github.com/gev13/claude-engine-dist.git /var/www/mysite
cd /var/www/mysite/engine
npm ci
npm run build
```

`npm run build` takes a few minutes. **Every command from here on runs in
`/var/www/mysite/engine`.**

---

## 4. Start it

```bash
npm start
```

It listens on port 3000. Leave it running for now — step 7 makes it permanent.

---

## 5. Install, in the browser

Visit `http://your-server-ip:3000` (or your domain once step 6 is done). The
installer takes four steps.

**Database.** Enter the host, database name, user and password from step 2 —
or paste a connection string if you prefer. The installer tests the connection
before saving anything, then writes `.env` with those details and three
freshly generated secrets, and creates the tables.

Then it asks you to **restart the site**, and it means it: a running Node
process read its environment when it started and cannot pick up a file written
a moment ago. Press Ctrl+C, run `npm start` again, and reload the page. (After
step 7 the restart is `pm2 restart engine`.)

**Administrator.** Your name, username, email and password. At least 12
characters, three different character classes, not a known-breached password.
This is the only account that will exist — nothing ships with a default
password.

**Site.** Name, tagline, time zone. All editable later.

**Two-factor.** You are taken straight to a QR code. Scan it with an
authenticator app and enter the six-digit code. Do this now rather than
meeting it at your next sign-in with no idea why.

---

## 6. A domain, and HTTPS

Serve it through nginx rather than exposing port 3000:

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/mysite
```

```nginx
server {
    server_name example.com www.example.com;

    client_max_body_size 100M;   # matches MEDIA_MAX_FILE_BYTES

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

`X-Forwarded-For` is not optional: without it every visitor looks like
`127.0.0.1`, and the lockouts and IP blocking in Admin → Security have nothing
to work with.

```bash
sudo ln -s /etc/nginx/sites-available/mysite /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com -d www.example.com
```

Then set the real address in `.env` and restart:

```
NEXT_PUBLIC_SITE_URL="https://example.com"
```

---

## 7. Keep it running

```bash
sudo npm install -g pm2
cd /var/www/mysite/engine
pm2 start npm --name engine -- start
pm2 save
pm2 startup          # run the line it prints
```

| | |
| --- | --- |
| Restart | `pm2 restart engine` |
| Logs | `pm2 logs engine` |
| Status | `pm2 status` |

---

## 8. Before you tell anyone the address

- [ ] **Settings → Discourage search engines** is **on** while you build, and
      **off** at launch. It blocks indexing in both `robots.txt` and the page
      itself.
- [ ] `AUTH_REQUIRE_2FA="true"` in `.env` (the installer sets it; leave it).
- [ ] `NEXT_PUBLIC_SITE_URL` is the real `https://` address.
- [ ] PostgreSQL is not reachable from the internet — by default it listens
      only on localhost, and it should stay that way.
- [ ] `.env` is readable only by the account that runs the app
      (`chmod 600 .env`; the installer writes it that way).
- [ ] Backups are copied **off this machine** — see below.

---

## 9. Backups

Admin → Backups takes a full copy — database and media — as one archive you
can download and restore.

**A backup on the same disk as the site is not a backup.** Copy them
somewhere else. One way, nightly at 03:20:

```bash
crontab -e
```

```
20 3 * * * rsync -a /var/www/mysite/engine/storage/backups/ backup@elsewhere:/backups/mysite/
```

Restore is in the same screen. It replaces every page, post and account with
the archive's, takes a safety copy first, and signs you out — because the
accounts table it just replaced includes yours.

---

## 10. Updates

Admin → Updates shows the version you are on and whether a newer one exists.

**Applying an update from the panel is off by default.** It runs git, npm and a
build on your server, so you turn it on deliberately:

```
ENGINE_UPDATE_ENABLED="true"
```

With it off, the panel still tells you when a release exists, and you update by
hand:

```bash
cd /var/www/mysite
git fetch --tags
git checkout v0.2.0
cd engine
npm ci
npm run build
pm2 restart engine
```

Take a backup first, either way. There is no automatic rollback: if a step
fails the run stops and tells you which one, and your backup is still there.

---

## 11. Starter content (optional)

A new site has one page. If you would rather start from a furnished site —
example pages, a blog, menus, a media library, and a page showing every block
the engine has — run:

```bash
npm run db:seed:demo
```

It creates **no accounts**, keeps anything you have already made, and can be
deleted page by page afterwards. Do not run it on a site with real content you
care about.

---

## Settings in `.env`

The installer writes the first four. The rest have working defaults.

| Setting | What it is |
| --- | --- |
| `DATABASE_URL` | The connection string |
| `AUTH_ACCESS_SECRET` | Signs session tokens — generated for you |
| `AUTH_REFRESH_SECRET` | Signs refresh tokens — a different value |
| `SETTINGS_SECRET` | Encrypts the SMTP password at rest |
| `NEXT_PUBLIC_SITE_URL` | The site's real origin |
| `AUTH_REQUIRE_2FA` | Leave it `true` |
| `MEDIA_STORAGE_DIR` | Where uploads are written |
| `MEDIA_MAX_FILE_BYTES` | Upload limit; keep nginx's `client_max_body_size` in step with it |
| `BACKUP_DIR` | Where backup archives are written |
| `ENGINE_UPDATE_ENABLED` | Whether the panel may update the site itself |
| `ENGINE_RELEASE_FEED` | Where update checks look |

Email is **not** in this file — SMTP is configured in Admin → Email, and the
password is encrypted in the database.

---

## When something is wrong

**The installer says it cannot reach the database.** The message names the
reason. "Nothing is listening" means the host or port is wrong, or Postgres
is not running (`sudo systemctl status postgresql`). "Refused those
credentials" means the user or password is wrong. "That database does not
exist" means step 2 has not been done.

**It keeps sending me back to `/install`.** The site is not installed yet.
If you believe it is, the app is probably looking at a different database than
you are.

**Pages 404 after an update.** The build reads the database to pre-render
routes, and a build run while the database was down produces a site with none
of them. Rebuild with the database up.

**Media uploads fail at a certain size.** nginx's `client_max_body_size` and
`MEDIA_MAX_FILE_BYTES` disagree.

**Everything is slow and the logs mention the database.** Check that Postgres
is on the same machine or the same private network. A database across the
public internet makes every page render wait for a round trip.

**A second site on the same machine will not start its database.**
`docker-compose.yml` is for local development and fixes both the container
names (`engine-postgres`, `engine-meilisearch`) and the host ports (5435,
7701), so two copies started with `npm run db:up` collide. Give the second one
its own names and ports, or point both at one Postgres with a database each.
A server installation does not use that file at all — it uses the PostgreSQL
you installed in step 1.

---

## Running it locally

```bash
git clone https://github.com/gev13/claude-engine-dist.git mysite
cd mysite/engine
npm install
npm run dev
```

Open `http://localhost:3000` and the same installer runs. You will need a
PostgreSQL database — locally, `createdb engine` is usually enough.
