# Updating a site

A site built on this engine is a checkout of the engine repository with the
application in `engine/`. Updating means moving that checkout to a newer
release and rebuilding. There are two ways to do it, and one of them is off
by default.

---

## Knowing there is an update

Every release is tagged `v<version>`, written up in `CHANGELOG.md`, and listed
in `releases.json`. A site reads that file — nothing else — at most every six
hours, and stores what it found.

When a newer version appears:

- **Updates** in the admin shows what is waiting, with a line about each
  release and whether it changes the database;
- the dashboard carries a notice;
- whoever is listed for notifications on the **Email** screen is emailed
  once for that version, if engine-update messages are switched on there.

Checking reads one small file. It downloads nothing and runs nothing, and it
can be switched off entirely on the Updates screen.

---

## Taking the update from the panel

Off unless the operator turns it on:

```bash
ENGINE_UPDATE_ENABLED=true
```

With it on, **Updates** offers to apply the newest release. The run, in order:

1. **Checks.** The version must be one the site has seen in the feed. The
   checkout must be clean and have an `origin`. A checkout with local changes
   is refused — an update will not overwrite your work.
2. **Backup.** A full backup, including uploaded files, before anything moves.
3. **Fetch** the tags from `origin`.
4. **Check out** `v<version>`.
5. **Install** dependencies.
6. **Migrate** — database changes, then the hand-written SQL.
7. **Build.**
8. **Reload** through pm2, if the site runs under it. If it does not, the
   screen says the build is ready and the site needs restarting by hand.

The site restarts at the end, so the page may lose its connection while the
last step runs. That is the update finishing, not failing — reload it.

### When a step fails

The run stops there. The backup stays, the screen names the step and the
reason, and **nothing is rolled back automatically**. That is deliberate:
restoring is a decision, not something to do to somebody's site while they are
reading an error message.

To go back: **Backups → Restore** on the archive taken at the start of the
run, then restart the site.

---

## Updating without the panel

The way the deploy pipeline does it, and the way to do it by hand:

```bash
cd <site>
git fetch --tags origin
git checkout v<version>
cd engine
npm ci
node scripts/baseline-migrations.mjs   # no-op unless this database predates migrations
npx drizzle-kit migrate
node scripts/apply-sql.mjs
npm run build
pm2 reload engine   # or restart the site however it runs
```

This is the right route when the site is deployed by a pipeline, runs in a
container, or has local modifications — anywhere the checkout is not the
site's own to move.

---

## Backups

**Backups** takes an archive of every page, post, account, setting and
uploaded file. It is a `tar.gz` holding one JSON document per table plus the
media directory, written through the application's own database connection —
no `pg_dump`, so it behaves the same on a hosted database.

Four things are deliberately left out:

| Left out | Why |
| --- | --- |
| Sign-in sessions and reset links | Short-lived secrets; restoring them would resurrect access somebody has already ended |
| Rate limits | Momentary state, meaningless an hour later |
| The audit log | Append-only by design — restoring one over another site's would be rewriting history |
| The backup list | A restore must not erase the safety copy taken moments earlier |

Restoring replaces everything the archive holds, takes a fresh backup first,
and signs everybody out — the accounts table has just been replaced, so the
next request must be authenticated against the restored rows.

Archives live in `BACKUP_DIR` (`storage/backups` by default), which git
ignores. They can be downloaded from the panel and kept elsewhere; copying one
back into that directory makes it available to restore again.
