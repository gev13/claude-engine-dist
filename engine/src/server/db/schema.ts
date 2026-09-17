import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/* ═══════════════════════════════════════════════════════════════════════════
   Enums
   ═══════════════════════════════════════════════════════════════════════════ */

/* Five roles, added in order of authority. 'admin' and 'editor' are the
   original two and keep exactly the access they always had, so no existing
   account changes when the others appear. */
export const userRole = pgEnum('user_role', ['admin', 'manager', 'editor', 'author', 'reviewer']);
export const contentStatus = pgEnum('content_status', ['draft', 'published', 'archived']);
export const postKind = pgEnum('post_kind', ['article', 'research']);
export const enquiryStatus = pgEnum('enquiry_status', ['new', 'read', 'replied', 'spam']);

/* ═══════════════════════════════════════════════════════════════════════════
   Users, sessions, auth
   ═══════════════════════════════════════════════════════════════════════════ */

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    username: varchar('username', { length: 64 }).notNull(),
    firstName: varchar('first_name', { length: 100 }).notNull().default(''),
    lastName: varchar('last_name', { length: 100 }).notNull().default(''),
    phone: varchar('phone', { length: 40 }),
    /** argon2id hash. Never leaves the server. */
    passwordHash: text('password_hash').notNull(),
    role: userRole('role').notNull().default('editor'),
    isActive: boolean('is_active').notNull().default(true),

    /** TOTP secret, base32. Null until 2FA enrolment completes. */
    totpSecret: text('totp_secret'),
    totpEnabledAt: timestamp('totp_enabled_at', { withTimezone: true }),
    /** Hashed single-use recovery codes. */
    recoveryCodes: jsonb('recovery_codes').$type<string[]>().notNull().default(sql`'[]'::jsonb`),

    /** Brute-force protection. */
    failedLoginCount: integer('failed_login_count').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),

    avatarMediaId: uuid('avatar_media_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_email_key').on(sql`lower(${t.email})`),
    uniqueIndex('users_username_key').on(sql`lower(${t.username})`),
    index('users_role_idx').on(t.role),
  ],
);

/**
 * One row per issued refresh token. Rotation writes a new row and marks the
 * old one used; reuse of a used token revokes the whole family (token theft).
 */
/**
 * Backups (package 6). The row is the record; the archive itself is a
 * `tar.gz` under BACKUP_DIR, which lives inside storage/ and is never
 * committed. A row whose file has gone is still worth keeping — it says a
 * backup was taken and what became of it.
 */
export const backups = pgTable(
  'backups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** File name inside BACKUP_DIR. Generated, never supplied by a caller. */
    filename: varchar('filename', { length: 200 }).notNull(),
    /** Why it exists: asked for, or taken before an update or a restore. */
    reason: varchar('reason', { length: 120 }).notNull().default('manual'),
    /** The engine version the archive came from, for refusing a mismatched restore. */
    engineVersion: varchar('engine_version', { length: 20 }).notNull(),
    byteSize: integer('byte_size').notNull().default(0),
    /** Row counts per table, so a restore can say what it is about to replace. */
    contents: jsonb('contents').$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
    includesMedia: boolean('includes_media').notNull().default(true),
    /** running · ready · failed — a backup is a process before it is a file. */
    status: varchar('status', { length: 20 }).notNull().default('running'),
    error: text('error'),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [index('backups_created_idx').on(t.createdAt)],
);

/**
 * Addresses refused at the door (package 5). Middleware reads this before any
 * page renders, so a blocked address never reaches the application. An
 * automatic block carries an expiry; one an administrator adds by hand can
 * stay until they remove it.
 */
export const blockedIps = pgTable(
  'blocked_ips',
  {
    ip: varchar('ip', { length: 64 }).primaryKey(),
    reason: varchar('reason', { length: 200 }).notNull().default(''),
    /** Null means it stays until somebody removes it. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    /** True when the engine added it, false when a person did. */
    automatic: boolean('automatic').notNull().default(false),
    /** How many requests have been turned away since it was added. */
    hits: integer('hits').notNull().default(0),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('blocked_ips_expires_idx').on(t.expiresAt)],
);

