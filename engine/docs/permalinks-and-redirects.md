# Permalinks, archive pages and redirects

Since 2.13. Where the blog lives, what its addresses look like, and how old
addresses keep working.

## Permalinks

**Settings → Permalinks** (administrators).

| Setting | Default | Options |
|---|---|---|
| A post's address | `/blog/<slug>` | under its category — `/<category>/<slug>` · at the top level — `/<slug>` |
| Blog index | `/blog` | any path of one to three lowercase segments |
| Category base | `/blog/category` | e.g. `/category` |
| Page word | `page` | the word in `/blog/page/2` |
| Trailing slash | never | always — every address ends in `/` |

The defaults are the addresses every site had before 2.13, so a site that
never opens this screen sees no change.

**Under the category pattern** a post lives at its primary category, or at
its first category when none is picked. A post with no category stays under
the blog index. A post reached through another category's address —
`/learn/link-building/` for a post filed under *igaming-marketing* — is sent
to its own address with a permanent redirect.

**A change is checked before it is saved.** A page that would sit at a
category archive's address, or a category named like a top-level page under
the category pattern, stops the save and is named. A path the engine owns
(`/admin`, `/api`, `/careers`, …) cannot be used.

**On a live site, tick "Create 301s from the old addresses".** Every published
post's and category's current address gets a redirect to its new one, in the
same save. The screen shows how many addresses move before you commit. The
redirects appear under Redirects, where they can be edited or removed. An
address the old defaults would have used (`/blog/<slug>`,
`/blog/category/<slug>`) is also redirected automatically while the site uses
something else.

**Trailing slash.** *Always* writes `/about/` in every link, canonical, sitemap
entry, breadcrumb and piece of structured data, and answers `/about` with a
301 to `/about/`. *Never* is the reverse, as before. Files (`/sitemap.xml`,
`/media/report.pdf`) are never given a slash.

## Archive pages

The blog index, each category and research are paged on the server:
`/blog/page/2`, `/category/news/page/3`. Every page is in the HTML, with its
own canonical and `rel="prev"` / `rel="next"`. `/page/1` redirects to the
archive itself; a page past the last is a 404.

**Appearance → Blog → Archive pages**: posts per page (unset: 24 on the blog
index, 48 elsewhere — what they showed before), the links (numbers,
previous/next, or "Load more"), and an optional "Showing 1–12 of 110 results".

"Load more" is the link to the next page. With a script, a click fetches that
page and appends its posts; without one it is an ordinary link.

A **Post list** block can page the same way on any page: set *Show* to *Real
pages — /page/2, on the server*. *How many* is then the number per page. One
list per page can do it.

## Posts with blocks

Every post has a **Layout**: the article only (the default), its blocks only,
the article then its blocks, or the blocks then the article. The preview and
the live post use the same component. An FAQ block in a post adds `FAQPage`
structured data beside the `Article`; a form block in a post takes
submissions. Heroes are offered in a post's builder only when its blocks come
first.

## Redirects

**Administration → Redirects.** A rule's *From* says what it matches:

| From | Matches |
|---|---|
| `/old` | exactly `/old` |
| `/old/*` | `/old` and everything under it |
| `/?s=*` | `/` with an `s` in the query — `*` is captured |
| `^/(\d{4})/(.*)$` | a regular expression (administrators only) |

In *To*, `$1`, `$2`… are what `*` or a group matched, encoded. On a prefix
rule, a target ending in `/*` keeps the rest of the path: `/old/*` → `/new/*`
sends `/old/a/b` to `/new/a/b`.

**Content wins.** A path rule fires only where a page, post or archive would
otherwise be missing, so it never hides live content. A query rule runs first,
because the path it sits on (`/` for `/?s=term`) is usually live.

**Chains and loops.** A → B plus B → C is saved as A → C. A loop is refused,
with the loop spelled out.

**Patterns are checked.** A regular expression that could backtrack without
end — `(a+)+`, `(.*)*` — is refused, as are back-references and lookbehind.

**Import and export.** Export CSV writes `from,to,status,note,active,hits,last
hit`; the first four columns are what Import reads, so an export edited in a
spreadsheet imports back as it stands. Import also reads Yoast's redirect
export. It always shows the plan first — created, updated, skipped, refused,
line by line — and writes nothing until you import.

Redirects answered by a route are 308/307 (Next.js's permanent and temporary
redirects), which search engines treat exactly as 301/302. The trailing-slash
redirect and query rules are answered earlier, by the middleware, as true 301s.
