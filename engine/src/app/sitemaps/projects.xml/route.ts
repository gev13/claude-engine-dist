import { getPermalinks } from '@/server/routing/config';
import { XML_HEADERS, urlSet } from '@/lib/seo/sitemap';
import { projectPath, projectTermPath } from '@/lib/permalinks';
import { allPublishedProjects, termsWithProjects } from '@/server/content/projects';

export const revalidate = 3600;

/**
 * Every published project, and every category and tag archive that has at
 * least one — an empty archive is not worth a crawler's visit (2.14).
 */
export async function GET() {
  const permalinks = await getPermalinks();
  const [projects, terms] = await Promise.all([allPublishedProjects(), termsWithProjects()]);

  const alternates = new Map<string, { locale: string; path: string }[]>();
  for (const project of projects) {
    const list = alternates.get(project.groupId) ?? [];
    list.push({ locale: project.locale, path: projectPath(permalinks, project.slug) });
    alternates.set(project.groupId, list);
  }

  return new Response(
    urlSet([
      ...projects.map((project) => ({
        path: projectPath(permalinks, project.slug),
        locale: project.locale,
        alternates: alternates.get(project.groupId),
        lastModified: project.updatedAt,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      })),
      ...terms.map((term) => ({
        path: projectTermPath(permalinks, term.taxonomy, term.slug),
        locale: term.locale,
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      })),
    ]),
    { headers: XML_HEADERS },
  );
}
