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
- **More projects** after each project: from the same primary category
  (topped up with the newest when there are too few) or simply the newest; one
  to six; as a grid or a carousel; with its own heading.
- **Archives**: the card style, columns and projects per page for category and
  tag pages, which page on the server (`/portfolio-category/branding/page/2`).
- **Search**: optionally show matching projects above the posts in the site's
  search results.
- **After every project**: blocks shown at the end of every project page —
  usually a call to action.

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
