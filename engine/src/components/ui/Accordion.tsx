'use client';

import { useId, useState } from 'react';
import { cn } from '@/lib/utils';

export type FaqItem = { question: string; answer: string };
/** V1 — `lines` is the original look; the others draw each question as a box. */
export type AccordionLook = 'lines' | 'filled' | 'contained' | 'outlined';
export type AccordionIcon = 'plus' | 'chevron' | 'arrow';

function Marker({ icon, open }: { icon: AccordionIcon; open: boolean }) {
  if (icon === 'plus') {
    return (
      <span
        aria-hidden="true"
        className={cn('mt-1 shrink-0 font-mono text-[18px] leading-none text-flare transition-transform duration-200', open && 'rotate-45')}
      >
        +
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={cn('he-faq__marker', `is-${icon}`, open && 'is-open')}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d={icon === 'chevron' ? 'M6 9l6 6 6-6' : 'M5 12h14M13 6l6 6-6 6'} />
      </svg>
    </span>
  );
}

/**
 * The FAQ list from the service mockups. Uses <details> semantics via explicit
 * state so the +/− marker and the height transition stay in sync, and so the
 * answers remain in the DOM for crawlers and for FAQPage structured data.
 */
export function Accordion({
  items,
  className,
  look = 'lines',
  icon = 'plus',
}: {
  items: FaqItem[];
  className?: string;
  look?: AccordionLook;
  icon?: AccordionIcon;
}) {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();
  const boxed = look !== 'lines';

  return (
    <div className={cn(boxed ? `he-faq is-${look}` : 'border-t-2 border-hairline', className)}>
      {items.map((item, i) => {
        const isOpen = open === i;
        const panelId = `${base}-panel-${i}`;
        const buttonId = `${base}-button-${i}`;
        return (
          <div key={item.question} className={boxed ? cn('he-faq__item', isOpen && 'is-open') : 'border-b-2 border-hairline'}>
            <h3 className="m-0">
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className={boxed ? 'he-faq__btn' : 'flex w-full cursor-pointer items-start justify-between gap-6 bg-transparent px-0 py-5 text-left'}
              >
                <span
                  className={cn(
                    'font-display text-[17px] font-bold leading-[1.35] tracking-[-0.01em] transition-colors md:text-[19px]',
                    isOpen ? 'text-bone' : 'text-ash',
                  )}
                >
                  {item.question}
                </span>
                <Marker icon={icon} open={isOpen} />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={cn(
                'grid transition-[grid-template-rows] duration-300 ease-out',
                isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
              <div className="overflow-hidden">
                <p className={boxed ? 'he-faq__answer' : 'm-0 max-w-[70ch] pb-6 text-[16px] text-ash'}>{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
