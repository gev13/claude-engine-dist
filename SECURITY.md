# Security

## Reporting a vulnerability

**Do not open a public issue.** A public report tells everyone running this
engine about a weakness before any of them can fix it.

Report it privately through GitHub's **Security → Report a vulnerability** on
this repository, which opens a private advisory visible only to the
maintainers.

Please include what you can: what you did, what happened, what you expected,
the version (Admin → Updates shows it), and whether you believe it is already
being exploited. A working proof of concept helps, but do not test against a
site you do not own.

You will get an acknowledgement. If the report is valid, you will be told when
a fix ships, and credited in the changelog unless you would rather not be.

## What the engine does for you

- **Passwords** are hashed with Argon2id, held to a policy (length, character
  classes, not a known-breached password, not your own name or address), and
  never logged.
- **Sessions** are re-read from the database on every request, so deactivating
  an account ends its access immediately rather than when a token expires.
- **Two-factor authentication** is a single switch, on by default, enrolled
  during installation.
- **Failed logins** lock an account for increasing periods, and after enough
  attempts hold it until an administrator releases it.
- **Repeat offenders are blocked by address**, automatically and expiring, or
  permanently by hand.
- **Every change is audited** to an append-only table enforced by a database
  trigger — it cannot be edited or deleted, including by the application.
- **Uploads** are type-checked by content rather than by file name, served
  with `nosniff` and a sandbox policy, never executed.
- **Editor HTML is sanitised when stored**, not when displayed.
- **Secrets in settings** — the SMTP password — are encrypted at rest and
  stripped from every response.

## What it does not do

**It cannot absorb a flood.** The lockouts and the blocklist stop password
guessing and badly behaved bots. A volumetric denial-of-service attack has to
be stopped in front of the application — at your CDN, your firewall or your
host. Any CMS that claims otherwise is claiming something the application
layer cannot deliver.

**It does not protect a server you have not secured.** Your operating system,
your SSH configuration, your database's network exposure and your TLS
certificates are yours.

**It does not back itself up off the machine.** Backups are written to disk on
the same server by default. A backup on the same disk as the data is not a
backup — copy them somewhere else. INSTALL.md shows one way.

## Your part

- Keep `AUTH_REQUIRE_2FA=true`.
- Keep the engine updated; Admin → Updates tells you when a release exists.
- Keep the database off the public internet.
- Give each person their own account with the smallest role that works.
- Read Admin → Security occasionally. It is showing you real attempts.
