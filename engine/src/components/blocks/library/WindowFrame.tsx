'use client';

import { useMessages } from '@/components/site/Messages';

import { useId, useState } from 'react';
import type { z } from 'zod';
import type { blockSchemas } from '@/lib/blocks';
import { cn } from '@/lib/utils';
import { BlockHead } from '../parts';
import { arrowKeys } from './keys';
import { MediaFill } from './media';

type P = z.output<(typeof blockSchemas)['windowFrame']>;

const TONES = { base: '', raised: 'is-raised', flare: 'is-flare' } as const;

/**
 * CT17 — a browser, app or terminal window around a screenshot or a code
 * sample, with tabs when there is more than one. Code is rendered as text
 * inside <pre>, never as HTML.
 */
export function WindowFrame(p: P) {
  const t = useMessages();
  const base = useId();
  const [active, setActive] = useState(0);
  const tab = p.tabs[active] ?? p.tabs[0]!;
  const tabbed = p.tabs.length > 1;

  return (
    <section className={cn('he-lsec he-win', TONES[p.tone ?? 'base'])}>
      <div className="shell">
        <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} />
        <div className={cn('he-win__frame', `is-${p.chrome}`)}>
          <div className="he-win__bar">
            <span className="he-win__lights" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {p.address && <span className={p.chrome === 'browser' ? 'he-win__address' : 'he-win__title'}>{p.address}</span>}
          </div>
          {tabbed && (
            <div role="tablist" aria-label={t('block.views')} className="he-win__tabs" onKeyDown={arrowKeys(p.tabs.length, active, setActive)}>
              {p.tabs.map((t, i) => (
                <button
                  key={t.label + i}
                  id={`${base}-tab-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  aria-controls={`${base}-panel`}
                  tabIndex={i === active ? 0 : -1}
                  className={cn('he-win__tab', i === active && 'is-active')}
                  onClick={() => setActive(i)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          <div className="he-win__body">
            {p.chrome === 'app' && p.sidebar.length > 0 && (
              <ul className="he-win__side" aria-hidden="true">
                {p.sidebar.map((item, i) => (
                  <li key={item + i}>{item}</li>
                ))}
              </ul>
            )}
            <div
              id={`${base}-panel`}
              className="he-win__panel"
              {...(tabbed ? { role: 'tabpanel', 'aria-labelledby': `${base}-tab-${active}` } : {})}
            >
              {tab.code ? (
                <pre className="he-win__code" tabIndex={0}>
                  <code>{tab.code}</code>
                </pre>
              ) : (
                <MediaFill imageUrl={tab.imageUrl} alt={tab.alt} className="he-win__shot" />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
