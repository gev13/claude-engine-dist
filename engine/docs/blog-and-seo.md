# Blog, SEO, the 404 page and social links

Since 2.18. Every option starts at what the site already did.

## Around each post — Appearance → Blog

- **How a post opens** gains *Cover, then a title card*: the cover full-width
  at its own shape, then a rounded card with the title, excerpt and details.
- **Above the title** — the line with the category and date. Write your own
  with `{category}`, `{date}` and `{minutes}`, e.g.
  `{category} · {minutes} {minRead}`.
- **Back to the blog** above the title.
- **Share buttons** above or below the article, or as a bar down the left
  side on wide screens. Choose the networks — Pinterest is new.
- **Contents** — the article's headings, the one being read marked: a column
  on the left or right that follows the reader, or a list above the article.
  On a phone it sits above the article, folded.
- **Previous and next** — two links under the article, or an *Up next* card in
  the corner that appears a third of the way down, can be closed, and is
  hidden on phones.
- **Keep reading** — the latest posts of the same kind (as before), posts from
  the same main category, or from any category the post shares; two to six;
  as a grid or a carousel; with your own heading.
- **Author box** — picture, name, bio and links, from each author's Profile
  (*As an author*).

## The blog's archives — Appearance → Blog

- **Categories** as a row of chips (as before) or one *Categories* menu.
- **All** and **Research** chips: Research shows only when there is research,
  unless you say always or never.
- **Breadcrumbs** above the title of the blog and its archives.
- **A category's heading** — its name and description, or with its picture
  beside them (set the picture with the category).
- **Each card shows** its date, category, reading time and *Read more →*, in
  the shape you choose. The Post list block has the same options.
- **Posts → Category pages** — blocks above and below the posts on every
  category page: an introduction, a sign-up, a call to action.

## RSS

`/feed` for the whole blog and `/blog/category/<name>/feed` for a category —
the addresses WordPress used, so subscribers keep theirs. Blog pages announce
their feed to readers. Permalinks → Feeds switches them off or changes the
word.

## Titles and sharing — Settings → SEO

- **Page titles** — "Page — Site name" (as before) or the page's title alone,
  and the separator between them (`—`, `|`, `-`, `–`, `·`). Any page, post or
  project can use its title exactly as written: *Use exactly this title* in
  its SEO panel.
- **The share picture** is now the one chosen in the SEO panel (it was stored
  and never used), else the page's hero or the post's cover, else the
  *Default share picture*, else the bundled one — with its real size and
  type.
- **Structured data (JSON-LD)** typed into an SEO panel is added to the
  page's graph. Only objects with a schema.org `@type` are used.
- A page, post or project whose robots field says `noindex` is left out of
  the sitemap. Posts carry `article:section` (their category).
- The Organization in the structured data lists the site's social profiles
  (`sameAs`) and uses the brand logo from Appearance when there is one.

## The 404 page — Settings → Pages

Pick any published page to show for an address that does not exist. It keeps
the 404 status, is never indexed and is left out of the sitemap. Without one,
the built-in page shows — its words are in Site translations, and its second
button is a setting; unset, it links to `/services` only where that page
exists.

## Social links — Menus → Social links

Thirteen more networks: Behance, Dribbble, Vimeo, Pinterest, Telegram,
WhatsApp, Discord, Threads, Reddit, Twitch, Medium, email (`mailto:`) and
phone (`tel:`). **Show them as** icons (as before), names, or short labels —
"Fb. / Ig. / Lk." — each with its own abbreviation if you like. The header's
menu and the footer use this; the Social links block has its own styles,
short labels included.

## Services

Every link to a service, and its structured data, use the service page's
real address — `/what-we-do/strategy/audits` as much as `/services/audits`.
The Services index block's card labels ("Core", "Specialist") can be renamed
or left out, and the services list in the structured data belongs to
whichever page holds that block.

## Switching the blog off (3.7)

Appearance → Blog → *Switch the blog off*. Its index, categories, research,
posts, search and feeds answer "not found", and its sitemap is empty, until
it is switched back on. Nothing is deleted, and pages elsewhere on the site
are untouched — take links to the blog out of the menus yourself.

## Structured data you manage (3.20)

Two places, and everything left empty keeps what the engine works out by
itself.

**Admin → Structured data** (administrators) — the whole site:

- **Organization**: its type (Organization, Corporation, Online business,
  Professional service, Local business, and others), the topics it *knows
  about*, the *areas it serves*, other profiles beyond Menus → Social links
  (a directory, a registry, Wikidata), VAT and registration numbers, and a
  price range for the local-business types. Name, address, phone, founding
  year and logo stay in **Settings**.
- **Contact points**: sales, support, security… each with an email, phone,
  page and languages. The Settings contact email is always listed as
  customer support.
- **Services**: the defaults every service page starts from (category,
  audience, areas, currency), and *List every service on the Organization*,
  which adds an offer catalogue naming each service.
- **Every page**: the menus as site navigation, speakable hints, and the type
  posts are published as (Article, BlogPosting, NewsArticle…).
