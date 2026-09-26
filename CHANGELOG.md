# Changelog

Every release of the engine, newest first. A site reads the machine-readable
version of this from `releases.json`; this file is for people.

Versions follow semver, read this way since 3.0: the patch digit (x.x.1)
for a fix or a very small change, the minor (x.1.x) for a medium or large
change, the major (1.x.x) for a large release of new features and
improvements.

---

## 3.0.1 — 2026-09-26

**An update no longer reports a failed reload that worked.** pm2 stops the
old process together with everything it started — including the update's
own `pm2 reload` command — so a successful update could end with “Command
failed: pm2 reload …” while the site was already running the new version.
The reload is now read from the version the restarted site reports, and a
record left by an earlier update is settled the same way. The release list
is also held to the limits every site checks, so an over-long description
can no longer hide updates (“The release feed is not in the expected
shape”).

---

## 3.0.0 — 2026-09-25

**A new major version.** 3.0 gathers everything since 2.12 — permalinks and
redirects (2.13), projects (2.14), saved blocks and duplicates (2.15), tags,
consent, CAPTCHA and form routing (2.16), video and SVG (2.17), blog and SEO
parity (2.18), headers, menus and motion (2.19), checked and merging imports
with a WordPress importer (2.20), cut corners, panels and the notch header
(2.21) and the 2.22 sections — and adds:

**Glitch text.** A block's Design tab → Effects → *Glitch on the heading*:
*noise*, *psycho* or *split*, on the first heading or every heading, all the
time or only on hover, in colours of your choosing. It runs only while on
screen, is read once by screen readers, and stays still for anybody who
asked for less motion. Off until chosen.

**Platform credits.** Every page names the platform and its creator in two
meta tags (`generator`, `creator`) that are not ranking signals and change
nothing a search engine reads about the site; Settings shows the same, with
the version, read-only.

**One name.** The last traces of the project the engine grew out of are
gone from the code and the documentation. Admin sign-ins are signed under
the engine's own name now, so everybody signed in is asked to sign in once
more after updating.

No database changes in this release. A site updating from 2.12 or earlier
runs the migrations of 2.13–2.19 on the way, and needs Node 22.12 or later.

---

## 2.22.1 — 2026-09-25

**Nothing fixed that should be editable.** Every “Read more” on cards,
posts, related posts, search results and picture rows now comes from Site
translations (`block.readMore`, `blog.readMore`) instead of fixed English.
The media band's fade starts from the site's accent colour instead of a
fixed one, and the space the notch header leaves above the first section
follows the header's own height setting. Sample names in the shipped tests
are neutral.

---

## 2.22.0 — 2026-09-25

**Picture rows.** A Card grid layout for a list of services: a large
picture, a running number, the title, text and a *Read more* link. The
Card grid can also hold its cards in **rows of mixed widths** — two, then
three — and number them.

**Stats** can glow in the accent colour and stand apart with thin lines.
**Check lists** can put their marker on a tinted circle, use hairline rules
and sit in a card. **Forms** take a short line beside the send button.

**Category index** — a new block listing the blog's categories (or the
projects') as numbered cards, each linking to its archive.

**Blog** — the search box can sit at the end of the category bar, and the
newest post can open the blog as a large card. **“Read more” links** can
carry their arrow on a small circle, everywhere. Every hero layout now shows
its kicker line.

---

## 2.21.0 — 2026-09-25

**Cut corners.** Cards, buttons, form fields, chips and pictures can have
their corners cut on the diagonal instead of rounded — the length and which
corners, per kind of element, under Appearance → Shape. A section's corners
and a single card's are set in its own style. Buttons keep their glow and
border along the cut; chips and fields keep a line along it.

**Panels.** Tick *Panel* in a section's Design tab and it sits on the page
as an inset panel in the panel colour and corners, set once in Appearance.
A section with rounded corners can clip the pictures inside it.

**The notch header.** A new layout: the logo and links in a tab cut into the
top of the first panel, with curved inner corners. Header links gain their
own font, size, weight, case, spacing and colours.

**Buttons** gain a font of their own, a glow, and an arrow in a compartment
of its own. **Section labels** can open with a dot instead of a line, or
nothing. The **media band** can fade a colour in from one side, with dark
text and buttons for a light colour.

**Fonts.** Chakra Petch joins the catalogue. A section's own typography can
use any catalogue face — choosing one there failed to save before.

---

## 2.20.0 — 2026-09-25

