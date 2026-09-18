# Changelog

Every release of the engine, newest first. A site reads the machine-readable
version of this from `releases.json`; this file is for people.

Versions follow semver: the patch digit for fixes, the minor for new
functionality that breaks nothing, the major for anything a site has to be
told about before taking it.

---

## 2.8.0 — 2026-09-18

**Cards can now be styled one at a time.** Every card in a grid has its own
look: background, text colour, padding and margin, a border, a corner radius
and its alignment — plus a CSS class of its own if you want to go further.
Picking one tile out of six to stand out used to mean writing CSS by hand.

It is folded away under each card and marked **set** when you have used it, so
a list of eight cards is still a list of eight cards. A card you have not
touched is completely unchanged — it gains no class and adds nothing to the
page. The text colour reaches the card's heading as well, so a dark tile does
not end up with a dark title on it.

It works on every card layout, not only the plain one.

**A heading with its subtitle beside it can be lined up.** That layout always
centred the two halves against each other. There is now a *Line them up*
choice — at the top, centred, or at the bottom — and it appears only for that
layout, since stacked headings have nothing to line up. Centred stays the
default, so every heading you already have looks exactly as it did.

No database changes.

---

## 2.7.1 — 2026-09-17

**`npm run release:merge` now finishes the job after a conflict.** When a
release did not merge cleanly it told you to merge by hand and run it again to
check and tag — and running it again found nothing left to merge and stopped,
so the checking and tagging never happened and the instruction it printed was
untrue.

It now carries on to the verification when the merge is already in place: the
version is still confirmed, your own files are still checked for having
survived, and the tag is still written. Only the merge itself is skipped.
Running it twice on an already-tagged release still stops, because that really
is nothing to do.

No database changes.

---

## 2.7.0 — 2026-09-17

**Line breaks you type now appear on the page.** Press Enter twice in a Body,
Intro or Description field and you get the paragraphs you asked for. Until now
HTML quietly collapsed them and the text ran together on the site, with nothing
in the editor to suggest anything had been lost.

This was fixed once before, for the text block. It was a fix to that one block
rather than to the engine, so every other section still had it — which is why
it came back. It is now a single rule that covers every block, including the
ones added in future releases.

Runs of spaces still collapse, so this does not turn your writing into
preformatted text; only the breaks you actually typed survive. The rich-text
editor is deliberately left alone: its paragraphs are already real paragraphs,
and treating the line breaks inside its markup as yours would add breaks you
never asked for.

No database changes.

---

## 2.6.2 — 2026-09-17

**Fixes the test suite failing in this repository.** 2.6.1 added a licence and
a test for it, and that test read two files this repository deliberately does
not carry — so it passed where it was written and failed here, over a licence
that was entirely correct.

The test now looks for the licence where each repository actually keeps it, and
the checks about *how* it gets published only run where the publishing happens.

A guard was added so this cannot ship again: a test may only read a file the
distribution strips if it also copes with that file being absent. It is checked
against the real exclusion list rather than a copy of it — and the suite is now
run against a stripped tree before release, which is the only check that speaks
for this repository rather than the one it was written in.

No database changes.

---

## 2.6.1 — 2026-09-17

**The engine now has a licence: MIT.** It is published openly and had no
licence file, which means the legal default applied — all rights reserved. You
could read it and nothing else. That was an oversight, not a position.

Use it, change it, build on it, sell what you build; keep the copyright notice
with it.

The bundled typefaces are the one exception, because they were never ours to
relicense. They come from the Google Fonts catalogue under the SIL Open Font
License, Apache 2.0 or the Ubuntu Font Licence, and the OFL asks that its
notice travels with the files. It does, and the licence says so rather than
implying MIT covers everything under it.

No database changes.

---

## 2.6.0 — 2026-09-17

**The Typography fields show their real values too.** Size, weight, colour and
letter spacing under Headings and Body text now say what the block already
uses, instead of "inherit".

**With one deliberate silence.** These fields govern *every* heading in a
section at once, and a section often holds headings at three different sizes.
There is no single size to report then, so nothing is reported — naming the
first one would print a figure you could not reconcile with the page. Each
property is judged on its own, so a colour that is the same throughout still
shows even where the sizes differ.

**And it measures against your theme, not ours.** The small page these values
are read from sits in the admin, which carries the engine's shipped colours.
A site whose palette was changed in Appearance would have been measured against
colours nobody is looking at. It now loads your saved theme first, so the
colour you are shown is the colour on your pages.