- **Preview**: any published page's structured data as search engines read
  it, with **Copy for a validator** — paste it into the Schema validator's
  or Google's code tab when they cannot fetch the site (bot protection or a
  firewall in front of it answers them instead of the page).

**The Schema panel** — beside SEO in the page, post and project editors:

- **Page type**: About, Contact, Collection, Item, FAQ, Profile… Automatic
  is a web page, and a page listing the services is a collection.
- **List of services**: an ItemList naming every service by its Service.
  Automatic puts it on the page with the services block, or on the page the
  service pages sit under (`/services` for `/services/…`).
- **Service** (service pages): name, service type, category, description,
  audience, areas served, a price or starting price with its currency, and
  an offer note — over the defaults above.
- **Posts**: the article type and a byline with a profile link.
- **Breadcrumbs** and the **FAQ** from the page's FAQ block can be switched
  off, and the page's own **JSON-LD** is here (it moved out of SEO →
  Advanced).

Every page also says its language (`inLanguage`), the picture it is shared
with (`primaryImageOfPage`) and what it is about (`mainEntity` — its Service,
its list). The menus are one `SiteNavigationElement` with a part per link.
The settings travel with a content export.

## Sitemaps in a browser, and their pictures (3.19)

Two switches in **Settings**, both off until turned on, and both carried by a
content export:

- **Readable sitemap in browsers.** Every sitemap names an XSL stylesheet
  (`/sitemaps/style.xsl`). Opened in a browser, `/sitemap.xml` shows as a
  table of its sitemaps and each sitemap as a table of addresses — with the
  number of pictures on each and when it last changed. The header row takes
  the theme's primary colour; the words are the `sitemap.*` entries under
  **Site translations**. Search engines ignore the stylesheet and read the
  same XML. Chrome is removing XSLT (announced for version 158), after which
  Chrome shows the plain XML; Firefox and Safari keep the table. Nothing a
  search engine reads depends on it.
- **List pictures in the sitemap.** Each address lists the pictures shown on
  it (Google's image sitemap): a page's blocks (synced blocks included,
  switched-off blocks left out), a post's cover and the body or blocks its
  layout shows, a project's cover and blocks. Only this site's own media
  library pictures, up to 1,000 per address.

## The organization, search consoles and exports (3.18)

- **Settings → Organization** (each left out of the structured data while
  empty): legal company name, another name people search for, founding year,
  phone, postal address, and a **logo for search engines** — a square PNG,
  JPG or WebP of at least 112px, because search engines do not take the SVG
  logo a header usually uses.
- **Settings → Search consoles**: the Google, Bing and Yandex verification
  codes (the `content="…"` of each tag), and the site's **X account** for
  shared cards (`twitter:site`). Social profiles for `sameAs` stay in
  Menus → Social links.
- The **search box** in the WebSite structured data is offered only while the
  blog is switched on — it pointed at a page that answered "not found".
- The **app manifest and home-screen icon** use the site's favicon
  (Appearance → Brand) and the browser bar follows the page colour, rather
  than the engine's own mark and colour.
- A **content export** now carries the title format and separator, the
  default share picture, the search-console codes, the X account and the
  missing-page settings. "Discourage search engines" and the default robots
  rule never travel, so a staging site's `noindex` cannot reach a live one.
- Fixed: a page's **"Use exactly this title"** never saved — the page routes
  kept a copy of the SEO rules without it.

## The post and the blog, closer to a finished design (3.22)

- **Above the title** — *That line's style*: after a short rule (as before),
  the category as a chip linking to it with the rest beside it, or text
  alone. Its case and face follow Appearance → Typography → Labels.
- **The row under the title** (author, reading time, categories) — off, or
  any part off. **The excerpt under the title** — off.
- **Reading time** — each post can state its own (Post editor → Reading
  time), kept instead of the counted one; an import keeps it when the archive
  carries `seo.readingMinutes`.
- **Share buttons → A column beside the article that follows the reader** —
  inside the post, beside the contents column, instead of over the page's
  edge where the side rail is. The networks keep the order you choose, and
  can be moved.
- **Keep reading → Cards → The archive's cards**: pictures, date, reading
  time and *Read more*, as the blog's archive draws them.
- **Previous and next → the corner card**: on phones too; closed for this
  post only rather than for the visit.
- **Cover, then a title card → overlap**: how far the card rides up over the
  cover; 0 starts it right under.
- **The blog's pages**: no search box (searching by address still works); one
  row under the title with the breadcrumbs on the left and the result count
  and the categories on the right; the “Browse” label off; the card grid with
  each post's cover. The *Categories* menu closes on a click outside and on
  Escape. Fixed: breadcrumbs over an archive's title stood a gutter in from
  the title.
- **Pictures inside a post's text** carry their stored width and height (no
  jump as they load), and a `srcset` of their sizes when responsive images
  are on.

### Addresses

- With the trailing slash set to *always*, the home page's canonical and
  hreflang addresses end in `/` like every other.
- `/…/page/1` and a padded page number (`/page/02`) answer **301** to their
  one spelling; `/page/0` is not found.
