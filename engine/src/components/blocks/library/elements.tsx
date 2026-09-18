import type { z } from 'zod';
import { Icon, SocialIcon } from '@/components/site/icons';
import { Eyebrow } from '@/components/ui/Eyebrow';
import type { blockSchemas } from '@/lib/blocks';
import { SOCIAL_LABELS, type SocialNetwork } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { BlockHead, BlockTitle } from '../parts';
import { RotatingWords, TeamSplit, TypingWords } from './elements-client';
import { KineticText } from './KineticText';
import { MediaFill } from './media';
import { SmartLink } from './SmartLink';

/* ═══════════════════════════════════════════════════════════════════════════
   Package 2 elements, server half (EL1 heading, EL2 buttons, EL8 team)
   ───────────────────────────────────────────────────────────────────────────
   The interactive ones — message, progress, countdown, pricing and the
   switchable team profile — are in elements-client.tsx.
   ═══════════════════════════════════════════════════════════════════════════ */

type P<T extends keyof typeof blockSchemas> = z.output<(typeof blockSchemas)[T]>;

const TONES = { base: '', raised: 'is-raised', flare: 'is-flare' } as const;
const toneClass = (tone?: keyof typeof TONES) => TONES[tone ?? 'base'];

export { SmartLink };

/* ── EL1: heading ─────────────────────────────────────────────────────────── */

/** P3-B1 — hand-drawn marks, in a 200×60 box stretched over the words. */
const DRAWN: Record<string, string> = {
  circle: 'M100 5C45 3 5 15 7 31s55 25 106 24 88-12 86-28S150 3 88 8',
  curly: 'M2 50q8-10 16 0t16 0 16 0 16 0 16 0 16 0 16 0 16 0 16 0 16 0 16 0 16 0',
  strike: 'M2 34L198 28',
  zigzag: 'M2 52L14 42 26 52 38 42 50 52 62 42 74 52 86 42 98 52 110 42 122 52 134 42 146 52 158 42 170 52 182 42 194 52',
  double: 'M2 46H198M8 55H192',
};

function withHighlight(title: string, highlight: string | undefined, style: string) {
  if (!highlight) return title;
  const at = title.indexOf(highlight);
  if (at < 0) return title;
  return (
    <>
      {title.slice(0, at)}
      <mark className={cn('he-mark', `is-${style}`)}>
        {highlight}
        {DRAWN[style] && (
          <svg className="he-mark__draw" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <path d={DRAWN[style]} vectorEffect="non-scaling-stroke" />
          </svg>
        )}
      </mark>
      {title.slice(at + highlight.length)}
    </>
  );
}

export function HeadingBlock(p: P<'heading'>) {
  const kinetic = p.animation === 'kinetic';
  const title = (
    <BlockTitle as={p.titleAs ?? 'h2'} className={cn('he-hd__title', p.size === 'lede' && 'type-lede', p.textStyle !== 'solid' && `is-text-${p.textStyle}`)}>
      {kinetic ? (
        // SC3 — the old statement block's scroll-lit words; the highlight and typed words step aside.
        <KineticText text={p.title} as="span" />
      ) : (
        <>
          {withHighlight(p.title, p.highlight, p.highlightStyle)}
          {p.rotating.length > 0 && (
            <>
              {' '}
              {p.rotateEffect === 'typing' ? (
                <TypingWords words={p.rotating} speed={p.typingSpeed} />
              ) : (
                <RotatingWords words={p.rotating} effect={p.rotateEffect} />
              )}
            </>
          )}
        </>
      )}
    </BlockTitle>
  );
  const divider = p.divider !== 'none' && <span className={cn('he-hd__divider', `is-${p.divider}`)} aria-hidden="true" />;
  const subtitle = p.subtitle && <p className="he-lbody he-hd__sub">{p.subtitle}</p>;

  return (
    <section className={cn('he-lsec he-hd', toneClass(p.tone), `is-${p.align}`, `is-${p.size}`, `is-${p.layout}`)}>
      <div className="shell he-hd__inner">
        {p.badge && <span className="he-hd__badge">{p.badge}</span>}
        {p.eyebrow && <Eyebrow className={p.align === 'center' ? 'justify-center' : undefined}>{p.eyebrow}</Eyebrow>}
        {p.layout === 'split' ? (
          <div className={cn('he-hd__split', `is-v-${p.splitAlign}`)}>
            <div>
              {title}
              {divider}
            </div>
            {subtitle}
          </div>
        ) : (
          <>
            {title}
            {divider}
            {subtitle}
          </>
        )}
      </div>
    </section>
  );
}

