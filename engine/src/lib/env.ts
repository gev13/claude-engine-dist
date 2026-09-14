import { z } from 'zod';

/**
 * Environment contract. Parsed once, at module load, on the server only.
 * Anything missing or malformed fails fast rather than at first request.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
  SITE_NAME: z.string().default('My Site'),

  DATABASE_URL: z.string().min(1).default('postgresql://postgres:postgres@localhost:5435/engine'),

  AUTH_ACCESS_SECRET: z.string().min(32).default('dev-only-access-secret-change-me-32-chars-min'),
  AUTH_REFRESH_SECRET: z.string().min(32).default('dev-only-refresh-secret-change-me-32-chars-min'),
  AUTH_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  AUTH_REFRESH_TTL: z.coerce.number().int().positive().default(2_592_000),
  AUTH_COOKIE_DOMAIN: z.string().optional(),
  AUTH_TOTP_ISSUER: z.string().default('My Site'),
  /**
   * The single switch for the second factor. When false the password alone
   * completes a login, even for an account that has already enrolled an
   * authenticator — the enrolled secret is preserved, so flipping this back to
   * true restores the challenge without re-enrolment.
   */
  AUTH_REQUIRE_2FA: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),

  /**
   * Encrypts secrets kept in settings rows (the SMTP password). Optional: the
   * access secret is used when it is unset, so an existing installation needs
   * no new value. Changing either means those secrets must be entered again.
   */
  SETTINGS_SECRET: z.string().default(''),

  /**
   * Where the engine's release feed is published (package 6). Deliberately an
   * environment value rather than a setting: an address an administrator could
   * type would be a URL the server then fetches, which is a request-forgery
   * vector. The panel can switch checking on and off, and nothing more.
   */
  ENGINE_RELEASE_FEED: z
    .string()
    .url()
    .default('https://raw.githubusercontent.com/gev13/claude-engine-dist/main/releases.json'),
  /**
   * Whether this site may update itself from the panel. Off unless the
   * operator turns it on: applying an update runs git, npm and a build on the
   * server, which is not something to leave switched on by default.
   */
  ENGINE_UPDATE_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  /** Where backup archives are written. Inside storage/, which git ignores. */
  BACKUP_DIR: z.string().default('./storage/backups'),

  MEDIA_STORAGE_DIR: z.string().default('./storage/media'),
  MEDIA_MAX_FILE_BYTES: z.coerce.number().int().positive().default(104_857_600),
  MEDIA_MAX_FILES_PER_UPLOAD: z.coerce.number().int().positive().default(100),

  MEILISEARCH_HOST: z.string().default('http://localhost:7700'),
  MEILISEARCH_MASTER_KEY: z.string().default(''),
  MEILISEARCH_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  SEED_ADMIN_EMAIL: z.string().default('admin@example.com'),
  SEED_ADMIN_PASSWORD: z.string().default('Admin123!'),
  SEED_EDITOR_EMAIL: z.string().default('editor@example.com'),
  SEED_EDITOR_PASSWORD: z.string().default('Editor123!'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;

export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';

/** Canonical origin with no trailing slash. */
export const SITE_URL = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');

// Running production without a second factor is a deliberate choice, never an
// accident. Say so loudly at boot rather than letting it pass unnoticed.
if (isProd && !env.AUTH_REQUIRE_2FA && typeof window === 'undefined') {
  console.warn(
    '[engine] AUTH_REQUIRE_2FA is false in production — admin accounts are protected by a password alone.',
  );
}