- The research archive answers only when there is research, and leaves the
  blog sitemap otherwise; a category with no published posts, or set to
  noindex, leaves it too.
- A Blog page without a list that pages on the server still has `/page/2` and
  beyond: past the first page the built-in archive answers.
- Pasted JSON-LD may be a whole document (`{"@graph": [...]}`, as Yoast
  writes it) or name several types (`"@type": ["LocalBusiness", "Store"]`);
  both used to be dropped.
- Redirects decided inside a page route (a post under its old category, a
  managed redirect found at a 404) still answer 308: Next.js page routes can
  only answer 307 or 308. Search engines treat 308 exactly as 301.

## The blog's pages, closer again (3.23)

Every option below is off, or draws what it drew before, until it is set.

- **A page at the blog's address now keeps the list on page 1.** Its blocks
  come first and the built-in list follows, as on page 2 and beyond. A page
  with a Post list of its own still shows only its blocks.
- **Appearance → Blog → Index → The blog's search title and description**
  are the index's title and description when no page stands at its address.
  *That title exactly as written* leaves the site's name off the end.
- **Cards**: *The excerpt* off (the blog's pages and every Post list), and
  *The category as a chip under the title*, which also takes it out of the
  date line. A card prints *Read more* once. It used to print it twice on a
  card grid with *Read more* ticked.
- **Posts per category page**, separate from the blog index. Empty follows
  the archive setting.
- **A category's label**: the eyebrow above its title (as before), a
  subtitle under it (“Category”, a Site translation), or none. The
  categories menu is in the toolbar on category pages too.
- **Post → Cover, then the title in the article**: the cover full width, then
  the line above the title, the title and the text in one column, with no
  card behind the title. **The full-width cover's height**, and on phones,
  applies to both cover layouts (e.g. 600px / 240px); empty keeps the
  picture's own shape.
- **Page numbers**: circles (as before) or rounded squares, the current
  page's fill and number colours, the edge colour, and the site's text face
  instead of the label face.
- **Post list → How many** is *Posts on each page* when the list pages on
  the server. It never capped the total there; the pages go on until the
  posts run out.

## Card titles (3.24)

- **Appearance → Blog → Each card shows → Titles**, and the same in a Post
  list's cards: every line (as before), or two or three lines at most with an
  ellipsis.

## Rich text from the theme (3.26)

**Appearance → Typography → Rich text** reaches posts and every rich-text
field. Empty draws it as it always was (17px / 1.72, headings at 0.85 and 0.9
of the theme's h2 and h3, a short dash before each bullet item).

- **Text size and line height**: its own, or the Body role's.
- **Headings' scale**: 1 is exactly the theme's h2 and h3.
- **Between paragraphs**, **above an h2 or h3**, **above an h4**, **after a
  heading**.
- **Before each bullet item**: a dash, a disc or nothing, with the list's
  indent and the space between items.

A block's own Body text size (Design → Typography) reaches its rich text too.
The Text block's plain paragraphs can run the full width instead of about 62
characters.

## The last details (3.28)

Every option below is off, or draws what it drew before, until it is set.

- **Dates** on archive cards, the post list and related posts follow
  Settings → Date format and time zone (they were always "24 Sept 2026").
- **Appearance → Blog → Details — archive cards**: *Contained* puts the
  picture flush at the top and the words on a panel of their own colour,
  padding (and on phones) and corners; the gap between cards; columns on
  tablets; no colour change when pointed at; the date's and the reading
  time's type, the title's face, size (and on phones), weight, line height
  and spacing; a filled category chip; "Read more" type and the space above
  it. They reach the blog index, categories, related posts drawn as archive
  cards (with a hover of their own) and a post list set to *Drawn as the
  blog's archive cards* (which can also leave out "All writing →").
- **— archives**: the title per tier and the space above it; the "Category"
  label's type and place; breadcrumbs' size and "Home" weight, and a
  category's trail without the blog (Home › Category — the structured data
  follows); the category menu drawn as a select naming the current category;
  on phones, the count and categories behind a *Filters* button (with the
  row under the title); the pager's alignment, button size, gap, face, size,
  weight, no disabled "previous", and ← → arrows; the space from the row to
  the cards and under them.
- **— a post**: the container's, the contents column's and the text
  column's widths; the space under the cover; the title per tier and its
  width; the line above the title with only the category in the accent; the
  contents shown once it sticks, on a panel, with its title and item type,
  the current item's colour and the FAQ questions listed too; solid share
  icons on one panel; tablets keeping the columns; on phones, the share row
  at the end and no contents; links without underline; tables (size,
  padding, lines under rows only, their colour); list markers' colour;
  related posts' heading and width.
- **Blocks inside the article**: a paragraph holding only `[[block:2]]`
  draws the post's second block there, in the article's column (a slider,
  an FAQ, a picture); placed blocks are not repeated after the article. The
  space around them is a detail above.
- **Rich text**: the space above headings on phones.
- **Up next** (the corner card): the newer post only, shown from the start,
  hidden over related posts, without a close button or arrows, its width,
  colour, corners and title type.
