import { randomBytes, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { env } from '@/lib/env';
import { badRequest, conflict, handle, ok, readJson } from '@/server/api/respond';
import { audit } from '@/server/auth/audit';
import { checkPasswordPolicy, hashPassword } from '@/server/auth/password';
import { clientIp, rateLimit } from '@/server/auth/rateLimit';
import {
  mintAccessFor,
  setAccessCookie,
  setCsrfCookie,
  setRefreshCookie,
} from '@/server/auth/session';
import { issueRefreshToken } from '@/server/auth/tokens';
import { revalidateEverything } from '@/server/content/revalidate';
import { localeConfig } from '@/lib/locales';
import { writeEnvFile } from '@/server/install/env';
import { INSTALL_SETTING_KEY, getInstallState } from '@/server/install/status';
import { starterPage } from '@/server/install/starter';
import { db } from '@/server/db';
import { pages, settings, users } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  admin: z.object({
    firstName: z.string().trim().min(1).max(120),
    lastName: z.string().trim().max(120).default(''),
    username: z.string().trim().min(3).max(60).regex(/^[a-zA-Z0-9._-]+$/, 'Letters, digits, dot, dash and underscore only.'),
    email: z.string().trim().email().max(255),
    password: z.string().min(1).max(200),
  }),
  site: z.object({
    name: z.string().trim().min(1).max(120),
    tagline: z.string().trim().max(200).default(''),
    url: z.string().trim().url().max(300).optional(),
    timeZone: z.string().trim().max(60).default('UTC'),
    /**
     * The site's main language (package 8). One only: more are added in
     * Settings → Languages, which is the natural place to decide a site is
     * multilingual — an installer is not.
     */
    locale: z.string().trim().min(2).max(8).default('en'),
  }),
});

/** Read the install state on GET so the UI can show what is wrong. */
export async function GET(request: Request) {
  return handle(async () => {
    const state = await getInstallState();
    // Never disclose progress to the internet once installed.
    if (state.installed) return ok({ installed: true });
    void request;
    return ok(state);
  });
}

/**
 * Run the installation.
 *
 * Unauthenticated by necessity — there is nobody to authenticate as yet — so
 * "not installed" is the entire access control. Three things protect it:
 *
 *   1. the two-fact gate in `getInstallState`;
 *   2. a rate limit, so a deployment that is briefly uninstalled is not a
 *      target worth hammering;
 *   3. the marker row is written in the same transaction as the account, and
 *      the account's unique email is what makes a concurrent second call fail
 *      rather than create a second administrator.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const ip = clientIp(request.headers);

    const limit = await rateLimit({ key: `install:${ip}`, limit: 10, windowSec: 900, blockSec: 900 });
    if (!limit.allowed) return conflict('Too many installation attempts. Try again later.');

    const state = await getInstallState();
    if (state.installed) return conflict('This site is already installed.');
    if (!state.schemaReady) {
      return badRequest('The database schema has not been applied yet. Run `npm run db:push` and reload.');
    }

    const parsed = await readJson(request, schema);
    if (!parsed.ok) return parsed.response;

    const { admin, site } = parsed.data;

    // The same policy every later password change is held to.
    const policy = checkPasswordPolicy(admin.password, {
      email: admin.email,
      username: admin.username,
    });
    if (!policy.ok) return badRequest(policy.reason);

    const passwordHash = await hashPassword(admin.password);

    let userId: string;
    try {
      userId = await db.transaction(async (tx) => {
        // Re-check inside the transaction: two requests could both have passed
        // the check above before either wrote anything.
        const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(users);
        if (n > 0) throw new Error('ALREADY_INSTALLED');

        const [row] = await tx
          .insert(users)
          .values({
            email: admin.email.toLowerCase(),
            username: admin.username,
            firstName: admin.firstName,
            lastName: admin.lastName,
            passwordHash,
            role: 'admin',
            isActive: true,
          })
          .returning({ id: users.id });

        await tx.insert(settings).values([
          { key: INSTALL_SETTING_KEY, value: new Date().toISOString(), updatedById: row!.id },
          { key: 'site.name', value: site.name, updatedById: row!.id },
          { key: 'site.tagline', value: site.tagline, updatedById: row!.id },
          { key: 'site.timeZone', value: site.timeZone, updatedById: row!.id },
        ]);

        // A site with no pages renders a 404 at its own root, which looks
        // broken. One editable page is the difference between "installed" and
        // "installed and obviously working".
        await tx.insert(pages).values(starterPage(site.name, site.tagline, row!.id));

        return row!.id;
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'ALREADY_INSTALLED') {
        return conflict('This site is already installed.');
      }
      throw error;
    }

    /* The main language goes to .env, where the routing layer can read it on
       the Edge runtime. Writing it only when it differs keeps the common case
       — an English site — free of a restart it does not need. */
    const config = localeConfig();
    const localeChanged = site.locale !== config.defaultLocale;
    if (localeChanged) {
      const rest = config.locales.filter((code) => code !== site.locale);
      await writeEnvFile({ ENGINE_LOCALES: [site.locale, ...rest].join(',') });
    }

    /* Every page visited before this point was rendered — and cached — as a
       redirect to the installer. Without this the freshly installed site keeps
       bouncing back to /install until those entries expire. */
    revalidateEverything();

    await audit({
      actorId: userId,
      actorEmail: admin.email,
      action: 'site.install',
      targetType: 'site',
      summary: `Installed "${site.name}" and created the first administrator`,
      ip,
    });

    // Sign the new administrator straight in: making somebody type the
    // password they set ten seconds ago is friction with no security value.
    const familyId = randomUUID();
    const refresh = await issueRefreshToken({
      userId,
      familyId,
      userAgent: request.headers.get('user-agent'),
      ip,
    });
    const access = await mintAccessFor(
      { id: userId, email: admin.email.toLowerCase(), role: 'admin' },
      familyId,
    );

    await setAccessCookie(access);
    await setRefreshCookie(refresh.raw);
    await setCsrfCookie(randomBytes(24).toString('base64url'));

    /* Straight to enrolment rather than to the dashboard (P5-D): the second
       factor is required on the next sign-in anyway, and meeting it here —
       while the person is still setting the site up — beats being stopped by
       a QR code days later with no idea why. */
    return NextResponse.json({
      status: 'ok' as const,
      redirectTo: env.AUTH_REQUIRE_2FA ? '/admin/two-factor?setup=1&next=%2Fadmin' : '/admin',
      /* The language was written to .env, which this process read at boot — so
         the site keeps rendering in the old one until it is restarted. Saying
         nothing here would leave somebody wondering why their Armenian site is
         in English. */
      restartRequired: localeChanged,
      locale: site.locale,
    });
  });
}
