# Site Engine

A content management system and website engine: pages built from blocks, a
theme you edit in the browser, a blog, forms, media, menus, SEO, email,
security controls, backups, and in-place updates.

Runs on your own server. No hosted service, no licence key, no phoning home
except to check whether a new release exists — and you can turn that off.

---

## What you get

**Pages are built, not coded.** Every page is a tree of blocks — heroes,
carousels, galleries, forms, pricing tables, charts, opening hours, over a
hundred variants in all — arranged in rows and columns from the admin panel.
Page templates and ready-made sections give you a finished layout to start
from.

**The design is yours without touching CSS.** Colours, typography, buttons,
header style, menu style, footer, popups and scroll effects are all settings.
Nine header layouts, four footers, seven menu styles.

**Everything a real site needs.** A blog with categories and search, contact
and custom forms whose submissions are stored, a media library, navigation
menus, redirects, sitemaps, structured data, `robots.txt`, `llms.txt`, and
scheduled publishing.

**Run by people who are not you.** Five roles — administrator, manager, editor,
author and reviewer — so a contributor can write without publishing and a
client can look without breaking anything. Plus a tamper-proof audit log of
every change, page revisions with restore, and a trash that keeps deleted
content recoverable. Accounts are created only from the admin panel; there is
no public sign-up.

**Email that you configure in the panel.** SMTP settings, a test message, and
notifications for enquiries, form submissions, new accounts, password resets
and security events.

**Security you can see.** Failed-login lockouts, automatic IP blocking for
repeat offenders, two-factor authentication, and a screen that shows what is
happening — including an honest statement of what these measures cannot do.

**Backups and updates.** Take a full backup (database and media) from the
panel, download it, restore it. When a new engine release exists, the panel
says so, and can apply it for you if you allow it.

**Move a site's content to another site.** Export the pages, posts, media and
design as one file and import it somewhere else — staging to production, or a
rebuild. It carries no accounts and no visitor data: enquiries, newsletter
sign-ups and form answers stay with the site they were given to.

---

## Requirements

| | |
| --- | --- |
| **Node** | 22.12+ or 24 (`.nvmrc` pins 24) |
| **PostgreSQL** | 16 or newer |
| **OS** | Ubuntu 24.04 LTS is the tested choice. Debian 12, Rocky 9 or any current Linux works — nothing here is Ubuntu-specific |
| **Everything else** | npm, and nothing else — no compiler, no Docker, no platform-specific binaries. The build tools come from npm with the rest, so install with plain `npm ci`, never `--omit=dev` |

### What server to buy

The numbers below are measured on this codebase, not guessed.

| | vCPU | RAM | Disk | Good for |
| --- | --- | --- | --- | --- |
| **Minimum** | 1 | **2 GB + 2 GB swap** | 20 GB | one small site; builds are slow but finish |
| **Recommended** | 2 | **4 GB** | 40 GB | a normal business site, comfortably |
| **Busy** | 4 | 8 GB | 80 GB+ | heavy traffic, large media library, several sites |

Any modern server CPU is fast enough — **clock speed barely matters, core count
does**. Around 2.5 GHz is typical of what you will be offered and is fine.

**RAM is the one thing that will actually bite you, and the build is why.**
Running the site settles between about **70 MB idle and 250 MB under load** —
size for 250 MB. Building it peaks at **1 GB** and uses two cores when it has
them. That is why 1 GB servers fail: the site runs fine and then the first
`npm run build` is killed by the kernel, with no useful error. On a 2 GB box,
add swap so a build cannot take the site down with it:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**Where the disk goes:** about 640 MB of `node_modules`, 350 MB of build cache,
20 MB of built site — call it **1 GB before a single page exists**. The rest is
your media library and your backups, and backups are full copies, so allow a
few times your media size.

**Two things that use CPU in bursts**, neither constant: signing in (password
hashing is deliberately expensive — about 19 MB and a moment of CPU per login,
which is what makes stolen passwords hard to crack) and processing images when
you upload them. Serving pages afterwards is cheap.

**A note on scale:** one 2 vCPU machine builds, migrates, installs and
smoke-tests this whole engine in under three minutes. Unless you are serving
serious traffic, you are not buying a bigger server for the CMS — you are
buying it for your media and your database.

Put PostgreSQL on the same machine unless you have a reason not to. A database
across the public internet makes every page wait for a round trip.

---

## Installing

```bash
git clone https://github.com/gev13/claude-engine-dist.git mysite
cd mysite/engine
npm ci
npm run build
npm start
```

Open the site and the installer takes you through the database connection, the
administrator account, the site's name, and two-factor enrolment.

**[INSTALL.md](INSTALL.md) is the full guide** — a server from nothing, with
nginx, TLS, pm2 and backups.

---

## After it is running

| Where | What |
| --- | --- |
| **Appearance** | Colours, typography, buttons, header, footer, blog layout |
| **Menus** | Header and footer navigation, social links, calls to action |
| **Pages** | Build from blocks; start from a template |
| **Email** | SMTP, then send yourself a test message |
| **Security** | Lockouts, blocked addresses, what is being attempted |
| **Backups** | Take one now, and read the note about keeping copies elsewhere |
| **Settings** | Time zone, date format, and *Discourage search engines* — leave that on until launch |

---

## Support and security

A vulnerability goes to the address in [SECURITY.md](SECURITY.md), privately
and never as a public issue.

---

## Licence

MIT — see `LICENSE`. Use it, change it, build on it, sell what you build; keep
the copyright notice with it.

The typefaces in `engine/public/fonts/` are the exception, because they are not
ours to relicense: they come from the Google Fonts catalogue under the SIL Open
Font License, Apache 2.0 or the Ubuntu Font Licence. The OFL asks that its
notice travels with the files, and it does —
`engine/public/fonts/google/LICENSES.md`. Keep that file if you keep the fonts.
