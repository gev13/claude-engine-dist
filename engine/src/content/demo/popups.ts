import type { Popup } from '@/lib/popups';

/* ═══════════════════════════════════════════════════════════════════════════
   Demo popups (P3-D)
   ───────────────────────────────────────────────────────────────────────────
   Written by `npm run db:seed:demo` beside the menus. The ones that open by
   themselves only do so on /library/effects, so the demo site is never
   interrupted anywhere else; the rest open from the buttons on that page.
   ═══════════════════════════════════════════════════════════════════════════ */

const ON_EFFECTS = { pages: 'only' as const, paths: ['/library/effects'] };

const defaults = {
  enabled: true,
  size: 'medium' as const,
  delay: 5,
  scroll: 50,
  frequency: 'session' as const,
  days: 7,
  pages: 'all' as const,
  paths: [] as string[],
  devices: 'all' as const,
  overlay: true,
};

export const demoPopups: Popup[] = [
  {
    ...defaults,
    id: 'demo-newsletter',
    name: 'Newsletter sign-up',
    slug: 'newsletter',
    position: 'center',
    trigger: 'click',
    blocks: [
      {
        id: 'demo-pop-nl',
        type: 'newsletter',
        props: { layout: 'centered', title: 'One email a month', body: 'What we built, what we learned, and nothing else.', buttonLabel: 'Subscribe' },
      },
    ],
  },
  {
    ...defaults,
    ...ON_EFFECTS,
    id: 'demo-corner',
    name: 'Studio tour',
    slug: 'studio-tour',
    position: 'bottom-right',
    size: 'small',
    trigger: 'delay',
    delay: 8,
    frequency: 'days',
    blocks: [
      { id: 'demo-pop-tour-h', type: 'heading', props: { size: 'medium', title: 'Come and see the studio', subtitle: 'Open days every first Friday, 16:00 – 19:00.' } },
      { id: 'demo-pop-tour-b', type: 'buttons', props: { size: 'small', items: [{ label: 'Book a visit', href: '/contact', style: 'primary', icon: 'arrow' }] } },
    ],
  },
  {
    ...defaults,
    ...ON_EFFECTS,
    id: 'demo-bar',
    name: 'Announcement bar',
    slug: 'announcement',
    position: 'bottom-bar',
    trigger: 'scroll',
    scroll: 40,
    blocks: [
      { id: 'demo-pop-bar', type: 'cta', props: { variant: 'inline', title: 'New: a four-week discovery sprint, fixed price.', links: [{ label: 'See how it works', href: '/services' }] } },
    ],
  },
  {
    ...defaults,
    id: 'demo-panel',
    name: 'Opening hours panel',
    slug: 'hours',
    position: 'side-right',
    trigger: 'click',
    blocks: [
      {
        id: 'demo-pop-hours',
        type: 'businessHours',
        props: {
          title: 'When we are in',
          timeZone: 'Europe/London',
          week: ['mon', 'tue', 'wed', 'thu', 'fri'].map((day) => ({ day, slots: [{ open: '09:00', close: '17:30' }] })),
          link: { label: 'Get in touch', href: '/contact' },
        },
      },
    ],
  },
  {
    ...defaults,
    id: 'demo-full',
    name: 'Full-screen offer',
    slug: 'full',
    position: 'fullscreen',
    trigger: 'click',
    blocks: [
      { id: 'demo-pop-full-h', type: 'heading', props: { align: 'center', size: 'display', title: 'Start small', highlight: 'small', highlightStyle: 'circle', subtitle: 'A four-week sprint, a working prototype, and a plan with dates.' } },
      { id: 'demo-pop-full-b', type: 'buttons', props: { align: 'center', size: 'large', items: [{ label: 'Plan a sprint', href: '/contact', style: 'primary', icon: 'arrow' }] } },
    ],
  },
];
