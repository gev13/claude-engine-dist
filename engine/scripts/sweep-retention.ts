import 'dotenv/config';
import { RETENTION_LABELS, countOf, inDays } from '@/lib/retention';
import { sweepAll } from '@/server/retention';

/* ═══════════════════════════════════════════════════════════════════════════
   Delete everything past its keeping period, now.
   ───────────────────────────────────────────────────────────────────────────
   The engine sweeps by itself when something arrives or somebody opens the
   inbox it arrived in, which is enough for a site in use and is *not* enough
   for a site with a legal deadline to meet: a month of no traffic is a month
   of no deletions.

   This is the escape hatch. Run it from cron and every period is honoured
   whatever the traffic does:

     0 3 * * *  cd /srv/site && npm run retention:sweep >> /var/log/sweep.log

   It calls the same function the app calls, forced past the throttle, so
   there is no second implementation to drift from the first.
   ═══════════════════════════════════════════════════════════════════════════ */

async function main() {
  const results = await sweepAll({ force: true });
  console.log('');

  for (const result of results) {
    const what = RETENTION_LABELS[result.kind];
    if (!result.ran) {
      console.log(`${what}: kept for ever — automatic deletion is switched off.`);
    } else if (result.removed === 0) {
      console.log(`${what}: nothing was older than ${inDays(result.keptDays)}.`);
    } else {
      /* Only say "files and all" when there were any: an enquiry is text,
         and claiming to have deleted files it never had is a small lie that
         would make somebody go looking for them. */
      const also = result.files > 0 ? `, and ${result.files === 1 ? 'its file' : `${result.files} files`}` : '';
      console.log(
        `${what}: deleted ${countOf(result.kind, result.removed)} older than ${inDays(result.keptDays)}${also}.`,
      );
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nThe sweep failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
