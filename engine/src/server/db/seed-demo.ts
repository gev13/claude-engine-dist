import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { DEMO_ANIMATIONS, demoAnimationFile } from '@/content/demo/animations';
import { DEMO_IMAGES, demoImageFile } from '@/content/demo/images';
import { demoNavigation } from '@/content/demo/navigation';
import { demoPopups } from '@/content/demo/popups';
import { demoPages } from '@/content/demo/pages';
import { demoCategories, demoPosts } from '@/content/demo/posts';
import { parseBlocks } from '@/lib/blocks';
import { navigationSchema } from '@/lib/navigation';
import { popupsSchema } from '@/lib/popups';
import { readingMinutes } from '@/lib/utils';
import { NAVIGATION_SETTING_KEY } from '@/server/content/navigation';
import { POPUPS_SETTING_KEY } from '@/server/content/popups';
import { sanitizeRichText } from '@/server/content/sanitize';
import { writeDemoAnimation, writeDemoImage, writeDemoVideo } from '@/server/media/demo';
import { DEMO_VIDEOS, demoVideoFile } from '@/content/demo/videos';
import { resolveStoredPath } from '@/server/media/storage';
import { db } from './index';
import { categories, media, pages, postCategories, posts, savedBlocks, settings } from './schema';
import { DEMO_SAVED_BLOCK_ID, demoSavedBlock } from '@/content/demo/savedBlocks';

/* ═══════════════════════════════════════════════════════════════════════════
   Demo content seed — `npm run db:seed:demo`
   ───────────────────────────────────────────────────────────────────────────
   Writes the starter site and the block library from src/content/demo:
   generated images into the media library, pages, three blog posts and the
   default menus. It creates no accounts.

   Safe to run again: anything that already exists is left alone, so an
   editor's changes survive. `--force` rewrites the demo's own pages, posts,
   images and menus from the repo. The one exception without `--force` is the
   home page the installer creates: while it has never been edited, the demo
   home page replaces it.
   ═══════════════════════════════════════════════════════════════════════════ */

const FORCE = process.argv.includes('--force');

function log(step: string, detail = '') {
  console.log(`  ${step.padEnd(14)}${detail}`);
}

/** Render every demo image and add it to the media library. Returns filename → media id. */
async function seedImages(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  let created = 0;

  for (const image of DEMO_IMAGES) {
    const filename = demoImageFile(image);
    if (!resolveStoredPath(filename)) throw new Error(`Unsafe demo image path: ${filename}`);

    const [existing] = await db.select({ id: media.id }).from(media).where(eq(media.filename, filename)).limit(1);
    if (existing && !FORCE) {
      ids.set(filename, existing.id);
      continue;
    }

    const values = await writeDemoImage(image);

    if (existing) {
      await db.update(media).set(values).where(eq(media.id, existing.id));
      ids.set(filename, existing.id);
    } else {
      const [row] = await db.insert(media).values(values).returning({ id: media.id });
      ids.set(filename, row!.id);
      created += 1;
    }
  }

  log('images', `${created} created, ${DEMO_IMAGES.length} total`);
  return ids;
}

/** Write every demo Lottie animation and add it to the media library. */
async function seedAnimations() {
  let created = 0;

  for (const animation of DEMO_ANIMATIONS) {
    const filename = demoAnimationFile(animation);
    if (!resolveStoredPath(filename)) throw new Error(`Unsafe demo animation path: ${filename}`);

    const [existing] = await db.select({ id: media.id }).from(media).where(eq(media.filename, filename)).limit(1);
    if (existing && !FORCE) continue;

    const values = await writeDemoAnimation(animation);

    if (existing) {
      await db.update(media).set(values).where(eq(media.id, existing.id));
    } else {
      await db.insert(media).values(values);
      created += 1;
    }
  }

  log('animations', `${created} created, ${DEMO_ANIMATIONS.length} total`);
}

/** Write every demo film (2.17) and add it to the media library. */
async function seedVideos() {
  let created = 0;
  for (const video of DEMO_VIDEOS) {
    const filename = demoVideoFile(video);
    if (!resolveStoredPath(filename)) throw new Error(`Unsafe demo video path: ${filename}`);
    const [existing] = await db.select({ id: media.id }).from(media).where(eq(media.filename, filename)).limit(1);
    if (existing && !FORCE) continue;
    const values = await writeDemoVideo(video);
    if (existing) await db.update(media).set(values).where(eq(media.id, existing.id));
    else {
      await db.insert(media).values(values);
      created += 1;
    }
  }
  log('videos', `${created} created, ${DEMO_VIDEOS.length} total`);
}

async function seedPages() {
  let created = 0;
  let replaced = 0;

  for (const [index, def] of demoPages.entries()) {
    // A demo page that loses blocks to validation is a bug in the demo, not
    // something to ship quietly.
    const parsed = parseBlocks(def.blocks);
    if (parsed.length !== def.blocks.length) {
      throw new Error(`Demo page ${def.path} has ${def.blocks.length - parsed.length} invalid block(s).`);
    }

    const [existing] = await db.select().from(pages).where(eq(pages.path, def.path)).limit(1);
    const values = {
      slug: def.slug,
      path: def.path,
      title: def.title,
      navLabel: def.navLabel ?? null,
      summary: 'summary' in def && typeof def.summary === 'string' ? def.summary : '',
      excerpt: def.excerpt,
      status: 'published' as const,
      blocks: def.blocks,
      seo: def.seo,
      template: def.template ?? 'default',
      priorityTier: def.priorityTier ?? null,
      isSystem: false,
      sortOrder: index,
      publishedAt: new Date(),
      deletedAt: null,
    };

    if (!existing) {
      await db.insert(pages).values(values);
      created += 1;
      continue;
    }

    // The installer's starter home page, never edited since, is the one page
    // the demo may replace without --force.
    const untouchedStarter = def.path === '/' && existing.createdAt.getTime() === existing.updatedAt.getTime();
    if (FORCE || untouchedStarter) {
      await db.update(pages).set(values).where(eq(pages.id, existing.id));
      replaced += 1;
    }
  }

  log('pages', `${created} created, ${replaced} replaced, ${demoPages.length} total`);
}