No database changes.

---

## 2.5.0 — 2026-09-17

**Colours and borders now show their real values too.** 2.4.1 fixed the
spacing fields; the background colour, the border widths, the border colour
and the corner radius all still said "inherit". They now show what the block
actually has — the colour of the band it paints, the width of the rule it
draws — read off the block itself, the same way the spacing is.

**And the fields that inherit nothing now say `none` instead of "inherit".**
An overlay and the three gradient stops are things the engine draws only once
you ask for one. There is no value being handed down from anywhere, so
"inherit" was describing something that does not exist and sending people
looking for where it was set.

No database changes.

---

## 2.4.1 — 2026-09-17

**The block spacing added in 2.2.0 never actually appeared.** The Design tab
went on saying "the block's own" instead of the real number, on every field.

The measuring works by loading a small page and reading what the browser
computes. The engine refuses to be put in a frame by anyone, and 2.2.0 relaxed
that for the one page being measured — but not the other half of the rule,
which governs whether the admin is allowed to load it. So the browser refused,
and a refusal looks exactly like a feature that does not work: nothing broke,
nothing was logged, the fields simply stayed empty.

Both halves are now set, and only where they are needed: the admin may load
that one page from its own address, and nothing else on the site may be framed
by anybody. Every field on the base tab now shows the block's real padding and
margin, and a different figure on each screen-size tab where the block changes
with the width.

No database changes.

---

## 2.4.0 — 2026-09-17

**One command to take a release into a site that has changes of its own.**

If your site lives in its own repository — with its own ports, container names
or deployment settings — a release has to be merged into it and tagged before
the admin panel will offer it. That was four commands typed by hand, and two of
them had a way of going wrong that nobody notices until a site loses its
settings.

    npm run release:merge              # merge the newest release and tag it
    npm run release:merge -- 2.4.0     # or a particular one
    npm run release:merge -- --push    # and push the tag when it passes

It will not tag anything it is not sure about. It stops, leaving your checkout
exactly as it was, if the release does not merge cleanly, if the merged copy
is not the version it claims, or — the important one — if the merge quietly
took the engine's copy of a file you had deliberately changed. It tells you
which file, and it never pushes your branch: on a site whose CI deploys from
`main`, pushing the branch *is* a deployment, and it takes no backup where the
admin panel's update does.

It also never fetches the engine's tags into your repository. Two different
things called `v2.4.0` in one place is how the wrong one ends up on a server.

No database changes.

---

## 2.3.0 — 2026-09-17

**Updating is safer, and says what is wrong when it will not run.**

If your site lives in its own repository rather than being a plain copy of the
engine, the update used to fail with `pathspec 'v2.2.0' did not match any
file(s) known to git` — a message about git, not about your site. It now tells
you what to do: a release has to be merged into your repository and tagged
there, or `ENGINE_RELEASE_REMOTE` set to the remote your engine lives on.

**Two new refusals, both before anything is touched.** An update now reads the
version out of the release it fetched and checks it really is the one it
claims, so a tag pointing at the wrong code is caught rather than installed.
And it counts the commits your site has that the release does not: if checking
it out would throw away your own work — your ports, your container names, the
process your server runs — it stops and tells you, instead of replacing them
and reporting success. Both happen before the working tree moves, so "nothing
has been changed" means it.

**Release tags no longer collide.** Fetching a release used to pull in every
tag from the remote, which on a site keeping its own tags meant two different
things could be called `v2.2.0` and the wrong one could win without a word.
Only the one release is fetched now, and nothing is written into your own tags.

No database changes.

---

## 2.2.0 — 2026-09-17

**The Design tab now tells you what the spacing already is.** Opening a
block's Design tab used to show empty padding and margin fields with nothing
to go on, so setting a value meant guessing what you were replacing. The
fields now name the block's real number — 88px, 64px — and a different one on
each screen-size tab where the block changes with the width.

It is measured, not looked up. Every block paints its own band in its own
stylesheet, and there are far too many of those for a list in the code to stay
honest; a list like that is right the day it is written and wrong quietly
afterwards. So the panel renders one real example of the block and asks the
browser, at each breakpoint in turn. A block added in a future release is
measured the same way, with nothing to keep up to date.

