import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import { db } from './index';
import { categories, pages, postCategories, posts, settings, users } from './schema';
import { pageDefinitions } from '@/content/pages';
import { categorySeeds, postSeeds } from '@/content/posts';
import { env } from '@/lib/env';
import { site } from '@/lib/site';
import { hashPassword } from '@/server/auth/password';
import { readingMinutes } from '@/lib/utils';

/**
 * Idempotent seed. Safe to run repeatedly: content is upserted by its natural
 * key, and existing edits to a row's body are preserved unless --force is
 * passed.
 */
const FORCE = process.argv.includes('--force');

function log(step: string, detail = '') {
  console.log(`  ${step.padEnd(28)}${detail}`);
}

async function seedUsers() {
  const definitions = [
    {
      email: env.SEED_ADMIN_EMAIL,
      password: env.SEED_ADMIN_PASSWORD,
      username: 'admin',
      firstName: 'Demo',
      lastName: 'Admin',
      role: 'admin' as const,
    },
    {
      email: env.SEED_EDITOR_EMAIL,
      password: env.SEED_EDITOR_PASSWORD,
      username: 'editor',
      firstName: 'Demo',
      lastName: 'Editor',
      role: 'editor' as const,
    },
  ];

  const ids: Record<string, string> = {};

  for (const def of definitions) {
    const [existing] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${def.email.toLowerCase()}`)
      .limit(1);

    if (existing) {
      ids[def.role] = existing.id;
      log(`user ${def.role}`, `${def.email} (exists)`);
      continue;
    }

    const [row] = await db
      .insert(users)
      .values({
        email: def.email,
        username: def.username,
        firstName: def.firstName,
        lastName: def.lastName,
        role: def.role,
        passwordHash: await hashPassword(def.password),
        isActive: true,
      })
      .returning({ id: users.id });

    ids[def.role] = row!.id;
    log(`user ${def.role}`, `${def.email} (created)`);
  }

  return ids;
}

async function seedPages(authorId: string | undefined) {
  let created = 0;
  let updated = 0;

  for (const [index, def] of pageDefinitions.entries()) {
    const [existing] = await db.select().from(pages).where(eq(pages.path, def.path)).limit(1);

    const values = {
      slug: def.slug,
      path: def.path,
      title: def.title,
      navLabel: def.navLabel ?? null,
      excerpt: def.excerpt,
      status: 'published' as const,
      blocks: def.blocks,
      seo: def.seo,
      template: def.template ?? 'default',
      priorityTier: def.priorityTier ?? null,
      isSystem: def.isSystem ?? true,
      sortOrder: index,
      publishedAt: new Date(),
      authorId: authorId ?? null,
    };

    if (!existing) {
      await db.insert(pages).values(values);
      created += 1;
    } else if (FORCE) {
      await db.update(pages).set(values).where(eq(pages.id, existing.id));
      updated += 1;
    }
  }

  log('pages', `${created} created, ${updated} updated, ${pageDefinitions.length} total`);
}

async function seedCategories() {
  const ids: Record<string, string> = {};

  for (const [index, cat] of categorySeeds.entries()) {
    const [existing] = await db.select().from(categories).where(eq(categories.slug, cat.slug)).limit(1);

    if (existing) {
      ids[cat.slug] = existing.id;
      continue;
    }

    const [row] = await db
      .insert(categories)
      .values({
        slug: cat.slug,
        name: cat.name,
        description: cat.description,
        sortOrder: index,
        isSystem: false,
        // No site-name suffix: the root layout's title template appends it.
        seo: {
          title: cat.name,
          description: cat.description,
        },
      })
      .returning({ id: categories.id });

    ids[cat.slug] = row!.id;
  }

  log('categories', `${categorySeeds.length} total`);
  return ids;
}

async function seedPosts(categoryIds: Record<string, string>, authorId: string | undefined) {
  let created = 0;

  for (const post of postSeeds) {
    const [existing] = await db.select().from(posts).where(eq(posts.slug, post.slug)).limit(1);
    if (existing && !FORCE) continue;

    const publishedAt = new Date(Date.now() - post.daysAgo * 86_400_000);
    const values = {
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      body: post.body,
      kind: post.kind,
      status: 'published' as const,
      primaryCategoryId: categoryIds[post.categorySlug] ?? null,
      readingMinutes: readingMinutes(post.body),
      publishedAt,
      authorId: authorId ?? null,
      seo: {
        title: post.title,
        description: post.excerpt.slice(0, 155),
        twitterCard: 'summary_large_image' as const,
      },
    };

    const [row] = existing
      ? await db.update(posts).set(values).where(eq(posts.id, existing.id)).returning({ id: posts.id })
      : await db.insert(posts).values(values).returning({ id: posts.id });

    const categoryId = categoryIds[post.categorySlug];
    if (row && categoryId) {
      await db.insert(postCategories).values({ postId: row.id, categoryId }).onConflictDoNothing();
    }
    if (!existing) created += 1;
  }

  log('posts', `${created} created, ${postSeeds.length} total`);
}

async function seedSettings() {
  const defaults: { key: string; value: unknown }[] = [
    { key: 'site.name', value: env.SITE_NAME },
    { key: 'site.tagline', value: site.tagline },
    { key: 'seo.defaultRobots', value: 'index, follow' },
    { key: 'seo.pingOnPublish', value: true },
    { key: 'media.acceptedTypes', value: ['webp', 'png', 'jpg', 'jpeg', 'mp4', 'webm', 'gif', 'pdf'] },
  ];

  for (const s of defaults) {
    await db.insert(settings).values(s).onConflictDoNothing();
  }
  log('settings', `${defaults.length} keys`);
}

async function main() {
  console.log('\nSeeding demo accounts and bundled content…\n');
  const userIds = await seedUsers();
  await seedPages(userIds.admin);
  const categoryIds = await seedCategories();
  await seedPosts(categoryIds, userIds.admin);
  await seedSettings();
  console.log('\nDone.\n');
  console.log(`  Admin   ${env.SEED_ADMIN_EMAIL} / ${env.SEED_ADMIN_PASSWORD}`);
  console.log(`  Editor  ${env.SEED_EDITOR_EMAIL} / ${env.SEED_EDITOR_PASSWORD}\n`);
  process.exit(0);
}

main().catch((error) => {
  console.error('\nSeed failed:', error);
  process.exit(1);
});
