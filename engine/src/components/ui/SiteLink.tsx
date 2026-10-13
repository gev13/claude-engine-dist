'use client';

import NextLink from 'next/link';
import type { ComponentProps } from 'react';
import { useLocaleHref } from '@/components/ui/LocaleLinks';
import { withSlash } from '@/lib/permalinks';

/**
 * `next/link`, with a site path written in the page's language and the
 * site's trailing-slash form.
 *
 * Every public component imports this instead of `next/link`, so a site set
 * to "always" writes `/about/` in its HTML rather than a link that answers
 * with a redirect, and (3.30.1) a Russian page links to `/ru/about` rather
 * than the English page. In the default language and under the default
 * slash mode ("never") the href is untouched, so a page renders exactly what
 * it rendered before. An object href, an off-site URL, a `mailto:`, an anchor
 * and a path already in a language are passed through as they are.
 *
 * A client component so it can read the language from context; a server
 * component renders it like any other.
 */
export default function Link({ href, ...rest }: ComponentProps<typeof NextLink>) {
  const inLanguage = useLocaleHref();
  return <NextLink href={typeof href === 'string' ? withSlash(inLanguage(href)) : href} {...rest} />;
}