/**
 * Single-use password reset tokens (package 5). Only the hash is kept — the
 * raw token exists in the emailed link and nowhere else — and a token is spent
 * the moment it is used, so a forwarded email cannot be replayed.
 */
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    requestedIp: varchar('requested_ip', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('reset_token_hash_idx').on(t.tokenHash), index('reset_token_user_idx').on(t.userId)],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** sha256 of the token; the raw value only ever lives in the cookie. */
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    familyId: uuid('family_id').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    userAgent: varchar('user_agent', { length: 400 }),
    ip: varchar('ip', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('refresh_tokens_hash_key').on(t.tokenHash),
    index('refresh_tokens_user_idx').on(t.userId),
    index('refresh_tokens_family_idx').on(t.familyId),
  ],
);

/** Rate limiting / progressive lockout counters, keyed by bucket. */
export const rateLimits = pgTable(
  'rate_limits',
  {
    key: varchar('key', { length: 200 }).primaryKey(),
    count: integer('count').notNull().default(0),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull().defaultNow(),
    blockedUntil: timestamp('blocked_until', { withTimezone: true }),
  },
  (t) => [index('rate_limits_window_idx').on(t.windowStart)],
);

/* ═══════════════════════════════════════════════════════════════════════════
   Media
   ═══════════════════════════════════════════════════════════════════════════ */

export const media = pgTable(
  'media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    filename: varchar('filename', { length: 300 }).notNull(),
    originalName: varchar('original_name', { length: 300 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    extension: varchar('extension', { length: 10 }).notNull(),
    byteSize: bigint('byte_size', { mode: 'number' }).notNull(),
    width: integer('width'),
    height: integer('height'),
    /** Public path under /media. */
    url: varchar('url', { length: 500 }).notNull(),
    altText: varchar('alt_text', { length: 300 }).notNull().default(''),
    caption: text('caption').notNull().default(''),
    checksum: varchar('checksum', { length: 64 }),
    uploadedById: uuid('uploaded_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('media_created_idx').on(t.createdAt),
    index('media_mime_idx').on(t.mimeType),
    uniqueIndex('media_filename_key').on(t.filename),
  ],
);

/* ═══════════════════════════════════════════════════════════════════════════
   SEO — one embeddable shape reused by pages, posts and categories
   ═══════════════════════════════════════════════════════════════════════════ */

export type SeoFields = {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  robots?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageId?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  /** Raw JSON-LD blobs appended to the page's generated graph. */
  jsonLd?: unknown[];
  /** Arbitrary extra <meta> tags, editable from the admin panel. */
  extraMeta?: { name?: string; property?: string; content: string }[];
};

/* ═══════════════════════════════════════════════════════════════════════════
   Block builder
   ═══════════════════════════════════════════════════════════════════════════ */

export type Block = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: Block[];
};

/* ═══════════════════════════════════════════════════════════════════════════
   Pages
   ═══════════════════════════════════════════════════════════════════════════ */

export const pages = pgTable(
  'pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 200 }).notNull(),
    /** Full public path, e.g. /services/api-security-testing. */
    path: varchar('path', { length: 300 }).notNull(),
    /* Package 8. Every existing row is English, which is why the default is
       'en' rather than nullable — a page always has a language. */
    locale: varchar('locale', { length: 5 }).notNull().default('en'),
    /**
     * Translations of one another share a group. It is what the language
     * switcher reads, what hreflang pairs are built from, and what the admin
     * uses to say which languages a page is missing.
     *
     * `defaultRandom()` is deliberate: adding this column gives every existing
     * row its own group, so nothing is accidentally declared a translation of
     * anything else.
     */
    translationGroupId: uuid('translation_group_id').notNull().defaultRandom(),
    title: varchar('title', { length: 300 }).notNull(),
    /** Short label used in nav and breadcrumbs. */
    navLabel: varchar('nav_label', { length: 120 }),
    /**
     * One line, for cards, menus and structured data.
     *
     * Distinct from `excerpt`, which is the meta description and is written for
     * search results — long, and wrong in a card. Conflating them was a real
     * bug: the services index rendered whole paragraphs where the design has a
     * single line.
     */
    summary: varchar('summary', { length: 300 }).notNull().default(''),
    excerpt: text('excerpt').notNull().default(''),
    status: contentStatus('status').notNull().default('draft'),
    /** Ordered block tree rendered by the public page. */
    blocks: jsonb('blocks').$type<Block[]>().notNull().default(sql`'[]'::jsonb`),
    seo: jsonb('seo').$type<SeoFields>().notNull().default(sql`'{}'::jsonb`),
    /** Custom CSS for this page alone, written into a <style> after the theme. */
    customCss: text('custom_css').notNull().default(''),
    /** Nesting for the sitemap tree. */
    parentId: uuid('parent_id'),
    sortOrder: integer('sort_order').notNull().default(0),
    /** 'service' pages get service-specific treatment (schema.org Product etc). */
    template: varchar('template', { length: 60 }).notNull().default('default'),
    /** primary | secondary — from sitemap.md service priorities. */
    priorityTier: varchar('priority_tier', { length: 20 }),
    /** Locked pages cannot be deleted from the admin (home, contact, ...). */
    /**
     * Soft delete. Set together with `status = 'archived'` on purpose: every
     * public query already filters on `published`, so a missed `deletedAt`
     * filter somewhere cannot leak trashed content. Belt and braces, because
     * the cost of getting it wrong is deleted content still being live.
     */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    isSystem: boolean('is_system').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /* A path is unique *within* a language: /about in English and /about in
       Russian are different pages, not a collision. */
    uniqueIndex('pages_path_key').on(t.locale, t.path),
    index('pages_translation_idx').on(t.translationGroupId),
    index('pages_slug_idx').on(t.slug),
    index('pages_status_idx').on(t.status),
    index('pages_parent_idx').on(t.parentId),
  ],
);

