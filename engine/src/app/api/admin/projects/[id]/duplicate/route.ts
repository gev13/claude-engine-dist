import { duplicateHandler } from '@/server/api/duplicateRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Duplicate — a draft copy with fresh block ids, opened straight in its editor (T7). */
export const POST = duplicateHandler('project');
