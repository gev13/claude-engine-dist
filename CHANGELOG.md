# Changelog

Every release of the engine, newest first. A site reads the machine-readable
version of this from `releases.json`; this file is for people.

Versions follow semver: the patch digit for fixes, the minor for new
functionality that breaks nothing, the major for anything a site has to be
told about before taking it.

---

## 2.0.0 — 2026-09-16

**Changes the database, and changes how some pages look.** A backup is taken
before the migrations are applied. Read the last section before you take it.

### Your site can speak more than one language

Pick a main language while installing; add others from **Languages** in the
admin. The main language stays at the addresses it already has — `/about` is
still `/about` — and the others sit under a prefix, `/hy/about`. A site that
speaks one language is unchanged and pays nothing for this.

Pages, posts, categories, menus, site details and the engine's own words all
translate. **Translations** gives you the original beside the translation, so
you are never guessing what a field was. The admin panel itself stays in
English.

The SEO comes with it: canonical and `hreflang` on every page, alternates in
the sitemaps, and the right `og:locale`.

### Careers

A **Roles** screen for job adverts and a careers section for visitors:
a listing at `/careers`, a page per role with the six-fact grid the design
asks for, and an application form that takes a CV.

A filled role is closed by hand and **keeps its page** — somebody following a
months-old link gets an explanation and a link to what is open, not a 404. It
stops taking applications, leaves the sitemap, and stops telling search
engines it is a vacancy.

Applications arrive in their own inbox under Enquiries. **A CV is never put in
the media library**: it is stored outside it, reachable only through an
admin-only route that logs every download.

### Things are deleted when they should be

Applications, form submissions and contact enquiries are now kept for a period
— a year by default — and then deleted, files and all. Set it on each inbox,
or set it to zero to keep everything for ever, which is now a decision rather
than an accident.

The sweep runs as the site is used, at most once every six hours. A site with
a deadline to meet can run `npm run retention:sweep` from its own cron.

### Fifty-five more typefaces, and Armenian at last

The engine self-hosts a catalogue of Google Fonts alongside its own three, and
**Fonts by language** lets each language use a different one. This matters more
than it sounds: the three original faces have no Armenian or Cyrillic glyphs,
so those languages were rendering in whatever the reader's device substituted.
The Appearance screen now says so when a face cannot draw a language.

### Building pages

- **Rows nest three deep**, so a two-column section can hold a three-up grid.
- **A grid can become a swipeable track on small screens** — three or four
  across on a desktop, one at a time under a thumb. Set it in the Design tab
  of any section with a grid in it. Nothing is hidden: every card stays on the
  page and reachable by keyboard.
- **A cookie notice**, off by default, with your own wording, accept and
  reject, and a `#cookie-settings` link that reopens it.
- **Mosaic**, a new card-grid layout with tiles of two sizes.
- **A badge on a card** — "New", "Coming soon", "Sold out".
- **A file question in the form builder**, stored outside the media library
  like a CV, and downloadable only from the admin.
- **Search the block list** when adding one, instead of scrolling sixty.
- Pressing Enter in a plain text block now starts a new line on the site too.
- Empty fields in the Design tab and in Appearance now **show the value they
  inherit** instead of the word "inherit".

### Read this before upgrading

- **A padding you set in the Design tab now replaces the section's own**
  rather than adding to it. This was the point — setting it to `0` used to do
  nothing at all — but a section you have already styled may sit tighter than
  it did. Worth a look at pages where you have set section padding by hand.
- **Two database migrations.** A backup is taken first.
- The engine is about 13 MB larger, all of it fonts.

**Fixed:** a manager was still bounced off Appearance, Menus, Popups and
Redirects when they opened them, even after 1.2.0 fixed the navigation. Also
fixed: you could not nest a row, the block picker had no search, section
padding and borders could not really be overridden, and Enter in a plain text
block was lost.

---

## 1.2.0 — 2026-09-15

**Move a site's content to another site.** A new **Export & import** screen
takes every page, post, category, redirect and — if you want them — the media
files and the design, as one file you can import into a different site.
Staging to production, a rebuild, or handing a site to somebody else.

It carries **no people**. Not the accounts, and not the visitors either:
enquiries, newsletter sign-ups and form answers stay with the site they were
given to. Use a backup when you want a complete copy of one site; use this
when you want its content somewhere else. Each screen says which is which.

Two things worth knowing before you use it:

- **Everything imported is credited to whoever imports it.** An export carries
  no accounts, so it cannot carry authors.
- **An import replaces all content and clears revision history**, and takes a
  backup of the site as it stands first. Your accounts, enquiries and settings
  are left alone, and nobody is signed out.

**Fixed:** a manager could not see Appearance, Menus, Popups or Redirects in
the navigation despite being allowed to use them, and an author was shown
Contact enquiries, which they cannot open. Introduced in 1.1.0.

---

## 1.1.0 — 2026-09-14

**Changes the database.** A backup is taken before it is applied.

**Three more roles**, alongside the existing administrator and editor. Neither
of those changes, so no existing account gains or loses anything.

- **Manager** — an editor who also owns the site's look: appearance, menus,
  popups and redirects. Not accounts, settings, email, security, updates,
  backups or the audit log. For whoever runs the site day to day without being
  its technical owner.
- **Author** — writes and deletes their own pages and posts, and cannot
  publish. For contributors whose work should be reviewed before it is public.
- **Reviewer** — reads the site and handles enquiries, and changes nothing
  else. For a client who wants visibility without the ability to break
  anything.

Creating accounts stays with the administrator alone, and so does exporting or
erasing newsletter sign-ups and form submissions — those are personal data.

The role picker now explains what each role can do, rather than listing names
that only mean something once somebody cannot publish.

---

## 1.0.0 — 2026-09-14

The first release. Everything below was built before versioning began, and is
listed once here rather than invented as a history.

**Content and building**

- Block builder with rows, columns, revisions, trash and restore, draft
  preview links, and a compile-enforced wireframe for every block.
- Around sixty block types: heroes, sliders and carousels, galleries,
  projects, pricing, team, FAQ, charts, hotspots, flip cards, price lists,
  opening hours, reviews, tables of contents, breadcrumbs, text on a path,
  search, forms and Lottie animations.
- Twelve page templates and twenty-five ready sections, applied from the page
  editor and the block picker.
- Theme, menus, headers, footers and popups, all editable.
- Scheduled publishing for pages and posts: a future publish date keeps the
  content off the site until it arrives, with no scheduler running.

**People and safety**

- Accounts with roles, argon2id passwords, rotating refresh tokens and
  two-factor authentication enrolled during installation.
- Self-service password reset: a single-use link that expires and signs every
  session out when it is used.
- An append-only audit log, an IP blocklist, configurable account lockouts,
  and a security screen that says plainly what it can and cannot stop.

**Email**

- SMTP configured in the panel, with the password encrypted at rest and a
  test send that works before sending is switched on.
- Notifications for enquiries, form submissions and newsletter sign-ups;
  welcome, password reset and security messages.

**Installing and operating**

- A browser installer that configures the site from nothing: it takes the
  database details, tests them, writes `.env` with generated secrets, and
  applies the schema. No shell required beyond starting the process.
- The schema ships as generated migrations, applied by drizzle-orm's runtime
  migrator — a production install needs neither drizzle-kit nor psql.
- Media library with checked uploads, including Lottie JSON.
- Redirects with a 404 log, sitemaps, robots and structured data.
- Backups of the database and media, restorable from the panel, and update
  checks against the release feed.
