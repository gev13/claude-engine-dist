import type { InfoIconName } from '@/lib/infoIcons';

/** 3.29 — a detail's line icon, drawn in the current colour (see lib/infoIcons.ts). */
const PATHS: Record<InfoIconName, React.ReactNode> = {
  pin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  phone: <path d="M6.6 3.5h2.6l1.4 4-2 1.4a11 11 0 0 0 6.5 6.5l1.4-2 4 1.4v2.6a1.6 1.6 0 0 1-1.7 1.6A16 16 0 0 1 5 5.2 1.6 1.6 0 0 1 6.6 3.5z" />,
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.5 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.5-3.5-8.5s1-5.9 3.5-8.5z" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3.5" y="7" width="17" height="12" rx="1.5" />
      <path d="M9 7V5.5h6V7M3.5 12h17" />
    </>
  ),
  document: (
    <>
      <path d="M6 3.5h8.5l3.5 3.5v13.5H6z" />
      <path d="M9 10h6M9 13.5h6M9 17h4" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="9" r="3" />
      <circle cx="16.5" cy="9.5" r="2.4" />
      <path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6M14.5 15c2.6-.5 4.8.9 5.5 3.6" />
    </>
  ),
};

export function InfoIcon({ name, size = 20, className }: { name: InfoIconName; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
