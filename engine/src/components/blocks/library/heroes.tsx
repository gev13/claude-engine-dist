import Link from '@/components/ui/SiteLink';
import type { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/Eyebrow';
import type { blockSchemas } from '@/lib/blocks';
import { cn } from '@/lib/utils';
import { BlockTitle } from '../parts';
import { HeroLayers } from './HeroLayers';
import { MediaFill } from './media';

type P = z.output<(typeof blockSchemas)['hero']>;

/* ═══════════════════════════════════════════════════════════════════════════
   Library heroes (HR1–HR4, HR8)
   ───────────────────────────────────────────────────────────────────────────
   Everything but the classic hero. The ones that put text over media mark
   themselves `he-bleed-top`, so a transparent header can run over them.
   ═══════════════════════════════════════════════════════════════════════════ */

function Text({ p, align = 'left' }: { p: P; align?: 'left' | 'center' }) {
  return (
    <>
      {p.announcement && (
        <Link href={p.announcement.href} className="he-pillbadge">
          {p.announcement.label} <span aria-hidden="true">›</span>
        </Link>
      )}
      {/* 2.22 — the small line above the eyebrow ("Services / 02"), as the classic hero has it. */}
      {p.kicker && <p className={cn('he-hero__kicker', align === 'center' && 'is-center')}>{p.kicker}</p>}
      {p.eyebrow && <Eyebrow className={align === 'center' ? 'justify-center' : undefined}>{p.eyebrow}</Eyebrow>}
      <BlockTitle as={p.titleAs ?? 'h1'} className="he-hero__title">
        {p.title}
      </BlockTitle>
      {p.lede && <p className="he-hero__lede">{p.lede}</p>}
      {p.body && <p className="he-hero__body">{p.body}</p>}
      {p.links.length > 0 && (
        <div className="he-hero__actions">
          {p.links.map((l, i) => (
            <Button key={l.href + i} href={l.href} variant={l.variant ?? (i === 0 ? 'primary' : 'outline')}>
              {l.label}
            </Button>
          ))}
        </div>
      )}
    </>
  );
}

export function LibraryHero(p: P) {
  const media = (className: string, eager = true) => (
    <MediaFill imageUrl={p.imageUrl} videoUrl={p.videoUrl} alt={p.alt} className={className} eager={eager} />
  );

  if (p.variant === 'mediaCenter' || p.variant === 'mediaBottomLeft') {
    const center = p.variant === 'mediaCenter';
    return (
      <section
        className={cn(
          'he-hero he-hero--media he-bleed-top',
          center ? 'is-center' : 'is-bottom',
          `is-h-${p.height}`,
          `is-ov-${p.overlay}`,
        )}
      >
        {media('he-hero__bg')}
        <div className="shell he-hero__inner">
          <div className="he-hero__content">
            <Text p={p} align={center ? 'center' : 'left'} />
          </div>
        </div>
        {p.scrollCue && <span className="he-scrollcue" aria-hidden="true" />}
      </section>
    );
  }

  // P4-A5 — pictures at three depths, separated by the scroll and the pointer.
  if (p.variant === 'layered') {
    return (
      <section className={cn('he-hero he-hero--layered he-bleed-top', `is-h-${p.height}`, `is-ov-${p.overlay}`)}>
        <HeroLayers layers={p.layers} pointer={p.pointerParallax}>
          {media('he-hero__bg')}
        </HeroLayers>
        <div className="shell he-hero__inner">
          <div className="he-hero__content">
            <Text p={p} />
          </div>
        </div>
        {p.scrollCue && <span className="he-scrollcue" aria-hidden="true" />}
      </section>
    );
  }

  if (p.variant === 'split') {
    return (
      <section className={cn('he-hero he-hero--split', p.mediaSide === 'left' && 'is-media-left')}>
        <div className="shell he-hero__split">
          <div className="he-hero__content">
            <Text p={p} />
          </div>
          <div className="he-hero__visual">{media('he-hero__visualmedia')}</div>
        </div>
      </section>
    );
  }

  if (p.variant === 'statementFrame') {
    return (
      <section className="he-hero he-hero--statement">
        <div className="shell">
          <div className="he-hero__content is-center">
            <Text p={p} align="center" />
          </div>
          <div className="he-hero__frame">{media('he-hero__framemedia')}</div>
        </div>
      </section>
    );
  }

  // shaped (HR8)
  return (
    <section className={cn('he-hero he-hero--shaped he-bleed-top', `is-h-${p.height}`, `is-ov-${p.overlay}`)}>
      <div className="he-hero__shape">
        {media('he-hero__bg')}
        <div className="shell he-hero__inner">
          <div className="he-hero__content">
            <Text p={p} />
          </div>
        </div>
      </div>
    </section>
  );
}
