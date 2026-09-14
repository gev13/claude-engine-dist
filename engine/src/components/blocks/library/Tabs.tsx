'use client';

import { useId, useState } from 'react';
import type { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/site/icons';
import type { blockSchemas } from '@/lib/blocks';
import { cn } from '@/lib/utils';
import { BlockHead } from '../parts';
import { arrowKeys } from './keys';
import { MediaFill } from './media';

type P = z.output<(typeof blockSchemas)['tabs']>;

const TONES = { base: '', raised: 'is-raised', flare: 'is-flare' } as const;

/**
 * CT7 — segmented tabs switching a text-and-image panel. V13 adds underlined
 * and plain-text tabs, a bar down the side, and an icon per tab.
 *
 * On phones the tab bar is replaced by a native select above the panel; both
 * drive the same state, and the panel keeps its tabpanel role either way.
 */
export function TabsBlock(p: P) {
  const base = useId();
  const [active, setActive] = useState(0);
  const tab = p.tabs[active] ?? p.tabs[0]!;
  // P3-B5 — the switch is always a centred toggle above the panel.
  const vertical = p.orientation === 'vertical' && p.style !== 'switch';
  const above = p.barPosition === 'above' || p.style === 'switch';

  const bar = (
    <>
      <div
        role="tablist"
        aria-label={p.title || 'Sections'}
        aria-orientation={vertical ? 'vertical' : undefined}
        className="he-tabs__bar"
        onKeyDown={arrowKeys(p.tabs.length, active, setActive)}
      >
        {p.tabs.map((t, i) => (
          <button
            key={t.label + i}
            id={`${base}-tab-${i}`}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-controls={`${base}-panel`}
            tabIndex={i === active ? 0 : -1}
            className={cn('he-tabs__tab', i === active && 'is-active')}
            onClick={() => setActive(i)}
          >
            {t.iconUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={t.iconUrl} alt="" className="he-tabs__icon" />
            )}
            {t.label}
          </button>
        ))}
      </div>
      <label className="he-tabs__select">
        <span className="sr-only">Choose a section</span>
        <select value={active} onChange={(e) => setActive(Number(e.target.value))}>
          {p.tabs.map((t, i) => (
            <option key={t.label + i} value={i}>
              {t.label}
            </option>
          ))}
        </select>
        <Icon.Chevron dir="down" size={16} />
      </label>
    </>
  );

  return (
    <section className={cn('he-lsec he-tabs', TONES[p.tone ?? 'base'])}>
      <div className="shell">
        <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} />
        <div className={cn('he-tabs__body', `is-bar-${p.barPosition}`, `is-${p.style}`, vertical && 'is-vertical')}>
          {(vertical || above) && bar}
          <div
            key={active}
            id={`${base}-panel`}
            role="tabpanel"
            aria-labelledby={`${base}-tab-${active}`}
            className={cn('he-tabs__panel', !tab.imageUrl && 'is-textonly')}
          >
            <div className="he-tabs__text">
              {tab.title && <h3 className="he-tabs__title">{tab.title}</h3>}
              {tab.body && <p className="he-lbody">{tab.body}</p>}
              {tab.link && (
                <div className="he-actions">
                  <Button href={tab.link.href}>{tab.link.label}</Button>
                </div>
              )}
            </div>
            {tab.imageUrl && (
              <div className="he-tabs__media">
                <MediaFill imageUrl={tab.imageUrl} alt={tab.alt} className="he-fill" />
              </div>
            )}
          </div>
          {!vertical && !above && bar}
        </div>
      </div>
    </section>
  );
}
