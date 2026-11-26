import { and, eq, isNull, ne } from 'drizzle-orm';
import { z } from 'zod';
import { type AnyBlock, collectInvalidBlocks, parseBlocks } from '@/lib/blocks';
import { localeConfig } from '@/lib/locales';
import { applyStrings, collectStrings, translationProgress } from '@/lib/translate';
import { badRequest, conflict, forbidden, handle, notFound, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { can, ownsOrAdmin } from '@/server/auth/rbac';
import { sanitizeRichText } from '@/server/content/sanitize';
import { captureRevision } from '@/server/content/revisions';
import { getPermalinks } from '@/server/routing/config';
import { postPathById } from '@/server/content/posts';
import { DEFAULT_PERMALINKS, categoryPath, postPath } from '@/lib/permalinks';
import { revalidateContent, revalidateEverything } from '@/server/content/revalidate';
import { db } from '@/server/db';
import { categories, pages, posts, savedBlocks } from '@/server/db/schema';
import { revalidateSavedBlockUsers, validateSavedTree } from '@/server/content/savedBlockWrites';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ═══════════════════════════════════════════════════════════════════════════
   Translating a page, a post or a category (package 8)
   ───────────────────────────────────────────────────────────────────────────
   A translation is an ordinary row sharing a translation group with the
   original. What makes it a translation is where its blocks come from: the
   original's structure with the translated words written into it, so layout,
   pictures and block order can never drift between languages.

   The three differ only at the edges, and `normalise` is where that stops
   mattering:

     • a page has a `path` and a `summary`;
     • a post lives at /blog/<slug> and has a `body` of rich text, translated
       as a whole rather than string by string — HTML is not a list of
       sentences;
     • a category calls its title `name` and its excerpt `description`, has no
       blocks, no draft state, no revisions and no author — so it is gated by
       the `categories:write` permission rather than by ownership, which would
       otherwise lock out every editor, since `ownsOrAdmin` refuses a null
       author.
   ═══════════════════════════════════════════════════════════════════════════ */

/* 3.37 — and a saved block, which calls its title `name`, its excerpt
   `description` and its blocks `tree`; it has no address and no draft state,
   is gated by `savedBlocks:write`, and a page showing it in that language
   draws the translation (`getSavedTree`). */
type Kind = 'page' | 'post' | 'category' | 'savedBlock';

const kindSchema = z.enum(['page', 'post', 'category', 'savedBlock']).default('page');

/** Swap the last segment of a path, so /about/team becomes /about/mer-tim. */
function pathWithSlug(sourcePath: string, slug: string): string {
  const parts = sourcePath.split('/').filter(Boolean);
  if (parts.length === 0) return '/';
  parts[parts.length - 1] = slug;
  return `/${parts.join('/')}`;
}

/** One shape for both, so everything below stops caring which it is. */
type Row = {
  id: string;
  locale: string;
  translationGroupId: string;
  title: string;
  slug: string;
  excerpt: string;
  summary: string | null;
  body: string | null;
  blocks: AnyBlock[];
  status: string;
  authorId: string | null;
  publicPath: string;
};

function normalise(kind: Kind, row: Record<string, unknown>): Row {
  /* A category calls its title `name` and its excerpt `description`, and has
     neither blocks nor a draft state. Mapping it here is what lets everything
     below stop caring which of the three it is holding. */
  const isCategory = kind === 'category';
  if (kind === 'savedBlock') {
    return {
      id: row.id as string,
      locale: row.locale as string,
      translationGroupId: row.translationGroupId as string,
      title: (row.name as string) ?? '',
      slug: '',
      excerpt: (row.description as string) ?? '',
      summary: null,
      body: null,
      blocks: ((row.tree as AnyBlock[]) ?? []) as AnyBlock[],
      status: 'published',
      authorId: (row.createdById as string | null) ?? null,
      publicPath: '',
    };
  }

  return {
    id: row.id as string,
    locale: row.locale as string,
    translationGroupId: row.translationGroupId as string,
    title: (isCategory ? (row.name as string) : (row.title as string)) ?? '',
    slug: row.slug as string,
    excerpt: (isCategory ? (row.description as string) : (row.excerpt as string)) ?? '',
    summary: kind === 'page' ? ((row.summary as string) ?? '') : null,
    body: kind === 'post' ? ((row.body as string) ?? '') : null,
    blocks: ((row.blocks as AnyBlock[]) ?? []) as AnyBlock[],
    // A category is live as soon as it exists; there is no draft to be in.
    status: (row.status as string) ?? 'published',
    authorId: (row.authorId as string | null) ?? null,
    // Posts are corrected by `withAddress`, which knows their category; this is the shape without one.
    publicPath:
      kind === 'page'
        ? (row.path as string)
        : kind === 'post'
          ? postPath(DEFAULT_PERMALINKS, { slug: row.slug as string })
          : categoryPath(DEFAULT_PERMALINKS, row.slug as string),
  };
}

/** A row's real address under this site's permalinks — a post's depends on its category. */
async function withAddress(kind: Kind, row: Row): Promise<Row> {
  if (kind === 'page' || kind === 'savedBlock') return row;
  const permalinks = await getPermalinks();
  if (kind === 'category') return { ...row, publicPath: categoryPath(permalinks, row.slug) };
  return { ...row, publicPath: (await postPathById(permalinks, row.id)) ?? row.publicPath };
}

async function loadOne(kind: Kind, id: string): Promise<Row | null> {
  if (kind === 'savedBlock') {
    const [row] = await db.select().from(savedBlocks).where(and(eq(savedBlocks.id, id), isNull(savedBlocks.deletedAt))).limit(1);
    return row ? normalise('savedBlock', row) : null;
  }
  if (kind === 'page') {
    const [row] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
    return row ? normalise('page', row) : null;
  }
  if (kind === 'category') {
    const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
    return row ? withAddress('category', normalise('category', row)) : null;
  }
  const [row] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  return row ? withAddress('post', normalise('post', row)) : null;
}

async function loadSiblings(kind: Kind, groupId: string, exceptId: string): Promise<Row[]> {
  if (kind === 'savedBlock') {
    const rows = await db
      .select()
      .from(savedBlocks)
      .where(and(eq(savedBlocks.translationGroupId, groupId), ne(savedBlocks.id, exceptId), isNull(savedBlocks.deletedAt)));
    return rows.map((row) => normalise('savedBlock', row));
  }
  if (kind === 'page') {
    const rows = await db
      .select()
      .from(pages)
      .where(and(eq(pages.translationGroupId, groupId), ne(pages.id, exceptId)));
    return rows.map((row) => normalise('page', row));
  }
  if (kind === 'category') {
    const rows = await db
      .select()
      .from(categories)
      .where(and(eq(categories.translationGroupId, groupId), ne(categories.id, exceptId)));
    return Promise.all(rows.map((row) => withAddress('category', normalise('category', row))));
  }
  const rows = await db
    .select()
    .from(posts)
    .where(and(eq(posts.translationGroupId, groupId), ne(posts.id, exceptId)));
  return Promise.all(rows.map((row) => withAddress('post', normalise('post', row))));
}

export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'pages:read');
    if (!guard.ok) return guard.response;

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const locale = url.searchParams.get('locale');
    const kind = kindSchema.parse(url.searchParams.get('kind') ?? 'page');
    if (!id) return badRequest('Which one?');

    const source = await loadOne(kind, id);
    if (!source) return notFound('That does not exist.');

    const siblings = await loadSiblings(kind, source.translationGroupId, source.id);
    const config = localeConfig();
    const sourceStrings = collectStrings(source.blocks);

    /* What exists in each language, and how far along it is. A language with
       nothing yet still appears — with a button to start it. */
    const languages = config.locales
      .filter((code) => code !== source.locale)
      .map((code) => {
        const existing = siblings.find((row) => row.locale === code);
        return {
          locale: code,
          id: existing?.id ?? null,
          title: existing?.title ?? null,
          status: existing?.status ?? null,
          progress: existing
            ? translationProgress(source.blocks, existing.blocks)
            : { total: sourceStrings.length, translated: 0, remaining: sourceStrings.length },
        };
      });

    if (!locale) {
      return ok({ source: { id: source.id, locale: source.locale, title: source.title }, languages });
    }

    if (!config.locales.includes(locale)) return badRequest('That language is not configured for this site.');
    const target = siblings.find((row) => row.locale === locale) ?? null;
    const translatedByPath = new Map(
      (target ? collectStrings(target.blocks) : []).map((entry) => [entry.path, entry.value]),
    );

    return ok({
      kind,
      source: {
        id: source.id,
        locale: source.locale,
        title: source.title,
        slug: source.slug,
        path: source.publicPath,
        excerpt: source.excerpt,
        summary: source.summary ?? '',
        body: source.body ?? '',
      },
      target: target
        ? {
            id: target.id,
            locale: target.locale,
            title: target.title,
            slug: target.slug,
            path: target.publicPath,
            excerpt: target.excerpt,
            summary: target.summary ?? '',
            /* Unchanged body means untranslated — show an empty editor rather
               than the original's words pretending to be a translation. */
            body: target.body && target.body !== source.body ? target.body : '',
            status: target.status,
          }
        : null,
      strings: sourceStrings.map((entry) => {
        const current = translatedByPath.get(entry.path);
        return {
          path: entry.path,
          key: entry.key,
          source: entry.value,
          target: current && current !== entry.value ? current : '',
        };
      }),
      languages,
    });
  });
}

