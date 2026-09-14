'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
   Toasts
   ───────────────────────────────────────────────────────────────────────────
   Stacked, auto-dismissing notices in the bottom-right corner. Mount
   <ToastProvider> once inside the admin shell; call useToast() anywhere below.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ToastTone = 'info' | 'success' | 'error';

type ToastRecord = { id: number; message: string; tone: ToastTone };

export type ToastApi = { toast: (message: string, tone?: ToastTone) => void };

const ToastContext = createContext<ToastApi | null>(null);

/** Used when a component that toasts is rendered outside the provider (tests,
 *  isolated previews). Silently dropping a notice beats throwing mid-render. */
const noopToast: ToastApi = { toast: () => {} };

const toneStyles: Record<ToastTone, { border: string; label: string; text: string }> = {
  info: { border: 'border-hairline', label: 'text-smoke', text: 'text-ash' },
  success: { border: 'border-emerald-500/60', label: 'text-emerald-400', text: 'text-bone' },
  error: { border: 'border-flare', label: 'text-flare-soft', text: 'text-bone' },
};

const toneLabels: Record<ToastTone, string> = {
  info: 'Note',
  success: 'Done',
  error: 'Problem',
};

export function ToastProvider({
  children,
  duration = 4500,
}: {
  children: React.ReactNode;
  duration?: number;
}) {
  const [items, setItems] = useState<ToastRecord[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = nextId.current++;
      setItems((current) => [...current, { id, message, tone }].slice(-4));
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
    },
    [dismiss, duration],
  );

  // Clear pending timers if the provider unmounts mid-flight.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-5 right-5 z-[120] flex w-[min(360px,calc(100vw-40px))] flex-col gap-2"
      >
        {items.map((item) => {
          const styles = toneStyles[item.tone];
          return (
            <div
              key={item.id}
              role={item.tone === 'error' ? 'alert' : 'status'}
              className={cn(
                'pointer-events-auto flex items-start gap-3 border-2 bg-surface px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)]',
                styles.border,
              )}
            >
              <div className="min-w-0 flex-1">
                <p className={cn('m-0 font-mono text-[10px] uppercase tracking-[0.12em]', styles.label)}>
                  {toneLabels[item.tone]}
                </p>
                <p className={cn('m-0 mt-1 break-words text-[13px] leading-relaxed', styles.text)}>{item.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="-mr-1 -mt-1 px-1 font-mono text-[13px] leading-none text-smoke transition-colors hover:text-bone"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext) ?? noopToast;
}
