# Import from WordPress

Since 2.20. **Administration → Import from WordPress** brings a WordPress
site's content across — posts, pages, a portfolio type, their categories and
tags, featured images and the files the content uses, Yoast's SEO fields,
and a redirect from every address that changes. Not users, comments, menus
or plugin settings.

## 1. Read the site

- **An export file** — in WordPress, *Tools → Export → All content*. It
  carries everything, drafts and private posts included, and the page
  builders' shortcodes, which are cleaned into ordinary HTML here.
- **A live site** — its address. It is read through the WordPress REST API,
  which shows only public content, already rendered. The server fetches it;
  addresses on a private network are refused.

What was read is kept on this server for a day, for the next two steps.

## 2. Where everything goes

Each content type goes into **Blog posts**, **Pages**, **Projects**, or is
left out; each taxonomy into **Blog categories**, **Project categories**,
**Project tags**, or is left out. The first guess: posts to posts, pages to
pages, a type named like *portfolio* or *project* to Projects, and the same
for taxonomies.

- **Files** — download the ones the imported content uses (featured images,
  pictures in the text, builder images and galleries), the whole library, or
  none.
- **An address this site already has** — leave ours as it is (the default),
  or update it from WordPress.
- **Drafts** come in as drafts only when asked.
- **Accordions and toggles** (WPBakery, Ohio and others) become an FAQ block
  after the text, with its structured data.
- **Yoast** titles and descriptions become the SEO fields; the site name
  Yoast added is left for the engine to add.
- **Redirects** — a 301 from each old address that changes: dated post
  addresses, `/category/<name>`, a portfolio base.

*Check what this would do* runs every check without fetching or writing
anything, and lists anything that would be refused, with its reason.

## 3. Import

A backup is taken, the files are fetched (each checked like an upload), and
everything is imported as a **merge**: nothing on this site is deleted.
Pictures in the text point at the copies here, in whatever size WordPress
had cut them. A file this site already has — the same bytes — is not stored
twice.

Running the import again updates what the first run made instead of adding
copies: each item keeps an id made from the WordPress site and its own id.

Page bodies go into a Text block, so a page can be rebuilt from blocks
afterwards; a post keeps its body as a post body.
