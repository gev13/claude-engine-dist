# The content archive

Since 2.20. What **Export & import** writes and reads, for anyone building
an archive with their own tools — a migration from another platform, say.
The machine-readable version is [`transfer-schema.json`](transfer-schema.json),
written from the database tables themselves (`npm run transfer:schema`).

## The file

A `.tar.gz` holding:

```
manifest.json
tables/<table>.json     one JSON array of rows per table
media/<filename>        the uploaded files, if they travel
```

The manifest:

```json
{
  "format": 1,
  "kind": "content",
  "engineVersion": "2.20.0",
  "takenAt": "2026-09-25T10:00:00.000Z",
  "siteName": "Northfold",
  "includesMedia": true,
  "includesSettings": true,
  "tables": { "pages": 12, "posts": 110 },
  "digests": { "pages": "<sha256 of tables/pages.json>" }
}
```

A digest is optional per table; when it is given, the file must match it
byte for byte, so an archive changed after it was written is refused.

## Tables

`media`, `categories`, `pages`, `posts`, `post_categories`, `projects`,
`project_terms`, `project_term_links`, `saved_blocks`, `jobs`, `redirects`,
and `settings`. Leave out any you do not need. Keys are the camelCase column
names in the schema. A column left out takes its default; a column the
engine does not know is ignored, and the report names it.

Filled in whatever the archive says:

- every author column — re-pointed at whoever imports;
- a post's reading time, counted from its body;
- a media row's `url`, which is `/media/<filename>`;
- a missing `id`, generated.

## What is checked

Every row, before anything is written, as the editor's own save would:

- **columns** — types, lengths, required fields, allowed values;
- **blocks** — each against the block vocabulary; one that no page could
  draw refuses its page, post, project or saved block;
- **HTML** — post bodies, project intros and job texts sanitised;
- **addresses** — slugs in their written form (`my-post`), page paths too
  (`/about`, never `/about/`); the same address twice in one archive is
  refused;
- **redirects** — the checks a typed redirect meets; pattern rules only for
  an administrator;
- **settings** — only `theme`, `navigation`, `popups`, `permalinks`,
  `projects`, `cookies`, `integrations` and `site.*`, each against the
  schema its screen saves with;
- **references** — a link to something neither in the archive nor on the
  site is cleared when it is optional and refuses the row when it is not; a
  refused post takes its category links with it;
- **media** — a safe relative file name, and the file present in the
  archive or already on the site.

The screen lists every refused row with its reason. Choose to stop, or to
import the rest without them. The report — created, updated, skipped and
refused, per table and per row — downloads as a CSV.

## Replace or merge

- **Replace** empties each table the archive carries and fills it from the
  archive. Revision history is cleared.
- **Merge** deletes nothing. A row updates the one here with the same `id`,
  or else the same address: page path, post, project, category or job slug,
  each in its language; a media row's file name; a redirect's from-path. The
  archive's references follow it to that row. A media file this site already
  has — the same sha256 in `checksum`, under any name — is not copied again,
  and pages pointing at the archive's copy are pointed at ours. Import in
  batches this way, or add new projects later without touching the rest.

Either way a backup is taken first. Afterwards the caches are cleared, the
saved-block usage index is rebuilt and, when Meilisearch is switched on, the
search index is rebuilt too. Postgres search needs nothing: its index
follows the rows.
