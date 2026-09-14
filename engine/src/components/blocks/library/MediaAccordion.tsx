'use client';

import { useId, useState } from 'react';
import type { TextTag } from '@/lib/blockStyle';
import { Icon } from '@/components/site/icons';
import { cn } from '@/lib/utils';
import { BlockHead } from '../parts';
import { MediaFill } from './media';

type Item = { question: string; answer: string; imageUrl?: string; alt?: string };

/**
 * CT6 — an accordion whose open item picks the image beside it.
 *
 * Closing every item keeps the last picture rather than leaving an empty
 * frame. On phones the side picture goes and each open item shows its own
 * above its text. Answers stay in the DOM, so FAQPage structured data and
 * crawlers see all of them.
 */
export function MediaAccordion({
  items,
  eyebrow,
  title,
  titleAs,
}: {
  items: Item[];
  eyebrow?: string;
  title?: string;
  titleAs?: TextTag;
}) {
  const base = useId();
  const [open, setOpen] = useState<number | null>(0);
  const [shown, setShown] = useState(0);

  const toggle = (i: number) => {
    const next = open === i ? null : i;
    setOpen(next);
    if (next !== null) setShown(next);
  };

  return (
    <div className="he-macc">
      <div>
        <BlockHead eyebrow={eyebrow} title={title} titleAs={titleAs} />
        <div className="he-macc__list">
          {items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.question + i} className={cn('he-macc__item', isOpen && 'is-open')}>
                <h3 className="m-0">
                  <button
                    id={`${base}-b${i}`}
                    type="button"
                    className="he-macc__btn"
                    aria-expanded={isOpen}
                    aria-controls={`${base}-p${i}`}
                    onClick={() => toggle(i)}
                  >
                    {item.question}
                    <Icon.Chevron dir="down" size={18} />
                  </button>
                </h3>
                <div id={`${base}-p${i}`} role="region" aria-labelledby={`${base}-b${i}`} className="he-macc__panel">
                  <div className="overflow-hidden">
                    {item.imageUrl && (
                      <div className="he-macc__inline">
                        <MediaFill imageUrl={item.imageUrl} alt={item.alt} className="he-fill" />
                      </div>
                    )}
                    <p className="he-macc__answer">{item.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="he-macc__stage" aria-hidden="true">
        {items.map((item, i) => (
          <div key={item.question + i} className={cn('he-macc__img', i === shown && 'is-active')}>
            <MediaFill imageUrl={item.imageUrl} alt="" className="he-fill" />
          </div>
        ))}
      </div>
    </div>
  );
}