**Imports are checked.** Every row of a content archive now passes the
checks the editor's own save applies — blocks no page could draw, HTML,
slugs and paths, redirects, settings, and every reference — before anything
is written. The screen lists each refused row with its reason; stop, or
import the rest without them. Reading times are recounted, the search index
rebuilt when Meilisearch is on, and the caches cleared. The report — created,
updated, skipped, refused — downloads as a CSV.

**Merge.** An import can now add and update instead of replacing: a row
updates the one here with the same id, or the same address in the same
language; nothing is deleted; a media file already here (same bytes) is not
copied again. Content can arrive in batches, and new projects later. The
archive format is documented, with a JSON Schema for every table, for tools
that write archives (`docs/transfer-format.md`).

**Import from WordPress** (Administration). Read an export file or a live
site's REST API, map each content type and taxonomy — posts, pages, a
portfolio type into Projects — and check what that would do before doing
it. Page builders' shortcodes become clean HTML, accordions become an FAQ
block, Yoast titles and descriptions become the SEO fields, featured images
and the files the content uses are downloaded and pointed at, and every
address that changes gets a 301. Running it again updates what the first
run made.

**Appearance → Motion.** The pointer, page changes, the reveal footer and
the side rails in one place, with a new *Reduce motion for everyone*.

---

## 2.19.0 — 2026-09-25

**The header.** A new layout — a round menu button, the logo, links and a
button, the menu button opening the full-screen menu at every width. Any
header can now be solid, see-through or frosted glass; hide going down and
come back going up, or shrink; have its own height per screen size; and
centre the logo on phones.

**The full-screen menu** can list a separate Overlay menu (Menus), whose
links carry pictures shown beside the list under the pointer; its links can
be huge, arrive one after another, and let the page show through. The
creative menu's contact column takes a heading and a phone number. Focus
stays inside the open menu.

**Site-wide motion**, each off until chosen (Appearance → Site-wide): the
site's own pointer (dot, ring, both, or an inverting disc, with a word over
pictures); page transitions (fade, rise, slide or a curtain); a logo
preloader on the first page of a visit; and side rails with scroll-to-top
progress and the social links. **The footer** can wait underneath the page
and be revealed, and take its own background.

**One page's colours.** A page, post or project can have its own
background and use the site's alternate palette; a section can use the
alternate palette from its Design tab.

**Blocks.** Hide a block on any screen size on its own, not only "this size
and smaller". Put a column first (or second…) per screen size. Cards in post
lists, the blog's archives and projects can lift, grow, cast a shadow or
tilt in 3D with a glare, and zoom their picture. Reviews take a role and a
company, a logo on a coloured circle, no stars, and their own card
background, corners and quote mark — the Quotes slider too. Galleries hold
200 pictures and can show a few with *Load more* or load as the visitor
scrolls; the viewer swipes; several pictures can be added from the library
at once.

**Also fixed.** The blurred video play button had lost its blur in Chrome.

Includes a database migration: a colours column on pages and posts. Take the
backup the Updates screen offers.

---

## 2.18.0 — 2026-09-25

**Around each post.** Appearance → Blog now offers, each off until chosen:
share buttons above or below the article or as a bar down the left side
(Pinterest is new); a contents list that follows the reader in a side column
and marks the section being read, or sits above the article; previous and
next posts, as two links or an *Up next* card in the corner; *Keep reading*
from the same category or any shared one, two to six, as a grid or a
carousel, with its own heading; an author box with the picture, bio and links
each author sets in their Profile; a *Back to the blog* link; your own line
above the title (`{category} · {minutes} min read`); and a new opening —
the cover at its own shape, then a title card.

**The blog's archives.** Categories as chips or one *Categories* menu; the
All and Research chips optional (Research now shows only when there is
research); breadcrumbs; what each card shows — date, category, reading time,
*Read more* — and its picture shape, on archives and in the Post list block;
a category heading with its picture; and blocks above and below every
category's posts (Posts → Category pages).

**RSS.** `/feed` for the blog and `…/category/<name>/feed` for each
category, the addresses WordPress used. Blog pages announce their feed.
Permalinks → Feeds changes or switches them off.

**SEO fixes.** The Open Graph picture chosen in a page's SEO panel is finally
used — else its hero or cover, else a new default in Settings — with its real
size. Structured data typed into the SEO panel is now added to the page.
Pages, posts and projects marked `noindex` leave the sitemap. Titles can drop
the site name, change the separator, or — per page — be used exactly as
written. The Organization lists the site's social profiles and its logo.

