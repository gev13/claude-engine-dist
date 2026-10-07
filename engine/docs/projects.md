# Projects

Since 2.14. A portfolio: each project is a page of its own, built from blocks,
filed under categories and tags, and listed automatically wherever a Projects
block asks for it.

## Where things are

| Screen | What it does |
|---|---|
| **Content → Projects** | the list: search, status, category or tag, featured, trash |
| Projects → *a project* | the editor: details, intro, blocks, filing, pictures, credits |
| Projects → **Categories & tags** | how projects are filed, and each archive's name and description |
| Projects → **Page template** | the layout every project page shares (managers and administrators) |
| Settings → **Permalinks** | where projects and their archives live |

## A project

- **Title, slug, card line** (one line for cards) and **description** (for
  search results).
- **Intro** — rich text shown in the header, under the title.
- **The project** — ordinary blocks: full-width pictures, sliders, videos,
  text. Heroes are available.
- **Filing** — a primary category (what "More projects" follows), more
  categories, and tags.
- **Pictures** — the *cover* for cards, a *hover* picture a card can swap to,
  and the *header* picture or video at the top of the page (the cover is used
  when it is empty).
- **Credits** — client, year and a link to the live work.
- **Featured** and **Order** — for lists that ask for featured work or for
  the order you set.
- **This project only** — leave "More projects" off this page, or give it a
  page background of its own.

Projects have drafts, scheduled publishing, a preview link, revisions and a
trash, like posts. An author writes projects; an editor publishes them.

## The page template

- **Header**: a full-width hero then the title; the title beside the hero; or
  the title alone.
- Category chips above the title, and client / year / live link under the
  intro — each optional.
- **Hero height** and **on phones** (e.g. 640px / 360px); empty keeps 16:9
  and 4:3. **Title and intro width** (e.g. 42%, or 520px) for a narrow
  heading column, full width on phones. **Categories above the title** as
  chips (as before) or plain text. *(3.23)*
- **More projects** after each project: from the same primary category
  (topped up with the newest when there are too few) or simply the newest; one
  to six; as a grid or a carousel; with its own heading.
- **Archives**: the card style, columns and projects per page for category and
  tag pages, which page on the server (`/portfolio-category/branding/page/2`).
- **Search**: optionally show matching projects above the posts in the site's
  search results.
- **After every project**: blocks shown at the end of every project page —
  usually a call to action.

## The cards' own look (3.24)

The projects block and the archives (Page template → Archives) share one set
of card options, each unset as before: the picture's shape (square, 4:3, 3:2,
16:9, portrait, or each file's own) and corners; how far it zooms on hover
(e.g. 1.06); the categories as chips or plain text; and **On hover, the
category line slides away and a link line slides in** — its words (empty is
the Site translation “View project”), its colour and a short line after it.
The drawn link goes to the same address as the card and is kept out of the
tab order and away from screen readers, which already have the card's own
link.

*(3.25)* The link line sits inside its card, right under the title and a
year or summary when the layout shows them; it used to overlap the next row.

*(3.26)* The cards also take the title's size, weight and letter spacing,
the category's size, the space under the picture, and the gaps between
columns and rows — on the block and on the archives.

## Listing projects anywhere

A **Projects** block's *Where the projects come from* can be **From Projects**:

- only some categories or tags, featured only, and "leave out the project
  whose page this is";
- the order set on each project, newest first, or shuffled;
- how many, and what happens past that: stop, a **Load more** button, or real
  pages (`/work/page/2`).

Every card links to its project and shows its categories as links to their
archives. The category filter buttons are built from the real categories, and
keep working over cards "Load more" brought in.

Examples:

| Where | Settings |
|---|---|
| Home "Highlights" | From Projects · featured only · 6 · three per row |
| `/projects/` | From Projects · 12 · Load more |
| A service page's related work | From Projects · its category · 3 · carousel |

## Addresses

Defaults for a new site: `/projects/<slug>`, `/projects/category/<slug>`,
`/projects/tag/<slug>`. A site moving from a WordPress portfolio theme sets
`/portfolio`, `/portfolio-category` and `/portfolio-tag` under Permalinks, and
can write 301s from the old addresses in the same save. The page that lists
every project is an ordinary page with a Projects block on it.

Projects have their own sitemap (`/sitemaps/projects.xml`), `CreativeWork`
structured data, a section in `llms.txt`, and travel with Export & import and
with backups.

## The last details (3.28)

Projects → Page template → **Details**, each unset as drawn: the hero
picture growing a little as the page scrolls; a round back button (it goes
back in the visitor's history, or to the project's category) on project
pages and their archives; the tags in a column beside the title (under it on
phones); the title per tier; the space from the hero to the categories, the
categories' weight and the spaces under them and the title; an archive's
title size, the space above it and from it to the cards.

**Cards** (the template's archives and the projects block): *Words on a
panel* with its padding (and on phones), the space under the title, and the
reveal link's own size. The projects block can **load the next lot by
itself** as the button scrolls into view (*More load by themselves on
scroll*).

**Gallery**: masonry *Each column in turn* (picture *i* in column *i mod n*),
a gap at every width, infinite loading *One lot at a time, with "Loading"
between*, and the viewer's backdrop, close button side and fill, arrows at
the bottom right or bare, no counter, a fade between pictures and the
pictures either side at half size.
