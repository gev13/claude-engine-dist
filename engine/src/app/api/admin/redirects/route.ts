import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { badRequest, conflict, created, handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import {
  isSafeTarget,
  listNotFound,
  listRedirects,
  normalisePath,
  resolveNotFound,
} from '@/server/content/redirects';
import { revalidateContent } from '@/server/content/revalidate';
import { db } from '@/server/db';
import { redirects } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  fromPath: z.string().min(1).max(400),
  toPath: z.string().min(1).max(500).refine(isSafeTarget, 'Use a site path or a full http(s) URL.'),
  status: z.union([z.literal(301), z.literal(302)]).default(301),
  isActive: z.boolean().default(true),
  note: z.string().max(300).default(''),
});

export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'redirects:read');
    if (!guard.ok) return guard.response;

    const url = new URL(request.url);
    return ok({
      items: await listRedirects(),
      notFound: await listNotFound(url.searchParams.get('includeResolved') === '1'),
    });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'redirects:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, schema);
    if (!parsed.ok) return parsed.response;

    const fromPath = normalisePath(parsed.data.fromPath);
    const toPath = parsed.data.toPath.trim();

    // A redirect to itself is an infinite loop, not a redirect.
    if (normalisePath(toPath) === fromPath) {
      return badRequest('A redirect cannot point at the path it comes from.');
    }

    const [existing] = await db.select().from(redirects).where(eq(redirects.fromPath, fromPath)).limit(1);
    if (existing) return conflict(`There is already a redirect from ${fromPath}.`);

    const [row] = await db
      .insert(redirects)
      .values({ ...parsed.data, fromPath, toPath, createdById: guard.user.id })
      .returning();

    // Creating a redirect answers the 404 that prompted it.
    await resolveNotFound(fromPath);

    /* The 404 this replaces was rendered and cached by ISR, so without this the
       redirect would not fire until that entry expired. This is the same trap
       the README describes for blog routes built against a cold database. */
    revalidateContent([fromPath]);

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'redirect.create',
      targetType: 'redirect',
      targetId: row?.id,
      summary: `Created a ${parsed.data.status} redirect from ${fromPath} to ${toPath}`,
      ip: clientIp(request.headers),
    });

    return created(row);
  });
}