const createSchema = z.object({
  id: z.string().uuid(),
  locale: z.string().trim().min(2).max(8),
  kind: kindSchema,
});

/** Start a translation: a copy of the original, in the other language, as a draft. */
export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'pages:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, createSchema);
    if (!parsed.ok) return parsed.response;
    const { id, locale, kind } = parsed.data;
    if (kind === 'savedBlock' && !can(guard.user, 'savedBlocks:write')) return forbidden();

    const config = localeConfig();
    if (!config.locales.includes(locale)) return badRequest('That language is not configured for this site.');

    const source = await loadOne(kind, id);
    if (!source) return notFound('That does not exist.');
    if (source.locale === locale) return badRequest('That is its own language.');

    const siblings = await loadSiblings(kind, source.translationGroupId, source.id);
    if (siblings.some((row) => row.locale === locale)) return conflict('That translation already exists.');

    /* The same slug is legal in another language — uniqueness is (locale,
       slug) — so a translation starts at the original's address and the
       translator changes it when they are ready. */
    let createdId: string;
    if (kind === 'savedBlock') {
      const [original] = await db.select().from(savedBlocks).where(eq(savedBlocks.id, id)).limit(1);
      const [created] = await db
        .insert(savedBlocks)
        .values({
          name: original!.name,
          description: original!.description,
          category: original!.category,
          mode: original!.mode,
          tree: original!.tree,
          locale,
          translationGroupId: original!.translationGroupId,
          createdById: guard.user.id,
          updatedById: guard.user.id,
        })
        .returning({ id: savedBlocks.id });
      createdId = created!.id;
    } else if (kind === 'page') {
      const [original] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
      const [created] = await db
        .insert(pages)
        .values({
          slug: original!.slug,
          path: original!.path,
          locale,
          translationGroupId: original!.translationGroupId,
          title: original!.title,
          summary: original!.summary,
          excerpt: original!.excerpt,
          template: original!.template,
          priorityTier: original!.priorityTier,
          parentId: original!.parentId,
          blocks: original!.blocks,
          seo: original!.seo,
          authorId: guard.user.id,
          status: 'draft',
          publishedAt: null,
        })
        .returning({ id: pages.id });
      createdId = created!.id;
    } else if (kind === 'category') {
      const [original] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
      const [created] = await db
        .insert(categories)
        .values({
          slug: original!.slug,
          locale,
          translationGroupId: original!.translationGroupId,
          name: original!.name,
          description: original!.description,
          seo: original!.seo,
          parentId: original!.parentId,
          sortOrder: original!.sortOrder,
        })
        .returning({ id: categories.id });
      createdId = created!.id;
    } else {
      const [original] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
      const [created] = await db
        .insert(posts)
        .values({
          slug: original!.slug,
          locale,
          translationGroupId: original!.translationGroupId,
          title: original!.title,
          excerpt: original!.excerpt,
          body: original!.body,
          blocks: original!.blocks,
          kind: original!.kind,
          seo: original!.seo,
          coverMediaId: original!.coverMediaId,
          primaryCategoryId: original!.primaryCategoryId,
          readingMinutes: original!.readingMinutes,
          authorId: guard.user.id,
          status: 'draft',
          publishedAt: null,
        })
        .returning({ id: posts.id });
      createdId = created!.id;
    }

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: `${kind}.translation.create`,
      targetType: kind,
      targetId: createdId,
      summary: `Started the ${locale} translation of "${source.title}"`,
      ip: clientIp(request.headers),
    });

    return ok({ translation: { id: createdId, locale } });
  });
}

