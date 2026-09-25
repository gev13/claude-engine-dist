# Saved blocks, duplicating, and copy and paste

Since 2.15.

## Saved blocks — "My blocks"

Design a block once — its content and its Design tab — and use it on any
page, post, project, popup or saved block.

**Save one.** In any builder, open a block's **⋯** menu and choose **Save as a
saved block…**. A whole row, columns and all, can be saved the same way. Give
it a name, optionally a description and a folder, and choose how it is used:

- **Synced** — every page shows the same block. Edit it once and every page
  that uses it changes. The block you saved from becomes a reference to it.
- **Template** — inserting it pastes an independent copy, to change freely.

**Insert one.** **Add block → My blocks**: search, filter by folder, click.
A synced block goes in as a locked card with **Edit the original** and
**Detach** (which turns this one place into an ordinary copy; the others stay
synced). A template goes in as a copy.

**Manage them.** **Design → My blocks** lists every saved block with how many
places use it. Open one to edit its blocks in a full builder, rename it, see
where it is used, restore one of its last 30 revisions, duplicate it, or
delete it.

Rules that keep pages safe:

- A synced block that is still used cannot simply be deleted. **Detach
  everywhere, then delete** gives every page its own copy first.
- A saved block cannot contain itself, directly or through another, and saved
  blocks sit inside one another at most three deep.
- A synced block is shown in the page's language when it has a translation.
- On a page, a synced block's **Design** tab sets only its outer spacing and
  where it shows — its look is the saved block's own.
- Using the same synced block twice on one page is fine, unless it holds a
  form or an anchor — the builder warns, because a page can have each only
  once.
- A deleted saved block renders nothing on the site; the builder says so
  where the reference sits.

Managers and administrators make, change and delete saved blocks; anybody who
builds pages can insert and detach them.

## Duplicate

**Duplicate** is in the row actions of Pages, Posts, Projects and My blocks,
in each editor's header, and on each popup. The copy is a draft that renders
exactly like the original, with:

- a title ending "(copy)" and a slug ending `-copy` (a page's path gains
  `-copy` on its last segment);
- new ids for every block and row column, and forms renamed "… (copy)" so
  their submissions are filed separately;
- the same categories, tags, cover and SEO — except the canonical address;
- a translation group of its own, and you as its author.

It opens straight away. The original is not touched.

## Copy and paste between pages

**⋯ → Copy block** (or **Copy row**) in any builder, then **Paste above**,
**Paste below**, or the **Paste** button beside **+ Add block** in any other
builder — a page, a post, a project, a popup or a saved block. The clipboard
lives in this browser, so it survives moving between editors. A paste is
checked block by block and gets new ids, so it is independent of what it was
copied from.