**The 404 page** can be any page (Settings → Pages); it keeps the 404 status
and stays out of search. The built-in one's words are in Site translations,
and its "All services" button appears only where there is a services page.

**Social links** gain Behance, Dribbble, Vimeo, Pinterest, Telegram,
WhatsApp, Discord, Threads, Reddit, Twitch, Medium, email and phone, and can
show as names or short labels ("Fb. / Ig. / Lk.") in the header menu and the
footer.

**Services follow their pages.** Links and structured data use each service
page's real address, not `/services/<slug>`; the Services index block's
"Core" and "Specialist" labels can be renamed or hidden.

**Also fixed.** One unreadable value on the Settings screen no longer resets
every setting to the defaults.

Includes a database migration: author details on accounts and a picture on
categories. Take the backup the Updates screen offers.

---

## 2.17.0 — 2026-09-25

**Video that plays on iPhones.** The site now answers the partial requests
iOS Safari makes before it plays an MP4 — before, a hero or band video could
sit there as a still. It also tells browsers when a file has not changed, so
they stop downloading it again.

**Moving pictures.** The video block has a new way to play: *as a moving
picture* — an uploaded film, muted and looped, with no player, like an
animated image. It plays only while it is on screen, never by itself for
somebody who asked for less motion (they get the poster and a play button),
and its box takes the film's own shape from the start, so nothing jumps as
it loads. Add a WebM beside the MP4 and browsers pick the lighter one.
Gallery pictures can be films too, and open in the viewer with controls.
Background videos everywhere — heroes, bands, slides — now pause when they
scroll out of view.

**A film behind any section.** Design → Background → Video, on any block or
row: a film under the overlay colour and the content, with a lighter file or
just the poster for phones. Visitors with data saver on get the poster.

**SVG uploads.** Logos, icons, the header logo and the favicon can be SVG.
Each upload is rebuilt with only its drawing — no scripts, no links out —
and served so nothing in it can run. Security → SVG uploads decides who may
upload one (administrators and managers to begin with).

**Picture sizes.** Media → Picture sizes → *Responsive images* makes smaller
copies of every picture (up to six widths, WebP and optionally AVIF), and
every image on the site then offers them, so a phone downloads a
phone-sized picture. It runs in the background for the pictures you already
have, with progress on the screen. Off until switched on.

Uploading a video now records its size and length, shown in Media.

INSTALL.md has an optional nginx setup for serving media directly.

Includes a database migration: two new columns on media. Take the backup the
Updates screen offers.

---

## 2.16.0 — 2026-09-25

**Integrations.** Settings → Integrations switches on tracking and marketing
tags by their id: Google Tag Manager, Google Analytics 4, Google Ads, Meta
Pixel, LinkedIn Insight, Yandex Metrica, Microsoft Clarity, Hotjar and TikTok
Pixel. The engine writes each vendor's loader — nothing is pasted — checks
every id, and puts each tag in a consent category. Google Consent Mode v2 is
one tick. Custom snippets, for anything else, stay hidden until an
administrator allows them. A GA4 id from *Custom code* moves here; that
screen is now *Custom CSS*.

**A content policy built from what is on.** The public site's
Content-Security-Policy now lists exactly the hosts the switched-on tags,
snippets and CAPTCHA need, and nothing else — so a site without analytics
no longer allows Google Analytics' hosts, as every site did before. The
Security screen names every third party the public site talks to.

**Cookie consent.** The cookie notice can now ask: *Accept all* and *Reject
all*, equally prominent, and *Preferences* with a switch per category. Tags
wait for their category. Change the categories, or press *Ask everyone
again*, and visitors are asked afresh; withdrawing consent removes those
tags' cookies. It can ask only where the law requires it (from your CDN's
country header), and keep an anonymous daily count of the answers. The
notice mode stays the default.

**Bot protection.** Security → Bot protection adds Cloudflare Turnstile,
reCAPTCHA v2 or v3, or hCaptcha to form blocks, the contact form, newsletter
sign-ups and job applications — each on or off, and per form block. The
secret key is kept encrypted, test keys are one click, the widget loads only
when a form comes into view, and you choose what happens when the provider
is down.

**Forms that do something when they are sent.** A form block can:

- email up to ten addresses of its own, with a subject built from the
  answers, Reply-To set to the visitor, and — if you choose — every answer in
  the email as a table, files as links into the admin;