/* ═══════════════════════════════════════════════════════════════════════════
   Categories & posts
   ═══════════════════════════════════════════════════════════════════════════ */

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 200 }).notNull(),
    /** Package 8 — see the note on `pages.locale`. */
    locale: varchar('locale', { length: 5 }).notNull().default('en'),
    translationGroupId: uuid('translation_group_id').notNull().defaultRandom(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description').notNull().default(''),
    seo: jsonb('seo').$type<SeoFields>().notNull().default(sql`'{}'::jsonb`),
    parentId: uuid('parent_id'),
    sortOrder: integer('sort_order').notNull().default(0),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('categories_slug_key').on(t.locale, t.slug),
    index('categories_translation_idx').on(t.translationGroupId),
    index('categories_parent_idx').on(t.parentId),
  ],
);

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 200 }).notNull(),
    /** Package 8 — see the note on `pages.locale`. */
    locale: varchar('locale', { length: 5 }).notNull().default('en'),
    translationGroupId: uuid('translation_group_id').notNull().defaultRandom(),
    title: varchar('title', { length: 300 }).notNull(),
    excerpt: text('excerpt').notNull().default(''),
    /** Sanitised TinyMCE HTML. */
    body: text('body').notNull().default(''),
    /** Optional block tree, for posts built with the page builder instead. */
    blocks: jsonb('blocks').$type<Block[]>().notNull().default(sql`'[]'::jsonb`),
    kind: postKind('kind').notNull().default('article'),
    status: contentStatus('status').notNull().default('draft'),
    seo: jsonb('seo').$type<SeoFields>().notNull().default(sql`'{}'::jsonb`),
    /** Custom CSS for this page alone, written into a <style> after the theme. */
    customCss: text('custom_css').notNull().default(''),
    coverMediaId: uuid('cover_media_id').references(() => media.id, { onDelete: 'set null' }),
    primaryCategoryId: uuid('primary_category_id').references(() => categories.id, { onDelete: 'set null' }),
    readingMinutes: integer('reading_minutes').notNull().default(0),
    viewCount: integer('view_count').notNull().default(0),
    /**
     * Soft delete. Set together with `status = 'archived'` on purpose: every
     * public query already filters on `published`, so a missed `deletedAt`
     * filter somewhere cannot leak trashed content. Belt and braces, because
     * the cost of getting it wrong is deleted content still being live.
     */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('posts_slug_key').on(t.locale, t.slug),
    index('posts_translation_idx').on(t.translationGroupId),
    index('posts_status_published_idx').on(t.status, t.publishedAt),
    index('posts_kind_idx').on(t.kind),
    index('posts_category_idx').on(t.primaryCategoryId),
  ],
);

