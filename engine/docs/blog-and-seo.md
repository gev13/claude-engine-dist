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