/* ── EL2: buttons ─────────────────────────────────────────────────────────── */

const BUTTON_ICON = {
  arrow: <Icon.ArrowRight size={16} />,
  plus: <Icon.Plus size={16} />,
  play: <Icon.Play size={14} />,
  mail: <Icon.Mail size={16} />,
} as const;

export function ButtonsBlock(p: P<'buttons'>) {
  return (
    <section className={cn('he-lsec he-btns-sec', toneClass(p.tone))}>
      <div className={cn('shell he-btns', `is-${p.align}`, p.fullWidth && 'is-full')}>
        {p.items.map((b, i) => {
          const icon = b.icon === 'none' ? null : BUTTON_ICON[b.icon];
          return (
            <SmartLink
              key={b.href + i}
              href={b.href}
              label={b.iconOnly ? b.label : undefined}
              className={cn('he-cbtn', `is-${b.style}`, `is-${p.size}`, b.iconOnly && 'is-icon-only', b.shadow && 'has-shadow')}
            >
              {icon && b.iconSide === 'left' && icon}
              {!b.iconOnly && <span>{b.label}</span>}
              {icon && (b.iconSide === 'right' || b.iconOnly) && b.iconSide !== 'left' && icon}
            </SmartLink>
          );
        })}
      </div>
    </section>
  );
}

/* ── EL8: team ────────────────────────────────────────────────────────────── */

export function SocialRow({ links, className }: { links: { network: SocialNetwork; href: string }[]; className?: string }) {
  if (links.length === 0) return null;
  return (
    <ul className={cn('he-team__links', className)}>
      {links.map((l) => (
        <li key={l.network + l.href}>
          <a href={l.href} target="_blank" rel="noopener noreferrer" aria-label={SOCIAL_LABELS[l.network]}>
            <SocialIcon network={l.network} />
          </a>
        </li>
      ))}
    </ul>
  );
}

export function TeamBlock(p: P<'team'>) {
  const head = <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} />;

  if (p.variant === 'split') {
    return (
      <section className={cn('he-lsec he-team', toneClass(p.tone))}>
        <div className="shell">
          {head}
          <TeamSplit members={p.members} hover={p.hover} />
        </div>
      </section>
    );
  }

  return (
    <section className={cn('he-lsec he-team', toneClass(p.tone))}>
      <div className="shell">
        {head}
        <ul className={cn('he-team__grid', `is-${p.variant}`, `is-hover-${p.hover}`)} style={{ '--cols': p.columns } as React.CSSProperties}>
          {p.members.map((m, i) => (
            <li key={m.name + i} className="he-team__member">
              <div className="he-team__photo">
                <MediaFill imageUrl={m.imageUrl} alt={m.name} className="he-fill" />
                {p.variant === 'overlay' && (m.bio || m.links.length > 0) && (
                  <div className="he-team__overlay">
                    {m.bio && <p>{m.bio}</p>}
                    <SocialRow links={m.links} />
                  </div>
                )}
              </div>
              <h3 className="he-team__name">{m.name}</h3>
              {m.role && <p className="he-team__role">{m.role}</p>}
              {p.variant === 'cards' && (
                <>
                  {m.bio && <p className="he-team__bio">{m.bio}</p>}
                  <SocialRow links={m.links} />
                </>
              )}
              {p.variant === 'overlay' && (m.bio || m.links.length > 0) && (
                /* Touch screens have no hover: the same details show under the photo there. */
                <div className="he-team__touch">
                  {m.bio && <p className="he-team__bio">{m.bio}</p>}
                  <SocialRow links={m.links} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