const saveSchema = z.object({
  kind: kindSchema,
  /** The original, whose structure the translation follows. */
  sourceId: z.string().uuid(),
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(300),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9À-\u{10FFFF}]+(?:-[a-z0-9À-\u{10FFFF}]+)*$/u, 'Lower case, words joined by dashes.')
    /* 3.37 — every kind but a saved block, which has no address (empty or left out). */
    .or(z.literal(''))
    .optional(),
  excerpt: z.string().trim().max(500).default(''),
  summary: z.string().trim().max(300).default(''),
  /** Posts only. Empty means "not translated yet" and keeps the original's. */
  body: z.string().max(400_000).optional(),
  /** Translated text from the blocks, by the path it belongs at. */
  strings: z.record(z.string(), z.string().max(20_000)).default({}),
});

export async function PUT(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'pages:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, saveSchema);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;

    const source = await loadOne(input.kind, input.sourceId);
    if (!source) return notFound('The original does not exist.');
    const target = await loadOne(input.kind, input.id);
    if (!target) return notFound('That translation does not exist.');
    if (target.translationGroupId !== source.translationGroupId) {
      return badRequest('Those two are not translations of each other.');
    }
    /* A category has no author, so ownership does not apply to it — and
       `ownsOrAdmin` would refuse a null author for anybody but an admin or a
       manager, which would lock editors out of translating categories they are
       allowed to edit. Categories are gated by the permission instead. */
    if (input.kind !== 'savedBlock' && !input.slug) return badRequest('A translation needs its address.');
    if (input.kind === 'category') {
      if (!can(guard.user, 'categories:write')) return forbidden();
    } else if (input.kind === 'savedBlock') {
      if (!can(guard.user, 'savedBlocks:write')) return forbidden();
    } else if (!ownsOrAdmin(guard.user, target.authorId)) {
      return badRequest('That is not yours to edit.');
    }

    /* Structure comes from the original, words from the translator. */
    const blocks = applyStrings(source.blocks, input.strings);
    const problems = collectInvalidBlocks(blocks);
    if (problems.length > 0) {
      return badRequest(`Some blocks would not save: ${problems.slice(0, 3).join(', ')}`);
    }
    const parsedBlocks = parseBlocks(blocks) as AnyBlock[];
    const slug = input.slug ?? '';

    // 3.37 — a saved block: its name, description and tree, then every page that shows it.
    if (input.kind === 'savedBlock') {
      const validated = await validateSavedTree(input.id, parsedBlocks);
      if (!validated.ok) return validated.response;
      await db
        .update(savedBlocks)
        .set({ name: input.title, description: input.excerpt, tree: validated.tree, updatedById: guard.user.id, updatedAt: new Date() })
        .where(eq(savedBlocks.id, input.id));
      await audit({
        actorId: guard.user.id,
        actorEmail: guard.user.email,
        action: 'savedBlock.translation.update',
        targetType: 'savedBlock',
        targetId: input.id,
        summary: `Edited the ${target.locale} translation of "${source.title}"`,
        ip: clientIp(request.headers),
      });
      /* Every page that shows it — and, since a saved block can also be shown
         by a setting no usage index records (the careers adverts' block), the
         whole site: a translation is saved rarely. */
      await revalidateSavedBlockUsers(source.id);
      revalidateEverything();
      return ok({ translation: { id: input.id, path: '', slug: '' }, progress: translationProgress(source.blocks, parsedBlocks) });
    }

    let newPath: string;
    if (input.kind === 'page') {
      newPath = pathWithSlug(source.publicPath, slug);
      await db
        .update(pages)
        .set({
          title: input.title,
          slug,
          path: newPath,
          excerpt: input.excerpt,
          summary: input.summary,
          blocks: parsedBlocks,
          updatedAt: new Date(),
        })
        .where(eq(pages.id, input.id));
    } else if (input.kind === 'category') {
      newPath = categoryPath(await getPermalinks(), slug);
      await db
        .update(categories)
        .set({
          // A category's title is its `name` and its excerpt its `description`.
          name: input.title,
          slug,
          description: input.excerpt,
          updatedAt: new Date(),
        })
        .where(eq(categories.id, input.id));
    } else {
      newPath = postPath(await getPermalinks(), { slug });
      await db
        .update(posts)
        .set({
          title: input.title,
          slug,
          excerpt: input.excerpt,
          // Sanitised on write, exactly as the post editor does it — this is
          // another path that accepts HTML, so it gets the same treatment.
          body: input.body && input.body.trim() ? sanitizeRichText(input.body) : source.body ?? '',
          blocks: parsedBlocks,
          updatedAt: new Date(),
        })
        .where(eq(posts.id, input.id));
    }

    const updated = await loadOne(input.kind, input.id);

    /* Categories have no revision history — only pages and posts do — so there
       is nothing to capture for one. */
    if (input.kind !== 'category') {
      await captureRevision({
        entityType: input.kind as 'page' | 'post',
        entityId: input.id,
        row: (updated ?? {}) as Record<string, unknown>,
        reason: 'update',
        actorId: guard.user.id,
        actorEmail: guard.user.email,
      });
    }

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: `${input.kind}.translation.update`,
      targetType: input.kind,
      targetId: input.id,
      summary: `Edited the ${target.locale} translation of "${source.title}"`,
      ip: clientIp(request.headers),
    });

    // A post's address also depends on its category, which only the stored row knows.
    if (input.kind === 'post') newPath = (await postPathById(await getPermalinks(), input.id)) ?? newPath;
    revalidateContent([newPath, target.publicPath]);

    return ok({
      translation: { id: input.id, path: newPath, slug },
      progress: translationProgress(source.blocks, parsedBlocks),
    });
  });
}
