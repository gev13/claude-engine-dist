import type { z } from 'zod';
import { SocialIcon } from '@/components/site/icons';
import type { blockSchemas } from '@/lib/blocks';
import { SOCIAL_LABELS, opensElsewhere, socialText, type SocialNetwork } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { getNavigation } from '@/server/content/navigation';

type P = z.output<(typeof blockSchemas)['socialLinks']>;

const TONES = { base: '', raised: 'is-raised', flare: 'is-flare' } as const;

/** Brand colours, used only when the block asks for them. */
const BRAND: Record<SocialNetwork, string> = {
  x: '#e7e9ea',
  linkedin: '#0a66c2',
  instagram: '#e1306c',
  facebook: '#1877f2',
  youtube: '#ff0033',
  github: '#8b949e',
  tiktok: '#25f4ee',
  behance: '#1769ff',
  dribbble: '#ea4c89',
  vimeo: '#1ab7ea',
  pinterest: '#e60023',
  telegram: '#26a5e4',
  whatsapp: '#25d366',
  discord: '#5865f2',
  threads: '#e7e9ea',
  reddit: '#ff4500',
  twitch: '#9146ff',
  medium: '#e7e9ea',
  email: '#8b949e',
  phone: '#8b949e',
};

/** The icon colour on a filled brand circle, where white would vanish. */
const BRAND_ON: Partial<Record<SocialNetwork, string>> = { x: '#0f1419', tiktok: '#0f1419', threads: '#0f1419', medium: '#0f1419' };

/**
 * EL6 — social profile links. `site` reads the links saved in Menus, so a
 * profile changes in one place; `custom` uses the block's own list. With no
 * links at all the block renders nothing rather than an empty row.
 */
export async function SocialLinksBlock(p: P) {
  const links = p.source === 'site' ? (await getNavigation()).social : p.links;
  if (links.length === 0) return null;

  return (
    <section className={cn('he-lsec he-social-sec', TONES[p.tone ?? 'base'], `is-${p.align}`)}>
      <div className="shell">
        {p.title && <p className="he-social__title">{p.title}</p>}
        <ul className={cn('he-social', `is-${p.style}`, `is-${p.size}`, p.brandColors && 'is-brand')}>
          {links.map((link) => (
            <li key={link.network + link.href}>
              <a
                href={link.href}
                {...(opensElsewhere(link) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="he-social__a"
                aria-label={p.style === 'text' ? undefined : SOCIAL_LABELS[link.network]}
                style={p.brandColors ? ({ '--brand': BRAND[link.network], '--brand-on': BRAND_ON[link.network] ?? '#fff' } as React.CSSProperties) : undefined}
              >
                {p.style === 'text' ? SOCIAL_LABELS[link.network] : p.style === 'short' ? socialText(link, 'short') : <SocialIcon network={link.network} />}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