export const postCategories = pgTable(
  'post_categories',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.categoryId] })],
);

/* ═══════════════════════════════════════════════════════════════════════════
   Settings, enquiries, audit
   ═══════════════════════════════════════════════════════════════════════════ */

export const settings = pgTable('settings', {
  key: varchar('key', { length: 120 }).primaryKey(),
  value: jsonb('value').notNull(),
  updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const enquiries = pgTable(
  'enquiries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 200 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    company: varchar('company', { length: 200 }).notNull().default(''),
    role: varchar('role', { length: 200 }).notNull().default(''),
    businessType: varchar('business_type', { length: 80 }).notNull().default(''),
    services: jsonb('services').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    timing: varchar('timing', { length: 300 }).notNull().default(''),
    message: text('message').notNull().default(''),
    status: enquiryStatus('status').notNull().default('new'),
    /** Truncated, never used for anything but abuse triage. */
    ip: varchar('ip', { length: 64 }),
    userAgent: varchar('user_agent', { length: 400 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('enquiries_status_idx').on(t.status), index('enquiries_created_idx').on(t.createdAt)],
);

/**
 * Newsletter sign-ups from the newsletter block.
 *
 * Collected, never mailed: a sign-up notifies the site's administrators, and
 * nothing is ever sent to the subscriber. The admin list and its CSV export
 * are how the addresses leave the site — this is not a mailing list.
 *
 * The address is unique and stored lower-cased, so signing up twice is a
 * no-op, and the route answers a repeat address exactly as a new one so the
 * form cannot be used to find out who is subscribed.
 */
export const newsletterSubscribers = pgTable(
  'newsletter_subscribers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    /** The page the form was on. */
    source: varchar('source', { length: 300 }).notNull().default(''),
    /** When the visitor ticked the consent box, if the form had one. */
    consentAt: timestamp('consent_at', { withTimezone: true }),
    /** Truncated, never used for anything but abuse triage. */
    ip: varchar('ip', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('newsletter_subscribers_email_key').on(t.email),
    index('newsletter_subscribers_created_idx').on(t.createdAt),
  ],
);

/**
 * Answers sent through a form block (P3-E). Each row keeps the questions as
 * they were asked, beside the answers, so renaming a field later never
 * changes what an old submission says.
 */
export const formSubmissions = pgTable(
  'form_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** The form block's id. */
    formId: varchar('form_id', { length: 64 }).notNull(),
    formName: varchar('form_name', { length: 120 }).notNull(),
    /** The page the form was on. */
    source: varchar('source', { length: 300 }).notNull().default(''),
    answers: jsonb('answers')
      .$type<{ id: string; label: string; value: string | string[] | boolean }[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** Truncated, never used for anything but abuse triage. */
    ip: varchar('ip', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('form_submissions_created_idx').on(t.createdAt), index('form_submissions_form_idx').on(t.formName)],
);

/**
 * Append-only. No UPDATE or DELETE path exists in the application; a database
 * trigger (see drizzle/0001_audit_immutable.sql) enforces it at the engine.
 */
export const revisionEntity = pgEnum('revision_entity', ['page', 'post']);

/**
 * Content history.
 *
 * One row per successful write, holding the full state *after* that write — so
 * the newest revision always matches what is live, and restoring is "write this
 * snapshot back" rather than a replay of diffs.
 *
 * Unlike the audit log this is not append-only at the database level: old
 * revisions are pruned past `REVISION_LIMIT`, and a deleted page takes its
 * history with it. The audit log remains the immutable record of *who did
 * what*; this is the record of *what it said*.
 */
export const contentRevisions = pgTable(
  'content_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: revisionEntity('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    /** 1-based, per entity, so the UI can say "revision 12" without a lookup. */
    revisionNumber: integer('revision_number').notNull(),
    /** The complete content columns at this point, as stored. */
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(),
    /** What caused it: 'create', 'update', 'restore'. */
    reason: varchar('reason', { length: 40 }).notNull().default('update'),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    authorEmail: varchar('author_email', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('revision_entity_idx').on(t.entityType, t.entityId, t.revisionNumber),
    index('revision_created_idx').on(t.createdAt),
  ],
);

export type ContentRevision = typeof contentRevisions.$inferSelect;

/**
 * Managed redirects.
 *
 * Slugs change; links do not. Without this every path change silently breaks
 * inbound links and whatever a search engine already indexed.
 */
export const redirects = pgTable(
  'redirects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Always stored with a leading slash and no trailing slash. */
    fromPath: varchar('from_path', { length: 400 }).notNull(),
    toPath: varchar('to_path', { length: 500 }).notNull(),
    /** 301 permanent or 302 temporary. Nothing else is worth offering. */
    status: integer('status').notNull().default(301),
    isActive: boolean('is_active').notNull().default(true),
    note: varchar('note', { length: 300 }).notNull().default(''),
    hits: integer('hits').notNull().default(0),
    lastHitAt: timestamp('last_hit_at', { withTimezone: true }),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('redirect_from_idx').on(t.fromPath)],
);

export type Redirect = typeof redirects.$inferSelect;

/**
 * Aggregated 404s, one row per path.
 *
 * Aggregated rather than one row per request: the useful question is "which
 * paths are people failing to reach, and how often", and a log with a row per
 * hit answers that worse while growing without bound.
 */
export const notFoundLog = pgTable(
  'not_found_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    path: varchar('path', { length: 400 }).notNull(),
    hits: integer('hits').notNull().default(1),
    lastReferrer: varchar('last_referrer', { length: 500 }),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    /** Cleared when somebody creates a redirect for it or dismisses it. */
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('not_found_path_idx').on(t.path), index('not_found_seen_idx').on(t.lastSeenAt)],
);

export type NotFoundEntry = typeof notFoundLog.$inferSelect;

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * No foreign key on purpose. The log is append-only, so Postgres cannot
     * null this column when an account is deleted — the trigger refuses the
     * UPDATE, and the delete fails with it. History keeps the id it recorded
     * and `actor_email` beside it, which stays readable after the account has
     * gone. See drizzle/sql/0002_audit_actor_no_fk.sql.
     */
    actorId: uuid('actor_id'),
    actorEmail: varchar('actor_email', { length: 255 }),
    action: varchar('action', { length: 120 }).notNull(),
    targetType: varchar('target_type', { length: 80 }),
    targetId: varchar('target_id', { length: 120 }),
    summary: text('summary').notNull().default(''),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    ip: varchar('ip', { length: 64 }),
    requestId: varchar('request_id', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_actor_idx').on(t.actorId),
    index('audit_action_idx').on(t.action),
    index('audit_created_idx').on(t.createdAt),
    index('audit_target_idx').on(t.targetType, t.targetId),
  ],
);

/* ═══════════════════════════════════════════════════════════════════════════
   Relations
   ═══════════════════════════════════════════════════════════════════════════ */

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  pages: many(pages),
  refreshTokens: many(refreshTokens),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  cover: one(media, { fields: [posts.coverMediaId], references: [media.id] }),
  primaryCategory: one(categories, { fields: [posts.primaryCategoryId], references: [categories.id] }),
  categories: many(postCategories),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  posts: many(postCategories),
}));