- send the visitor an automatic reply;
- open a thank-you page, and send the conversion to your tags
  (`generate_lead`, a Google Ads conversion, a Yandex goal, a LinkedIn
  conversion) — the contact form can too;
- carry hidden fields — a fixed value, the campaign the visitor arrived with
  (`utm_*`, `gclid`, `fbclid`), the referrer, the landing page — stored with
  the answers and exported as columns;
- show a question only when an earlier answer calls for it.

**Webhooks.** Enquiries → Webhooks hands each submission to a CRM, Zapier or
Make as signed JSON, with retries, a delivery log and Resend. Administrators
only; addresses on private networks are refused.

**Also fixed.** The cookie notice in the *centre* position left a tall empty
gap under its text, and on a phone its buttons could wrap out of sight.

Nothing changes until it is switched on: a form sends the same count-only
email it always did, and a site with no tags loads nothing new.

Includes a database migration: two new tables and a column on form
submissions. Take the backup the Updates screen offers.

---

## 2.15.0 — 2026-09-25

**Saved blocks.** Design a block once and use it anywhere. Every block's new
**⋯** menu has *Save as a saved block…* — a whole row, columns and all, too.
A **synced** block is the same on every page that uses it: edit it once and
every page changes. A **template** pastes an independent copy each time.
Both appear under *Add block → My blocks*, with search and folders.

A synced block sits in a page as a locked card with *Edit the original* and
*Detach*, which turns that one place into its own copy while the others stay
synced. Its Design tab there sets only its outer spacing and where it shows.
Design → **My blocks** lists them with how many places use each, and edits
one in a full builder with its last 30 revisions. One still in use cannot
simply be deleted — *Detach everywhere, then delete* gives every page its own
copy first. A saved block cannot contain itself, nests at most three deep,
follows the page's language, and a form or an FAQ inside one works — the
form accepts submissions and the FAQ becomes structured data — as if it were
on the page.

**Duplicate.** Pages, posts, projects, saved blocks and popups can be
duplicated — from their lists and their editors. The copy is a draft that
renders exactly like the original, with new ids for every block, forms
renamed "(copy)" so their submissions are filed apart, the same categories
and tags, no canonical address, and you as its author. It opens straight
away; the original is not touched.

**Copy and paste between pages.** *Copy block* or *Copy row* from the ⋯ menu,
then *Paste above*, *Paste below* or the *Paste* button in any other builder —
a page, a post, a project, a popup or a saved block. Pasted blocks are checked
and get new ids.

**Also fixed.** Duplicating a row in the builder gave the copy's columns and
the blocks inside them the same ids as the original's, so styling one
restyled both. Every copy — duplicate, paste, template — now gets new ids
all the way down.

Includes a database migration: two new tables and a new revision type. Take
the backup the Updates screen offers.

---

## 2.14.0 — 2026-09-25

**Projects.** A portfolio, as content: each project is a page of its own,
built from blocks, filed under categories and tags, with a cover for cards, a
picture it swaps to on hover, and a full-width header picture or video. It has
drafts, scheduled publishing, a preview link, revisions and a trash, like a
post. Content → Projects; an author writes them and an editor publishes them.

Every project page shares one layout, set once under Projects → Page template:
a full-width hero, the title beside the hero, or the title alone; category
chips and the client, year and live link, each optional; then the project's
own blocks; then **More projects** from the same category (topped up with the
newest when there are too few), as a grid or a carousel; then any blocks you
want after every project — usually a call to action. A project can leave
"More projects" off, or give its page a background colour of its own.

Categories and tags each have an archive page, paged on the server, with the
description you write for them. Projects have their own sitemap, `CreativeWork`
structured data, a section in `llms.txt`, and can appear in the site's search.
They travel with Export & import and with backups.

**Lists that fill themselves.** A Projects block can now take its cards *from
Projects* instead of a typed list: some categories or tags, featured only,
leave out the project whose page this is, in your order, newest first or
shuffled — so the home page's highlights, a listing page and a service page's
related work update themselves when a project is published. Past the first
few: a **Load more** button, or real pages (`/work/page/2/`). Each card shows
its categories as links, and the filter buttons are the real categories.

A typed list is unchanged, and can now hold 200 and show a few at a time.

**Addresses.** Settings → Permalinks gains the three project addresses —
`/projects/<slug>` and its category and tag archives by default, or
`/portfolio`, `/portfolio-category` and `/portfolio-tag` for a site moving
from a WordPress portfolio theme — and the 301s from old addresses cover
projects too.

