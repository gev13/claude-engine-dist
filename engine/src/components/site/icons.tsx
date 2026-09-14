import type { SocialNetwork } from '@/lib/navigation';
import type { ShareNetwork } from '@/lib/share';
import { cn } from '@/lib/utils';

/* Line icons for the site chrome and the pattern blocks. One stroke weight,
   one grid (24), `currentColor` throughout so they follow the theme. Every one
   is decorative: the control that holds it carries the accessible name. */

type P = { className?: string; size?: number };

function Svg({ className, size = 20, children, fill = false }: P & { children: React.ReactNode; fill?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke={fill ? 'none' : 'currentColor'}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
    >
      {children}
    </svg>
  );
}

const CHEVRON = { down: 'M6 9l6 6 6-6', up: 'M6 15l6-6 6 6', left: 'M15 6l-6 6 6 6', right: 'M9 6l6 6-6 6' } as const;

export const Icon = {
  Chevron: ({ dir = 'down', ...p }: P & { dir?: keyof typeof CHEVRON }) => (
    <Svg {...p}>
      <path d={CHEVRON[dir]} />
    </Svg>
  ),
  Close: (p: P) => (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  ),
  Menu: (p: P) => (
    <Svg {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  ),
  Search: (p: P) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </Svg>
  ),
  ArrowRight: (p: P) => (
    <Svg {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  ),
  ArrowUp: (p: P) => (
    <Svg {...p}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </Svg>
  ),
  Pause: (p: P) => (
    <Svg {...p}>
      <path d="M9 6v12M15 6v12" />
    </Svg>
  ),
  Play: (p: P) => (
    <Svg {...p}>
      <path d="M8 5.5v13l10.5-6.5z" />
    </Svg>
  ),
  Sun: (p: P) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
    </Svg>
  ),
  Moon: (p: P) => (
    <Svg {...p}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </Svg>
  ),
  Share: (p: P) => (
    <Svg {...p}>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" />
    </Svg>
  ),
  Mail: (p: P) => (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
    </Svg>
  ),
  Globe: (p: P) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </Svg>
  ),
  Plus: (p: P) => (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  ),
  Home: (p: P) => (
    <Svg {...p}>
      <path d="M4 11l8-7 8 7v8.5a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19.5z" />
    </Svg>
  ),
  Copy: (p: P) => (
    <Svg {...p}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </Svg>
  ),
};

/* Simplified marks for the footer's social links — recognisable shapes, not
   the networks' trademarked artwork. */
const SOCIAL: Record<SocialNetwork, React.ReactNode> = {
  x: <path d="M5 4l14 16M19 4L5 20" />,
  linkedin: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 10.5V17M8 7.2v.1M12 17v-3.8a2.3 2.3 0 0 1 4.6 0V17M12 10.5V17" />
    </>
  ),
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="3.8" />
      <path d="M17.2 6.8v.1" />
    </>
  ),
  facebook: <path d="M14.5 3.5h-2a4 4 0 0 0-4 4v3h-2.5v3.5h2.5v6.5h3.5V14h2.8l.7-3.5h-3.5V8a1 1 0 0 1 1-1h2.5z" />,
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="M10.5 9.3l4.3 2.7-4.3 2.7z" />
    </>
  ),
  github: (
    <path d="M9 19c-4 1.2-4-1.8-5.6-2.2M14.6 21v-3.1c0-.9.1-1.4-.4-2 2.7-.3 5.3-1.3 5.3-5.8a4.5 4.5 0 0 0-1.2-3.1 4.2 4.2 0 0 0-.1-3.1s-1-.3-3.4 1.3a11.7 11.7 0 0 0-6 0C6.4 3.6 5.4 3.9 5.4 3.9a4.2 4.2 0 0 0-.1 3.1 4.5 4.5 0 0 0-1.2 3.1c0 4.5 2.6 5.5 5.3 5.8-.5.5-.5 1.1-.4 2V21" />
  ),
  tiktok: <path d="M15 3.5c.5 2.4 2 3.9 4.5 4.1v3.3c-1.7 0-3.2-.5-4.5-1.4v5.8a5.8 5.8 0 1 1-5.8-5.8v3.4a2.4 2.4 0 1 0 2.4 2.4V3.5z" />,
};

export function SocialIcon({ network, className, size = 18 }: P & { network: SocialNetwork }) {
  return (
    <Svg className={className} size={size}>
      {SOCIAL[network]}
    </Svg>
  );
}

/* Share marks beyond the social set, drawn the same way. */
const SHARE: Record<Exclude<ShareNetwork, 'x' | 'linkedin' | 'facebook'>, React.ReactNode> = {
  whatsapp: (
    <>
      <path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.8z" />
      <path d="M9.2 8.8c.1 2.8 3.1 5.8 6 6l1-1.4-2.1-1-1 .8a4.6 4.6 0 0 1-2.3-2.3l.8-1-1-2.1z" />
    </>
  ),
  reddit: (
    <>
      <ellipse cx="12" cy="14.5" rx="7.5" ry="5" />
      <circle cx="17.5" cy="4.8" r="1.6" />
      <path d="M12 9.5l1.3-5.3 4.2 1M9.4 16.6c1.6.9 3.6.9 5.2 0M9.4 13.2v.1M14.6 13.2v.1" />
    </>
  ),
  telegram: <path d="M21 4L3 11.2l6 2.1M21 4l-3 16-9-6.7M21 4L9 13.3V19l3-3.5" />,
  email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
    </>
  ),
  copy: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  native: (
    <>
      <path d="M12 3v12M7.5 7.5L12 3l4.5 4.5" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </>
  ),
};

export function ShareIcon({ network, className, size = 18 }: P & { network: ShareNetwork }) {
  return (
    <Svg className={className} size={size}>
      {network === 'x' || network === 'linkedin' || network === 'facebook' ? SOCIAL[network] : SHARE[network]}
    </Svg>
  );
}
