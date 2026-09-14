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

**Run by people who are not you.** Administrator and editor roles, a
tamper-proof audit log of every change, page revisions with restore, and a
trash that keeps deleted content recoverable.

**Email that you configure in the panel.** SMTP settings, a test message, and
notifications for enquiries, form submissions, new accounts, password resets
and security events.

**Security you can see.** Failed-login lockouts, automatic IP blocking for
repeat offenders, two-factor authentication, and a screen that shows what is
happening — including an honest statement of what these measures cannot do.

**Backups and updates.** Take a full backup (database and media) from the
panel, download it, restore it. When a new engine release exists, the panel
says so, and can apply it for you if you allow it.

---

## Requirements

| | |
| --- | --- |
| **Node** | 22.12+ or 24 (`.nvmrc` pins 24) |
| **PostgreSQL** | 16 or newer |
| **Everything else** | npm. No build toolchain, no platform-specific binaries |

---

## Installing

```bash
git clone https://github.com/gev13/claude-engine-dist.git mysite
cd mysite/engine
npm install
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

See `LICENSE`, if one is present in this repository. Without it, no licence is
granted beyond what you have been told directly.