**Also fixed.**

- `npm run release:merge` refused every merge into a site that had changed a
  file of its own, reporting the site's copies as lost when they had
  survived. It compared the files from the wrong directory.
- The posts list in the admin shows each post's real address, not `/blog/…`.
- Backups have a test that fails when a new table is neither backed up nor
  deliberately left out.

Includes a database migration: three new tables and a new revision type. Take
the backup the Updates screen offers.

---

## 2.13.0 — 2026-09-25

**The blog's addresses are a setting.** Settings → Permalinks decides where a
post lives — under the blog (`/blog/<slug>`, what every site has today), under
its category (`/<category>/<slug>`) or at the top level (`/<slug>`) — where
category archives live (`/blog/category` by default, `/category` if you
prefer), where the blog index is, and the word in `/page/2`. A site moving
from WordPress keeps every address it had.

Every link the engine writes follows it: cards, lists, the search box,
breadcrumbs, the sitemap, `llms.txt`, canonicals and structured data. A post
reached through the wrong category is sent to its own address. Changing the
permalinks on a live site offers to write a 301 from every old address to its
new one, in the same save; the screen shows how many addresses move before
you commit.

**Trailing slashes.** *Never* (today) or *Always*: every address the site
writes ends in `/`, and the other spelling answers with a 301. It is a
setting, not a rebuild.

**Archives page on the server.** The blog, each category and research have
real pages — `/blog/page/2/` — rendered on the server, so every post is
reachable without a script and by a search engine. Each page has its own
canonical and a `rel="prev"`/`rel="next"` pair; `/page/1` redirects to the
archive itself, and a page past the last is a 404. Appearance → Blog → Archive
pages sets how many per page, whether the links are numbers, previous/next or
a "Load more" button (a real link underneath, so it works without a script),
and an optional "Showing 1–12 of 110 results". Left alone, the blog still
shows 24 and a category 48 — past that they now page instead of stopping.

A Post list block can do the same on any page ("Real pages" under *Show*), so
a `/news` page built from blocks gets `/news/page/2` too.

**Posts can show their blocks.** A post's Blocks tab was saved and never shown
on the live post — only in the preview. Now each post chooses: the article
only (as before), its blocks only, the article then its blocks, or the blocks
then the article. The preview uses the same component as the live post, so
what you check is what goes live. An FAQ block in a post adds FAQPage to its
structured data beside the Article, and a form block inside a post accepts
submissions. The post builder leaves out heroes unless the blocks come first.

A post's article can now carry an inline video from the media library and a
YouTube or Vimeo player, and every h2 and h3 gets a stable id when it is
saved, so a table of contents can link to it.

**Redirects: prefixes, patterns, queries, and CSV.** A rule can match a path
exactly (as before), a path and everything under it (`/portfolio-tag/*`,
optionally keeping the rest of the path), a regular expression (administrators
only; patterns that could hang the server are refused), or a query
(`/?s=*` → `/blog?q=$1`). Import a CSV — the engine's own `from,to,status,note`
or Yoast's export — see exactly what it will create, update, skip or refuse,
then import it in one go; export the lot the same way. Chains are saved as one
hop (A→B, B→C becomes A→C) and a loop is refused with the loop named.

A redirect still never hides a live page. Rules now also apply to missing
category and post addresses, which they used to skip.

**Also fixed.**

- The current page is marked in the header menu on every page. It was only
  ever marked on the blog, because the server and the browser disagreed about
  the address.
- An import (Export & import) now clears the page cache when it finishes.
- A saved change to a page now clears the cached copy under its language
  prefix too.
- A search of the blog is `noindex`, as search result pages should be.

**Under the hood.** The middleware runs on Node instead of the Edge runtime,
so it can read settings; if you run the engine behind something that only
supports Edge middleware, say so before updating.

Includes a database migration: two columns on redirects, one on posts. Take
the backup the Updates screen offers.

---

## 2.12.0 — 2026-09-18

**A converging diagram can have more than two sources.** Add a fourth or a
fifth label and you get a fourth or fifth box, with its own curve into the
destination. The last label is always what everything meets at; everything
before it is a source.

Until now the diagram was two boxes and two curves drawn at fixed positions, so
a third name was something you could type and save and never see. It works out
its own layout now: the sources spread evenly, stay centred on the
destination, and the drawing grows rather than letting the boxes collide.

