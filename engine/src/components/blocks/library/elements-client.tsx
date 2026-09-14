'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { z } from 'zod';
import { Icon, SocialIcon } from '@/components/site/icons';
import type { blockSchemas } from '@/lib/blocks';
import { splitDuration } from '@/lib/countdown';
import { MOTION_EVENT, motionReduced } from '@/lib/motion';
import { SOCIAL_LABELS, type SocialNetwork } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { BlockHead } from '../parts';
import { arrowKeys } from './keys';
import { MediaFill } from './media';

/* ═══════════════════════════════════════════════════════════════════════════
   Package 2 elements, client half
   EL1 typed words · EL3 message · EL4 progress · EL5 countdown ·
   EL7 pricing switch · EL8 switchable team profile
   Every one renders a complete, readable state on the server; motion only
   ever starts from there, and never for reduced motion.
   ═══════════════════════════════════════════════════════════════════════════ */

type P<T extends keyof typeof blockSchemas> = z.output<(typeof blockSchemas)[T]>;

const TONES = { base: '', raised: 'is-raised', flare: 'is-flare' } as const;

/* ── EL1: typed rotating words ────────────────────────────────────────────── */

const TYPE_MS = { slow: 140, normal: 85, fast: 45 } as const;

export function TypingWords({ words, speed }: { words: string[]; speed: keyof typeof TYPE_MS }) {
  const [shown, setShown] = useState(words[0] ?? '');

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    let index = 0;
    let chars = (words[0] ?? '').length;
    let deleting = true;

    const tick = () => {
      if (cancelled) return;
      if (motionReduced()) {
        setShown(words[0] ?? '');
        timer = window.setTimeout(tick, 1000);
        return;
      }
      const word = words[index] ?? '';
      if (deleting) {
        chars -= 1;
        if (chars <= 0) {
          deleting = false;
          index = (index + 1) % words.length;
        }
      } else {
        chars += 1;
      }
      const current = words[index] ?? '';
      setShown((deleting ? word : current).slice(0, Math.max(chars, 0)));
      const full = !deleting && chars >= current.length;
      if (full) deleting = true;
      timer = window.setTimeout(tick, full ? 1800 : deleting ? TYPE_MS[speed] * 0.6 : TYPE_MS[speed]);
    };

    timer = window.setTimeout(tick, 1800);
    const restart = () => setShown(words[0] ?? '');
    window.addEventListener(MOTION_EVENT, restart);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener(MOTION_EVENT, restart);
    };
  }, [words, speed]);

  return (
    <span className="he-typed">
      {/* Screen readers get the whole list once, not a flicker of letters. */}
      <span className="sr-only">{words.join(', ')}</span>
      <span aria-hidden="true">
        {shown}
        <span className="he-typed__caret" />
      </span>
    </span>
  );
}

/* ── P3-B1: words that change in place ────────────────────────────────────── */

const ROTATE_MS = 2600;

/**
 * One word at a time, slid, faded, flipped or blurred in. An invisible copy
 * of the longest word holds the width, so the heading never reflows as the
 * words change. Reduced motion keeps the first word.
 */
export function RotatingWords({ words, effect }: { words: string[]; effect: 'slide' | 'fade' | 'flip' | 'blur' }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (words.length < 2) return;
    let timer = 0;
    const tick = () => {
      if (!motionReduced()) setIndex((i) => (i + 1) % words.length);
      timer = window.setTimeout(tick, ROTATE_MS);
    };
    timer = window.setTimeout(tick, ROTATE_MS);
    const reset = () => motionReduced() && setIndex(0);
    window.addEventListener(MOTION_EVENT, reset);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(MOTION_EVENT, reset);
    };
  }, [words]);

  const longest = words.reduce((a, w) => (w.length > a.length ? w : a), '');
  return (
    <span className={cn('he-rot', `is-${effect}`)}>
      <span className="sr-only">{words.join(', ')}</span>
      <span className="he-rot__stage" aria-hidden="true">
        <span className="he-rot__sizer">{longest}</span>
        <span key={index} className="he-rot__word">
          {words[index]}
        </span>
      </span>
    </span>
  );
}

/* ── EL3: message ─────────────────────────────────────────────────────────── */

const NOTICE_ICON: Record<string, React.ReactNode> = {
  info: <path d="M12 8h.01M11 12h1v5h1" />,
  success: <path d="M7.5 12.5l3 3 6-6.5" />,
  warning: <path d="M12 7.5v5.5M12 16.5h.01" />,
  danger: <path d="M9 9l6 6M15 9l-6 6" />,
};

const NOTICE_LABEL = { info: 'Note', success: 'Success', warning: 'Warning', danger: 'Important' } as const;

