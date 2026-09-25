'use client';

import { createContext, forwardRef, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useMessages } from '@/components/site/Messages';
import { CAPTCHA_SCRIPT, captchaApplies, type CaptchaSurface, type PublicCaptcha } from '@/lib/captcha';

/* ═══════════════════════════════════════════════════════════════════════════
   The CAPTCHA widget (T12, 2.16)
   ───────────────────────────────────────────────────────────────────────────
   Nothing loads until the form is about to be seen: the provider's script is
   fetched when the widget scrolls near the viewport, so a page with a form at
   the bottom sends nothing to a third party for a visitor who never gets
   there. The form asks for a token when it is sent — v2, Turnstile and
   hCaptcha hand back what the visitor earned; v3 is asked then.
   ═══════════════════════════════════════════════════════════════════════════ */

const CaptchaContext = createContext<PublicCaptcha>(null);

export function CaptchaProvider({ value, children }: { value: PublicCaptcha; children: React.ReactNode }) {
  return <CaptchaContext.Provider value={value}>{children}</CaptchaContext.Provider>;
}

/** The site's CAPTCHA if it applies to this kind of form, with the form's own override. */
export function useCaptchaFor(surface: CaptchaSurface, override: 'inherit' | 'on' | 'off' = 'inherit'): PublicCaptcha {
  const captcha = useContext(CaptchaContext);
  return captchaApplies(captcha, surface, override) ? captcha : null;
}

export type CaptchaHandle = {
  /** A token to send, or null when the visitor has not completed the check. */
  token: () => Promise<string | null>;
  reset: () => void;
};

type Api = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string | number;
  reset?: (id?: string | number) => void;
  execute?: (key: string, opts: { action: string }) => Promise<string>;
  ready?: (fn: () => void) => void;
};

const globalFor = (provider: NonNullable<PublicCaptcha>['provider']): Api | undefined => {
  const w = window as unknown as Record<string, Api | undefined>;
  return provider === 'turnstile' ? w.turnstile : provider === 'hcaptcha' ? w.hcaptcha : w.grecaptcha;
};

const loading = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  if (!loading.has(src)) {
    loading.set(
      src,
      new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('The check could not load.'));
        document.head.appendChild(s);
      }),
    );
  }
  return loading.get(src)!;
}

/** Wait for a provider's global, which some define a moment after their script's load event. */
async function whenReady(provider: NonNullable<PublicCaptcha>['provider']): Promise<Api> {
  for (let i = 0; i < 100; i++) {
    const api = globalFor(provider);
    if (api?.render || api?.execute) {
      /* reCAPTCHA defines its global before it is usable and says when with
         ready(). Turnstile's ready() throws for a script loaded async, and
         its render is usable as soon as the global exists. */
      if (provider.startsWith('recaptcha') && api.ready) await new Promise<void>((resolve) => api.ready!(resolve));
      return api;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('The check could not start.');
}

export const CaptchaField = forwardRef<CaptchaHandle, { captcha: NonNullable<PublicCaptcha> }>(function CaptchaField({ captcha }, ref) {
  const t = useMessages();
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | number | null>(null);
  const earned = useRef<string | null>(null);
  const [state, setState] = useState<'waiting' | 'loading' | 'ready' | 'failed'>('waiting');
  const invisible = captcha.provider === 'recaptchaV3';

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let cancelled = false;
    const start = async () => {
      setState('loading');
      try {
        await loadScript(CAPTCHA_SCRIPT[captcha.provider](captcha.siteKey));
        const api = await whenReady(captcha.provider);
        if (cancelled) return;
        if (!invisible && widget.current === null) {
          widget.current = api.render(el, {
            sitekey: captcha.siteKey,
            callback: (token: string) => {
              earned.current = token;
            },
            'expired-callback': () => {
              earned.current = null;
            },
            'error-callback': () => {
              earned.current = null;
            },
          });
        }
        setState('ready');
      } catch {
        if (!cancelled) setState('failed');
      }
    };
    // Only when the form is about to be seen.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          void start();
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [captcha.provider, captcha.siteKey, invisible]);

  useImperativeHandle(
    ref,
    () => ({
      token: async () => {
        if (invisible) {
          try {
            await loadScript(CAPTCHA_SCRIPT[captcha.provider](captcha.siteKey));
            const api = await whenReady(captcha.provider);
            return (await api.execute?.(captcha.siteKey, { action: 'submit' })) ?? null;
          } catch {
            return null;
          }
        }
        return earned.current;
      },
      reset: () => {
        earned.current = null;
        const api = globalFor(captcha.provider);
        if (widget.current !== null) api?.reset?.(widget.current);
      },
    }),
    [captcha.provider, captcha.siteKey, invisible],
  );

  return (
    <div className="he-captcha" role="group" aria-label={t('captcha.label')}>
      <div ref={box} className={invisible ? 'he-captcha__invisible' : 'he-captcha__box'} />
      {state === 'loading' && !invisible && <p className="he-captcha__note">{t('captcha.loading')}</p>}
      {state === 'failed' && <p className="he-captcha__note">{t('captcha.failed')}</p>}
      {invisible && <p className="he-captcha__note">{t('captcha.invisible')}</p>}
    </div>
  );
});

/**
 * Everything a form needs, in one call: the field to render (null when this
 * kind of form is not protected), the token to send — `false` while the
 * visitor still has a check to complete — and a reset for after a refusal,
 * since a token is spent once.
 */
export function useChallenge(surface: CaptchaSurface, override: 'inherit' | 'on' | 'off' = 'inherit') {
  const captcha = useCaptchaFor(surface, override);
  const handle = useRef<CaptchaHandle>(null);
  return {
    field: captcha ? <CaptchaField ref={handle} captcha={captcha} /> : null,
    token: async (): Promise<string | null | false> => {
      if (!captcha) return null;
      const token = (await handle.current?.token()) ?? null;
      // v3 has nothing to tick; the others need the visitor to have passed it.
      return token || captcha.provider === 'recaptchaV3' ? token : false;
    },
    reset: () => handle.current?.reset(),
  };
}
