import NextLink from 'next/link';
import type { ComponentProps } from 'react';
import { withSlash } from '@/lib/permalinks';

/**
 * `next/link`, with the site's trailing-slash form applied to a site path.
 *
 * Every public component imports this instead of `next/link`, so a site set
 * to "always" writes `/about/` in its HTML rather than a link that answers
 * with a redirect. Under the default ("never") the href is untouched, so a
 * page renders exactly what it rendered before. An object href, an off-site
 * URL, a `mailto:` and an anchor are passed through as they are.
 */
export default function Link({ href, ...rest }: ComponentProps<typeof NextLink>) {
  return <NextLink href={typeof href === 'string' ? withSlash(href) : href} {...rest} />;
}
