import 'server-only';
import { cache } from 'react';
import type { AnyBlock } from '@/lib/blocks';
import { BLOG_ARCHIVE_SETTING_KEY, resolveBlogArchive } from '@/lib/blog';
import type { Locale } from '@/lib/locales';
import { readLocalised } from './localisedSettings';

/** The blocks around every category's list (2.18), per language. Never throws. */
export const getBlogArchive = cache(async (locale?: Locale): Promise<{ before: AnyBlock[]; after: AnyBlock[] }> => {
  try {
    const template = resolveBlogArchive(await readLocalised(BLOG_ARCHIVE_SETTING_KEY, locale));
    return { before: template.before as AnyBlock[], after: template.after as AnyBlock[] };
  } catch {
    return { before: [], after: [] };
  }
});
