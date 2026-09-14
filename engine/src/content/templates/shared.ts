import { demoImageUrl as img } from '@/content/demo/images';

/* Sample content shared by the page templates and ready sections — all
   invented: people, businesses, addresses and numbers. */

export { img };

const LOGOS = [
  ['Alder & Co', 'logo-alder'],
  ['Brightline', 'logo-brightline'],
  ['Corvid', 'logo-corvid'],
  ['Dunmore', 'logo-dunmore'],
  ['Everly', 'logo-everly'],
  ['Halcyon', 'logo-halcyon'],
  ['Kestrel', 'logo-kestrel'],
  ['Meridian', 'logo-meridian'],
] as const;

export const logos = (count: number) => LOGOS.slice(0, count).map(([name, file]) => ({ name, imageUrl: img(file) }));

export const openDays = (days: string[], open: string, close: string) => days.map((day) => ({ day, slots: [{ open, close }] }));
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];

/** Four people, reused across templates with different roles. */
export const person = (n: 1 | 2 | 3 | 4 | 5 | 6) => img(`person-${n}`);

export const ICONS = {
  shield: img('icon-shield'),
  bolt: img('icon-bolt'),
  leaf: img('icon-leaf'),
  chart: img('icon-chart'),
  globe: img('icon-globe'),
  clock: img('icon-clock'),
};

export const THREE_PLANS = [
  {
    name: 'Essential',
    tagline: 'To get going',
    price: '€19',
    period: '/ month',
    yearlyPrice: '€15',
    yearlyPeriod: '/ month, billed yearly',
    description: 'For one person with one project.',
    features: [
      { text: 'One project', included: true },
      { text: 'Email support', included: true },
      { text: 'Monthly report', included: true },
      { text: 'Team seats', included: false },
    ],
    button: { label: 'Choose Essential', href: '/contact' },
  },
  {
    name: 'Plus',
    tagline: 'Most people pick this',
    price: '€49',
    period: '/ month',
    yearlyPrice: '€39',
    yearlyPeriod: '/ month, billed yearly',
    badge: 'Popular',
    featured: true,
    description: 'For small teams with a few projects on the go.',
    features: [
      { text: 'Ten projects', included: true },
      { text: 'Priority support', included: true },
      { text: 'Weekly report', included: true },
      { text: 'Five team seats', included: true },
    ],
    button: { label: 'Choose Plus', href: '/contact' },
  },
  {
    name: 'Studio',
    tagline: 'For busy teams',
    price: '€119',
    period: '/ month',
    yearlyPrice: '€95',
    yearlyPeriod: '/ month, billed yearly',
    description: 'For agencies and larger teams.',
    features: [
      { text: 'Unlimited projects', included: true },
      { text: 'Phone support', included: true },
      { text: 'Live dashboard', included: true },
      { text: 'Unlimited seats', included: true },
    ],
    button: { label: 'Talk to us', href: '/contact' },
  },
];