export function NoticeBlock(p: P<'notice'>) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className={cn('he-notice-sec', `is-${p.align}`)}>
      <div className="shell">
        <aside aria-label={NOTICE_LABEL[p.kind]} className={cn('he-notice', `is-${p.kind}`, `is-${p.size}`, `is-w-${p.width}`)}>
          {p.icon && (
            <svg className="he-notice__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9.5" />
              {NOTICE_ICON[p.kind]}
            </svg>
          )}
          <div className="he-notice__body">
            {p.title && <strong className="he-notice__title">{p.title}</strong>}
            <span>{p.text}</span>
            {p.link && (
              <>
                {' '}
                <Link href={p.link.href} className="he-notice__link">
                  {p.link.label}
                </Link>
              </>
            )}
          </div>
          {p.dismissible && (
            <button type="button" className="he-notice__close" aria-label="Dismiss this message" onClick={() => setHidden(true)}>
              <Icon.Close size={14} />
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ── EL4: progress ────────────────────────────────────────────────────────── */

/** Starts false only for a block below the fold in a browser that allows motion. */
function useFillOnView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [filled, setFilled] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || motionReduced() || el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    setFilled(false);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setFilled(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, filled };
}

const RING_C = 2 * Math.PI * 52;

export function ProgressBlock(p: P<'progress'>) {
  const { ref, filled } = useFillOnView<HTMLDivElement>();
  const v = (n: number) => (filled ? n : 0);

  return (
    <section className={cn('he-lsec he-prog', TONES[p.tone ?? 'base'])}>
      <div className="shell">
        <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} />
        <div ref={ref} className={cn('he-prog__list', `is-${p.kind}`, `is-${p.thickness}`, `is-label-${p.labelPosition}`)}>
          {p.items.map((item, i) =>
            p.kind === 'rings' ? (
              <div key={item.label + i} className="he-ring">
                <svg className="he-ring__svg" viewBox="0 0 120 120" role="img" aria-label={`${item.label}: ${item.value}%`}>
                  <circle className="he-ring__track" cx="60" cy="60" r="52" />
                  <circle
                    className="he-ring__fill"
                    cx="60"
                    cy="60"
                    r="52"
                    strokeDasharray={RING_C.toFixed(2)}
                    strokeDashoffset={(RING_C * (1 - v(item.value) / 100)).toFixed(2)}
                  />
                  <text x="60" y="60" className="he-ring__value" textAnchor="middle" dominantBaseline="central">
                    {item.value}%
                  </text>
                </svg>
                <div className="he-ring__text">
                  <span className="he-ring__label">{item.label}</span>
                  {item.note && <span className="he-ring__note">{item.note}</span>}
                </div>
              </div>
            ) : (
              <div key={item.label + i} className="he-bar">
                <div className="he-bar__head">
                  <span className="he-bar__label">{item.label}</span>
                  {!p.tooltip && <span className="he-bar__value">{item.value}%</span>}
                </div>
                <div
                  className="he-bar__track"
                  role="progressbar"
                  aria-label={item.label}
                  aria-valuenow={item.value}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span className="he-bar__fill" style={{ width: `${v(item.value)}%` }}>
                    {p.tooltip && <span className="he-bar__bubble">{item.value}%</span>}
                  </span>
                </div>
                {item.note && <span className="he-bar__note">{item.note}</span>}
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

/* ── EL5: countdown ───────────────────────────────────────────────────────── */

const UNIT_LABEL = { months: 'Months', days: 'Days', hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds' } as const;

export function CountdownBlock(p: P<'countdown'>) {
  const target = Date.parse(p.target);
  // Unknown on the server and in the first client render, so both print the
  // same dashes and hydration never disagrees about the seconds.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const done = now !== null && target - now <= 0;
  const parts = now === null ? null : splitDuration(target - now, p.units);
  const when = new Date(target).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });

  return (
    <section className={cn('he-lsec he-cd', TONES[p.tone ?? 'base'], `is-${p.align}`)}>
      <div className="shell">
        <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} align={p.align} />
        {done && p.expiredText ? (
          <p className="he-cd__done">{p.expiredText}</p>
        ) : (
          <div className={cn('he-cd__units', `is-${p.style}`, p.dividers && 'has-dividers')} role="timer" aria-label={`Counting down to ${when}`}>
            {p.units.map((unit, i) => (
              <div key={unit} className="he-cd__unit">
                {p.dividers && i > 0 && (
                  <span className="he-cd__sep" aria-hidden="true">
                    :
                  </span>
                )}
                <span className="he-cd__num">{parts ? String(parts[unit] ?? 0).padStart(2, '0') : '––'}</span>
                <span className="he-cd__label">{UNIT_LABEL[unit]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── EL7: pricing ─────────────────────────────────────────────────────────── */

export function PricingBlock(p: P<'pricing'>) {
  const [yearly, setYearly] = useState(false);
  const switching = p.billing === 'switch';
  const select = (i: number) => setYearly(i === 1);

  return (
    <section className={cn('he-lsec he-price', TONES[p.tone ?? 'base'])}>
      <div className="shell">
        <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} align="center" />
        {switching && (
          <div className="he-price__switch" role="radiogroup" aria-label="Billing period" onKeyDown={arrowKeys(2, yearly ? 1 : 0, select)}>
            {[p.monthlyLabel || 'Monthly', p.yearlyLabel || 'Yearly'].map((label, i) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={yearly === (i === 1)}
                tabIndex={yearly === (i === 1) ? 0 : -1}
                className={cn('he-price__opt', yearly === (i === 1) && 'is-active')}
                onClick={() => select(i)}
              >
                {label}
                {i === 1 && p.yearlyNote && <span className="he-price__save">{p.yearlyNote}</span>}
              </button>
            ))}
          </div>
        )}
        <div className={cn('he-price__plans', `is-${p.layout}`)} style={{ '--n': p.plans.length } as React.CSSProperties}>
          {p.plans.map((plan, i) => {
            const price = switching && yearly && plan.yearlyPrice ? plan.yearlyPrice : plan.price;
            const period = switching && yearly && plan.yearlyPeriod ? plan.yearlyPeriod : plan.period;
            const button = plan.button && (
              <Link href={plan.button.href} className={cn('he-cbtn is-medium he-price__btn', plan.featured ? 'is-primary' : 'is-outline')}>
                {plan.button.label}
              </Link>
            );
            return (
              <article key={plan.name + i} className={cn('he-plan', plan.featured && 'is-featured')}>
                <div className="he-plan__top">
                  <div>
                    <h3 className="he-plan__name">{plan.name}</h3>
                    {plan.tagline && <p className="he-plan__tagline">{plan.tagline}</p>}
                  </div>
                  {plan.badge && <span className="he-plan__badge">{plan.badge}</span>}
                </div>
                <p className="he-plan__price" aria-live={switching ? 'polite' : undefined}>
                  <span className="he-plan__amount">{price}</span>
                  {period && <span className="he-plan__period">{period}</span>}
                </p>
                {plan.description && <p className="he-plan__desc">{plan.description}</p>}
                {p.buttonPosition === 'top' && button}
                {plan.features.length > 0 && (
                  <ul className="he-plan__features">
                    {plan.features.map((f, k) => (
                      <li key={f.text + k} className={f.included ? undefined : 'is-excluded'}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                          {f.included ? <path d="M5 12.5l4.5 4.5L19 7" /> : <path d="M6 12h12" />}
                        </svg>
                        <span>
                          {f.text}
                          {!f.included && <span className="sr-only"> (not included)</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {p.buttonPosition === 'bottom' && button}
              </article>
            );
          })}
        </div>
        {p.footnote && <p className="he-price__foot">{p.footnote}</p>}
      </div>
    </section>
  );
}

/* ── EL8: switchable team profile ─────────────────────────────────────────── */

type Member = P<'team'>['members'][number];

export function TeamSplit({ members, hover }: { members: Member[]; hover: string }) {
  const [active, setActive] = useState(0);
  const m = members[active] ?? members[0]!;

  return (
    <div className="he-team__split">
      <div className="he-team__profile" aria-live="polite">
        <h3 className="he-team__name">{m.name}</h3>
        {m.role && <p className="he-team__role">{m.role}</p>}
        {m.bio && <p className="he-team__bio">{m.bio}</p>}
        {m.links.length > 0 && (
          <ul className="he-team__links">
            {m.links.map((l) => (
              <li key={l.network + l.href}>
                <a href={l.href} target="_blank" rel="noopener noreferrer" aria-label={SOCIAL_LABELS[l.network as SocialNetwork]}>
                  <SocialIcon network={l.network as SocialNetwork} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={cn('he-team__faces', `is-hover-${hover}`)}>
        {members.map((member, i) => (
          <button
            key={member.name + i}
            type="button"
            className={cn('he-team__face', i === active && 'is-active')}
            aria-pressed={i === active}
            aria-label={`Show ${member.name}`}
            onClick={() => setActive(i)}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
          >
            <MediaFill imageUrl={member.imageUrl} alt="" className="he-fill" />
          </button>
        ))}
      </div>
    </div>
  );
}