export const postCategoriesRelations = relations(postCategories, ({ one }) => ({
  post: one(posts, { fields: [postCategories.postId], references: [posts.id] }),
  category: one(categories, { fields: [postCategories.categoryId], references: [categories.id] }),
}));

export const pagesRelations = relations(pages, ({ one }) => ({
  author: one(users, { fields: [pages.authorId], references: [users.id] }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));

/* ═══════════════════════════════════════════════════════════════════════════
   Jobs and applications (package 9)
   ───────────────────────────────────────────────────────────────────────────
   A job is a content type rather than a block, for the same reason a post is:
   it has a listing, a page of its own and something people do on it. It gets
   the same shape as pages and posts — a language, a translation group, a
   status, a soft delete, an author — so everything built for those works here
   too.

   The six columns between `location` and `department` are the meta grid the
   design draws. They are free text rather than enums on purpose: "Yerevan,
   Armenia" and "Hybrid — 3 days in office" are both real answers, and a fixed
   list would be wrong within a year.
   ═══════════════════════════════════════════════════════════════════════════ */

export const applicationStatus = pgEnum('application_status', [
  'new',
  'read',
  'shortlisted',
  'rejected',
]);

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 200 }).notNull(),
    locale: varchar('locale', { length: 5 }).notNull().default('en'),
    translationGroupId: uuid('translation_group_id').notNull().defaultRandom(),
    title: varchar('title', { length: 300 }).notNull(),
    /** The truncated line on the listing card. */
    excerpt: text('excerpt').notNull().default(''),

    /* The meta grid, in the order the design shows it. */
    location: varchar('location', { length: 160 }).notNull().default(''),
    contractType: varchar('contract_type', { length: 120 }).notNull().default(''),
    workingTime: varchar('working_time', { length: 120 }).notNull().default(''),
    seniority: varchar('seniority', { length: 120 }).notNull().default(''),
    workweek: varchar('workweek', { length: 120 }).notNull().default(''),
    department: varchar('department', { length: 160 }).notNull().default(''),

    /* The three body sections, each sanitised rich text. */
    description: text('description').notNull().default(''),
    responsibilities: text('responsibilities').notNull().default(''),
    benefits: text('benefits').notNull().default(''),

    coverMediaId: uuid('cover_media_id').references(() => media.id, { onDelete: 'set null' }),
    seo: jsonb('seo').$type<SeoFields>().notNull().default(sql`'{}'::jsonb`),

    /** Shown as "Posted 12 days ago"; the deadline as "12 days left". */
    postedAt: timestamp('posted_at', { withTimezone: true }),
    deadline: timestamp('deadline', { withTimezone: true }),
    /** Closed by hand, independently of the deadline passing. */
    isOpen: boolean('is_open').notNull().default(true),

    status: contentStatus('status').notNull().default('draft'),
    sortOrder: integer('sort_order').notNull().default(0),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('jobs_slug_key').on(t.locale, t.slug),
    index('jobs_translation_idx').on(t.translationGroupId),
    index('jobs_status_idx').on(t.status, t.publishedAt),
    index('jobs_open_idx').on(t.isOpen),
  ],
);