**One route on the site may now be framed, by the site itself.** Measuring
needs a real viewport, and the engine refuses to be put in a frame anywhere —
so the small admin-only page that renders the example is the single exception,
and only from your own domain. It is behind the admin login, shows example
content rather than your site's, and has no form or button on it. Every other
page, including every other admin page, still refuses outright.

No database changes.

---

## 2.1.1 — 2026-09-17

**An update could not record its own success.** If your site updated and the
panel then sat on `reload…` for ever, this is the release that explains it —
and the one you should take next, because that record also blocked every
later update.

The final step reloads the site, which restarts the very process running the
update. It was killed a moment before it could write "finished". The row stayed
"an update is running", the screen spun on a site that had updated perfectly,
and the next update was refused because one was apparently already in progress
— with no button offered to clear it. Every deployment using pm2 met this on
its first successful update.

The panel now settles such a run from evidence rather than leaving it open: the
process answering you is the one the reload started, so the version it is
running is proof of what the reload did. A run that stopped without ever
reaching the reload — a reboot during install, a build killed for memory — is
presumed dead after long enough that a slow build is never mistaken for one.

**"Clear this record" is now offered on a run in progress too.** A state with
no way out is a trap whatever put you in it.

No database changes.

---

## 2.1.0 — 2026-09-17

**Your own CSS, and an analytics tag.** Two things people have always had to
ask a developer for are now in the admin.

*Custom code* (Design → Custom code, administrators) holds CSS that loads on
every page of the site, after the theme — so it overrides Appearance rather
than fighting it. Beside it is a field for a **Google Analytics 4 measurement
id**. Not a box for a script: you give the engine the id and the engine writes
the tag, served from your own domain. There is deliberately nowhere to paste
JavaScript, because a field that accepts it turns every account that can sign
in into a way to run code in every visitor's browser. Everything else still
needs a change to the code, which is a review.

*Per page and per post*: every block's Design tab now has a **CSS class**
field, and every page and post editor has a **Custom CSS** panel. Name a
section, then write rules for it — and those rules load on that page alone.
Custom CSS travels with a revision, so restoring an old version of a page
restores its styling with it.

**Saving a page and not seeing the change.** This was three separate caches
and each is now answered.

Your browser was never told anything about how long it could reuse a page, so
it decided for itself; it is now told to check every time, which costs one
quick request and makes "save" and "refresh" mean what everybody assumes they
mean. A CDN or proxy in front of the site was being offered a *year* of
serving a stale copy — now five minutes, with one more minute while it
fetches a fresh one. And the site's own navigation kept a copy of each page in
memory for up to five minutes, which looked exactly like a browser cache to
the person staring at it; that is off.

For the times something still looks wrong, there is a **Clear cache** button
on the dashboard. It throws away every rendered page on the server. It says so
in those words, because no server can reach into somebody's browser — that
part is still a refresh.

**Database change.** Pages and posts gain a column for their own CSS. The
update takes a backup and applies it for you; on the Updates screen this
release is marked as needing a migration.

---

## 2.0.1 — 2026-09-16

**Fixes updating.** If 2.0.0 left your site broken, this is the release that
explains why and stops it happening again. No database changes.

**The update did not restart your site.** It ran `pm2 reload engine` — a
hardcoded name — and when your process was called something else it reported
"Built and ready" and carried on. The new build sat on disk while the old
process kept serving from memory, which is a crash waiting for the first
visitor. The update now *finds* the process by the directory it runs from, so
a server hosting several sites can never have the wrong one reloaded, and when
it finds none it says so plainly instead of claiming success.

**A failed migration no longer passes silently.** The update caught every
error from the migrator and continued to the rebuild, which could leave new
code running against an old database. It now stops.

**`npm run db:baseline` only records what it can verify.** It used to mark the
whole migration list as applied. On a database that was behind, that told the
migrator the new tables existed when they did not — and there was then no way
to create them. It now probes each migration for the table, column, type or
enum value it creates, and stops at the first one genuinely absent.

**New: `npm run db:status`.** What state is this database in, which migrations
have run, and is anything missing. It reads the site's own `.env`, because
`psql "$DATABASE_URL"` from a shell silently connects somewhere else and tells
you something untrue about your own site — a bad thing to discover in the
middle of a failed update.

### If you are on 2.0.0 and your site is down

Your database is almost certainly fine. Take this version, rebuild, and
restart the process by its real name — `pm2 list` will tell you what that is.

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