Three labels still draws exactly the diagram you have today, to the pixel.

**And you can change how it looks.** Under *How the diagram is drawn*: the
colour of the lines, the background grid, the source outlines and their text,
the destination's fill and its text; the two text sizes; how thick the lines
are; and rounded corners. Empty means the colour it is drawn with now, so a
diagram you do not touch is unchanged.

Space around the diagram stays where all spacing is — the block's Design tab.

No database changes.

---

## 2.11.2 — 2026-09-18

**The other place that diagram comes from.** A hero can draw the converging
diagram beside its heading, from its *own* labels — a separate setting from
the figure block that draws the same picture. 2.11.1 fixed the figure block's
empty label list and left the hero's exactly as it was, so if your diagram
comes from a hero you were typing into a box that was never driving it, and
the page quite correctly did not change.

Both now show the words that are on the page, ready to be typed over.

**A fourth label on a converging diagram no longer offers itself.** That
diagram draws three — two sources and what they meet at — so a fourth box was
somewhere to type that could never appear. The layer stack still takes five.

No database changes.

---

## 2.11.1 — 2026-09-18

**The words in a diagram can be edited.** The figure block draws “SOURCE A”,
“SOURCE B” and “OUTCOME”, and its label list in the admin started empty — so
there was no box anywhere containing the words on the page, and the diagram
looked like something you were not allowed to change. You were; nothing said
where.

The list now holds those words, ready to be typed over. Nothing is stored
until you change one, so a page you do not touch stays exactly as it is.

Switching between the two diagrams brings the right words with it — a layer
stack no longer arrives labelled “SOURCE A” — while anything you wrote
yourself is kept. And a new figure block starts with its labels filled in
rather than blank.

No database changes.

---

## 2.11.0 — 2026-09-18

**Space between items, and how fast things move — for the whole site or for
one block.** Both appear in Appearance → Layout, and again in every block's
Design tab where they override the site-wide setting.

Left empty, every block keeps the spacing and timing it was drawn with. Those
differ between blocks on purpose, so there is no single default imposed on
them — nothing in this release changes how your site looks.

**Space between items** means the cards, tiles and list entries a block lays
out. It deliberately does not touch the spacing *inside* things: an icon beside
a word keeps the distance it was drawn with, because widening that to match a
card grid would look broken. A gap set on a row also stops at that row — the
blocks inside its columns keep their own.

**Animation speed** is a multiple rather than a duration: normal, twice as
fast, twice as slow, or off. A block usually has several timings — a quick
hover and a slower entrance — and one duration for both would flatten a
difference somebody chose. Setting it to off stops that block animating; the
reduced-motion setting a visitor's own device asks for still wins over all of
it.

No database changes.

---

## 2.10.0 — 2026-09-18

**Nothing on your site changes in this release.** Every default below is the
value that was already compiled in. What changes is that you can now alter
them.

**Status colours are yours.** The green of an “open now”, the amber of a
warning, the red of a closed sign, the gold of a star — and the six colours a
chart cycles through. Appearance → Colours. They are kept apart from your
palette on purpose: a success green that follows your brand accent stops
meaning success, so they are not tied to it. Change them only if they clash.

**Text sizes inside blocks are yours.** Intro paragraphs, card text and small
print were fixed at 17, 16 and 15 pixels, written into the components in a way
that silently overrode Appearance. They are now three fields under Typography.
They are deliberately not merged into the body role — doing so would have moved
every intro paragraph on every site by a pixel without anybody asking.

**The words inside blocks can be translated.** Slider arrows, the close button
on a picture viewer, page and breadcrumb labels — around two dozen phrases a
screen reader announces were written in English inside the components, so they
stayed English on an Armenian or Russian page. They are now in Site
translations with everything else.

One honest limit: a block is not told which language its page is in, so the
breadcrumb and search labels fall back to your site's default language rather
than the reader's. Labels that build a sentence from your content — “Compare
this and that” — are still English and need a larger change.

No database changes.

---

## 2.9.0 — 2026-09-18

**Space between cards.** A card grid now has a *Space between cards* field
beside its column count. It is a different thing from a card's own margin,
which shifts that card inside its cell and leaves the distance between two
cards exactly as it was — the distinction that made margin feel broken when
used for this.

Left empty, each layout keeps the spacing it was designed with. Those are not
all the same on purpose, and one number for all of them would flatten a
deliberate difference. It applies to every card layout.

No database changes.

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