/**
 * An application is a form submission with a file attached.
 *
 * The CV is referenced by the name this engine generated, never by whatever
 * the applicant called theirs — that is kept alongside, for the inbox to show.
 * Deleting an application deletes the row; the file is removed by the code
 * that handles it, because a database cannot unlink.
 */
export const applications = pgTable(
  'applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    /** Kept beside the id, so a deleted job still names itself in the inbox. */
    jobTitle: varchar('job_title', { length: 300 }).notNull().default(''),

    name: varchar('name', { length: 200 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 60 }).notNull().default(''),
    coverLetter: text('cover_letter').notNull().default(''),

    /** Generated: a uuid and an extension. See server/applications/storage.ts. */
    cvFilename: varchar('cv_filename', { length: 80 }),
    /** What the applicant called it. Display only; never a path. */
    cvOriginalName: varchar('cv_original_name', { length: 160 }).notNull().default(''),
    cvBytes: integer('cv_bytes').notNull().default(0),

    status: applicationStatus('status').notNull().default('new'),
    /** Truncated, never used for anything but abuse triage. */
    ip: varchar('ip', { length: 64 }),
    userAgent: varchar('user_agent', { length: 400 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('applications_job_idx').on(t.jobId),
    index('applications_status_idx').on(t.status),
    index('applications_created_idx').on(t.createdAt),
  ],
);

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  author: one(users, { fields: [jobs.authorId], references: [users.id] }),
  cover: one(media, { fields: [jobs.coverMediaId], references: [media.id] }),
  applications: many(applications),
}));

export const applicationsRelations = relations(applications, ({ one }) => ({
  job: one(jobs, { fields: [applications.jobId], references: [jobs.id] }),
}));

/* Inferred row types */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Page = typeof pages.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Media = typeof media.$inferSelect;
export type Enquiry = typeof enquiries.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type Application = typeof applications.$inferSelect;