async function seedPosts(imageIds: Map<string, string>) {
  const categoryIds = new Map<string, string>();
  for (const [index, cat] of demoCategories.entries()) {
    const [existing] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, cat.slug)).limit(1);
    if (existing) {
      categoryIds.set(cat.slug, existing.id);
      continue;
    }
    const [row] = await db
      .insert(categories)
      .values({ slug: cat.slug, name: cat.name, description: cat.description, sortOrder: index, isSystem: false, seo: { title: cat.name, description: cat.description } })
      .returning({ id: categories.id });
    categoryIds.set(cat.slug, row!.id);
  }

  let created = 0;
  for (const post of demoPosts) {
    const [existing] = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, post.slug)).limit(1);
    if (existing && !FORCE) continue;

    const cover = DEMO_IMAGES.find((image) => image.name === post.cover);
    const body = sanitizeRichText(post.body);
    const values = {
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      body,
      kind: 'article' as const,
      status: 'published' as const,
      primaryCategoryId: categoryIds.get(post.categorySlug) ?? null,
      coverMediaId: cover ? (imageIds.get(demoImageFile(cover)) ?? null) : null,
      readingMinutes: readingMinutes(body),
      publishedAt: new Date(Date.now() - post.daysAgo * 86_400_000),
      seo: { title: post.title, description: post.excerpt.slice(0, 155), twitterCard: 'summary_large_image' as const },
    };

    const [row] = existing
      ? await db.update(posts).set(values).where(eq(posts.id, existing.id)).returning({ id: posts.id })
      : await db.insert(posts).values(values).returning({ id: posts.id });

    const categoryId = categoryIds.get(post.categorySlug);
    if (row && categoryId) await db.insert(postCategories).values({ postId: row.id, categoryId }).onConflictDoNothing();
    if (!existing) created += 1;
  }

  log('posts', `${created} created, ${demoPosts.length} total, ${demoCategories.length} categories`);
}

async function seedNavigation() {
  const value = navigationSchema.parse(demoNavigation);
  const [existing] = await db.select({ key: settings.key }).from(settings).where(eq(settings.key, NAVIGATION_SETTING_KEY)).limit(1);

  if (existing && !FORCE) {
    log('menus', 'kept the existing menus (use --force to replace them)');
    return;
  }
  if (existing) await db.update(settings).set({ value }).where(eq(settings.key, NAVIGATION_SETTING_KEY));
  else await db.insert(settings).values({ key: NAVIGATION_SETTING_KEY, value });
  log('menus', existing ? 'replaced' : 'created');
}

/** P3-D — the demo popups; the ones that open by themselves only do so on /library/effects. */
async function seedPopups() {
  const value = popupsSchema.parse(demoPopups);
  const [existing] = await db.select({ key: settings.key }).from(settings).where(eq(settings.key, POPUPS_SETTING_KEY)).limit(1);

  if (existing && !FORCE) {
    log('popups', 'kept the existing popups (use --force to replace them)');
    return;
  }
  if (existing) await db.update(settings).set({ value }).where(eq(settings.key, POPUPS_SETTING_KEY));
  else await db.insert(settings).values({ key: POPUPS_SETTING_KEY, value });
  log('popups', `${existing ? 'replaced' : 'created'}, ${value.length} popups`);
}

/** 2.15 — the demo's saved block, which the Effects library page references. */
async function seedSavedBlock() {
  const [existing] = await db.select({ id: savedBlocks.id }).from(savedBlocks).where(eq(savedBlocks.id, DEMO_SAVED_BLOCK_ID)).limit(1);
  if (existing && !FORCE) {
    log('saved block', 'kept the existing demo saved block (use --force to replace it)');
    return;
  }
  const values = { ...demoSavedBlock, tree: parseBlocks(demoSavedBlock.tree) as typeof demoSavedBlock.tree };
  if (existing) await db.update(savedBlocks).set(values).where(eq(savedBlocks.id, DEMO_SAVED_BLOCK_ID));
  else await db.insert(savedBlocks).values(values);
  log('saved block', existing ? 'replaced' : 'created');
}

async function main() {
  console.log(`\nSeeding the demo site${FORCE ? ' (force)' : ''}…\n`);
  const imageIds = await seedImages();
  await seedAnimations();
  await seedVideos();
  await seedPages();
  await seedPosts(imageIds);
  await seedNavigation();
  await seedPopups();
  await seedSavedBlock();
  console.log('\nDone. Restart or redeploy a running production server so cached pages pick this up.');
  console.log('The block library is at /library.\n');
  process.exit(0);
}

main().catch((error) => {
  console.error('\nDemo seed failed:', error);
  process.exit(1);
});
