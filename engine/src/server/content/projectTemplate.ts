import 'server-only';
import { cache } from 'react';
import type { Locale } from '@/lib/locales';
import { PROJECTS_SETTING_KEY, resolveProjectTemplate, type ProjectTemplate } from '@/lib/projects';
import { readLocalised } from './localisedSettings';

/**
 * How a project page is laid out (Projects → Page template). Per request,
 * and per language — the "More projects" heading is words a visitor reads.
 * Never throws: a missing or broken row is the plain defaults.
 */
export const getProjectTemplate = cache(async (locale?: Locale): Promise<ProjectTemplate> => {
  try {
    return resolveProjectTemplate(await readLocalised(PROJECTS_SETTING_KEY, locale));
  } catch {
    return resolveProjectTemplate(undefined);
  }
});
