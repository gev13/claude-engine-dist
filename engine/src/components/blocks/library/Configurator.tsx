'use client';

import { useMessages } from '@/components/site/Messages';

import { useState } from 'react';
import type { z } from 'zod';
import { Icon } from '@/components/site/icons';
import type { blockSchemas } from '@/lib/blocks';
import { cn } from '@/lib/utils';
import { BlockHead } from '../parts';
import { arrowKeys } from './keys';
import { MediaFill } from './media';

type P = z.output<(typeof blockSchemas)['configurator']>;

const TONES = { base: '', raised: 'is-raised', flare: 'is-flare' } as const;

/**
 * CT11 — pick a colour, the picture follows. The swatches are a radio group
 * (arrow keys move between them); the arrows over the picture step through the
 * same list. Swatch colours come from the theme's colour grammar, so the only
 * thing reaching the style attribute is a validated colour.
 */
export function Configurator(p: P) {
  const t = useMessages();
  const [active, setActive] = useState(0);
  const count = p.options.length;
  const current = p.options[active] ?? p.options[0]!;
  const step = (d: number) => setActive((a) => (a + d + count) % count);

  return (
    <section className={cn('he-lsec he-cfg', TONES[p.tone ?? 'base'])}>
      <div className="shell">
        <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} align="center" />
        <div className="he-cfg__stage">
          {p.options.map((o, i) => (
            <div key={o.name + i} className={cn('he-cfg__slide', i === active && 'is-active')} aria-hidden={i !== active}>
              <MediaFill imageUrl={o.imageUrl} alt={o.alt || o.name} className="he-fill" eager={i === 0} />
            </div>
          ))}
          {count > 1 && (
            <div className="he-arrows is-side">
              <button type="button" className="he-arrow" aria-label={t('block.previousColour')} onClick={() => step(-1)}>
                <Icon.Chevron dir="left" size={20} />
              </button>
              <button type="button" className="he-arrow" aria-label={t('block.nextColour')} onClick={() => step(1)}>
                <Icon.Chevron dir="right" size={20} />
              </button>
            </div>
          )}
        </div>
        <div className="he-cfg__foot">
          <div role="radiogroup" aria-label={t('block.colour')} className="he-cfg__swatches" onKeyDown={arrowKeys(count, active, setActive)}>
            {p.options.map((o, i) => (
              <button
                key={o.name + i}
                type="button"
                role="radio"
                aria-checked={i === active}
                aria-label={o.name}
                tabIndex={i === active ? 0 : -1}
                className={cn('he-cfg__swatch', i === active && 'is-active')}
                style={{ background: o.color }}
                onClick={() => setActive(i)}
              />
            ))}
          </div>
          <p className="he-cfg__name" aria-live="polite">
            {current.name}
          </p>
        </div>
      </div>
    </section>
  );
}
