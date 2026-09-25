import type { PageDefinition } from '@/content/types';
import { DEMO_SAVED_BLOCK_ID } from './savedBlocks';
import type { AnyBlock } from '@/lib/blocks';
import { demoAnimationUrl as anim } from './animations';
import { demoImageUrl as img } from './images';
import { demoTemplatePages } from './templatePages';

/* ═══════════════════════════════════════════════════════════════════════════
   Demo pages
   ───────────────────────────────────────────────────────────────────────────
   Written by `npm run db:seed:demo`, never by a plain install: a new site
   still starts blank. Two sets:

     Starter pages   Home, About, Services (+3), Contact, Privacy — a small
                     working site in realistic copy, ready to be rewritten.
     Block library   /library and six pages on the `library` template, which
                     print every block's name above it. Between them they use
                     every block type and every variant, so a site owner can
                     see each one with real content before choosing.
   ═══════════════════════════════════════════════════════════════════════════ */

type Raw = { type: string; props: Record<string, unknown>; style?: Record<string, unknown> };

const b = (type: string, props: Record<string, unknown>, style?: Record<string, unknown>): Raw => ({ type, props, style });

/** Gives each block a stable id from the page slug. */
function blocks(prefix: string, list: Raw[]): AnyBlock[] {
  return list.map(
    (raw, i) =>
      ({ id: `${prefix}-${i + 1}`, type: raw.type, props: raw.props, ...(raw.style ? { style: raw.style } : {}) }) as unknown as AnyBlock,
  );
}

const link = (label: string, href: string, variant?: 'primary' | 'outline' | 'ghost') => ({ label, href, ...(variant ? { variant } : {}) });

const LIBRARY_SEO = { robots: 'noindex, follow' };

/* ── Shared sample content ────────────────────────────────────────────────── */

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

const logoItems = (count: number) => LOGOS.slice(0, count).map(([name, file]) => ({ name, imageUrl: img(file) }));

const FEATURES = [
  ['Senior people only', 'The people you meet in the first call are the people who do the work.', 'icon-shield'],
  ['Weekly releases', 'Something you can click every week, so progress is never a slide deck.', 'icon-bolt'],
  ['Built to last', 'Plain, well-documented code your own team can take over.', 'icon-leaf'],
  ['Measured outcomes', 'We agree the numbers that matter before we start, and report on them.', 'icon-chart'],
  ['Remote-friendly', 'Teams across four time zones, with overlap hours you can rely on.', 'icon-globe'],
  ['On time', 'Fixed dates, flexible scope: we tell you early what will and will not fit.', 'icon-clock'],
] as const;

const featureCards = (count = 6) =>
  FEATURES.slice(0, count).map(([title, body, icon]) => ({ title, body, imageUrl: img(icon), href: '/services', buttonLabel: 'Learn more' }));

const WORK = [
  ['Retail', 'A calmer checkout for a homeware brand', 'Checkout abandonment down by a third in eight weeks.', 'interior-lounge'],
  ['Property', 'A leasing portal for office towers', 'Tenants book viewings in two taps instead of six emails.', 'arch-tower'],
  ['Travel', 'Trip planning for small groups', 'One shared plan instead of forty messages.', 'scene-ocean'],
  ['Hardware', 'Companion app for a home speaker', 'Set-up time down from twelve minutes to three.', 'product-speaker'],
  ['Health', 'A clinic dashboard nurses actually like', 'Two hours a week back for every nurse on the ward.', 'ui-analytics'],
  ['Outdoors', 'Route planning for hikers', 'Offline maps that work where the signal does not.', 'scene-forest'],
] as const;

const workSlides = (count = 6) =>
  WORK.slice(0, count).map(([eyebrow, title, body, image]) => ({ eyebrow, title, body, imageUrl: img(image), alt: title, href: '/services/design', buttonLabel: 'Read the case study' }));

const FAQS = [
  ['How long does a typical project take?', 'Most first releases take eight to twelve weeks. We agree a date on day one and plan the scope around it, not the other way round.'],
  ['Do you work with in-house teams?', 'Often. We can lead the work, join your team, or hand over gradually so your people own the product from launch.'],
  ['What does it cost?', 'Projects start from a four-week discovery. After that we work in fixed monthly blocks, so the budget never surprises anyone.'],
  ['Who owns the code and designs?', 'You do, from the first commit. Everything lives in your accounts, not ours.'],
  ['What happens after launch?', 'We stay for a support period by default, then either hand over completely or stay on for ongoing improvements.'],
] as const;

const faqItems = (count = 5, withImages = false) =>
  FAQS.slice(0, count).map(([question, answer], i) => ({
    question,
    answer,
    ...(withImages ? { imageUrl: img(['interior-studio', 'ui-dashboard', 'arch-facade', 'interior-workshop', 'scene-dawn'][i]!) } : {}),
  }));

const PEOPLE = [
  ['Maya Lindqvist', 'Head of Product, Brightline', 'person-2'],
  ['Tom Okafor', 'Founder, Kestrel', 'person-4'],
  ['Priya Raman', 'Operations Director, Halcyon', 'person-3'],
  ['Sam Whitfield', 'CTO, Dunmore', 'person-1'],
  ['Elena Costa', 'Design Lead, Everly', 'person-5'],
] as const;

const QUOTES = [
  'They shipped in ten weeks what we had been planning for a year, and our team understood every line of it.',
  'The first partner that told us what not to build. It saved us a quarter.',
  'Calm, clear and on time. Our board still asks who built the app.',
  'We brought them a mess and got back a product our customers thank us for.',
  'Every Friday we had something new to try. By launch it felt like ours.',
] as const;

/* ── Starter pages ────────────────────────────────────────────────────────── */

const home: PageDefinition = {
  path: '/',
  slug: 'home',
  title: 'Home',
  excerpt: 'A design and engineering studio building digital products people keep using — from the first sketch to the thousandth customer.',
  template: 'default',
  seo: {},
  blocks: blocks('home', [
    b('hero', {
      variant: 'mediaBottomLeft',
      eyebrow: 'Design & engineering studio',
      title: 'We build products people keep for years',
      lede: 'Strategy, design and engineering under one roof — from the first sketch to the thousandth customer.',
      links: [link('Start a project', '/contact'), link('See our services', '/services', 'outline')],
      imageUrl: img('scene-dusk'),
      alt: 'Mountains at dusk',
      announcement: { label: 'New: a field guide to small product teams', href: '/blog/field-guide-to-small-product-teams' },
      height: 'tall',
      overlay: 'medium',
    }),
    b('logoWall', { eyebrow: 'Trusted by', title: 'Teams we have built with', titleAs: 'h2', columns: 6, logos: logoItems(6) }),
    b('splitMedia', {
      eyebrow: 'How we work',
      title: 'Small teams, senior people, short loops',
      body: 'Every project gets a handful of experienced people who design, build and test together. No hand-offs, no account managers, no surprises.\n\nYou see working software every week, and you can change direction any Friday.',
      links: [link('About the studio', '/about')],
      imageUrl: img('interior-studio'),
      alt: 'A bright studio',
      shape: 'organic',
    }),
    b('cardGrid', { variant: 'icons', eyebrow: 'What you get', title: 'Everything a product needs to launch well', columns: 3, cards: featureCards() }),
    b('stats', {
      variant: 'figures',
      title: 'Twelve years in numbers',
      intro: 'Counted, not estimated.',
      imageUrl: img('ui-analytics'),
      alt: 'A reporting dashboard',
      items: [
        { value: '140', unit: '+', label: 'Products launched' },
        { value: '12', unit: 'yrs', label: 'In business' },
        { value: '96', unit: '%', label: 'Clients who come back' },
        { value: '4.9', unit: '/5', label: 'Average review' },
      ],
    }),
    b('carousel', { mode: 'cards', eyebrow: 'Selected work', title: 'Recent projects', link: { label: 'All services', href: '/services' }, slides: workSlides(), indicator: 'pill', arrows: 'corner' }),
    b('quote', {
      eyebrow: 'Brightline',
      quote: QUOTES[0],
      name: PEOPLE[0][0],
      role: PEOPLE[0][1],
      avatarUrl: img(PEOPLE[0][2]),
      imageUrl: img('interior-lounge'),
      alt: 'The Brightline team at work',
      links: [link('Read the story', '/blog/what-we-learned-from-140-launches')],
    }),
    b('faq', { eyebrow: 'FAQ', title: 'Questions we hear a lot', items: faqItems(4) }),
    b('cta', { variant: 'big', eyebrow: 'Have something in mind?', title: 'Let’s build the next one together', links: [link('Start a project', '/contact')] }),
  ]),
};

const about: PageDefinition = {
  path: '/about',
  slug: 'about',
  title: 'About',
  navLabel: 'About',
  excerpt: 'Who we are, how we work and what we believe: a small studio of senior designers and engineers.',
  seo: {},
  blocks: blocks('about', [
    b('hero', {
      variant: 'statementFrame',
      eyebrow: 'About us',
      title: 'A studio built around making, not meetings',
      lede: 'Twenty-two designers and engineers who would rather show you something working than talk about it.',
      links: [link('Work with us', '/contact')],
      imageUrl: img('interior-workshop'),
      alt: 'Our workshop',
    }),
    b('heading', {
      tone: 'raised',
      size: 'lede',
      layout: 'split',
      titleAs: 'p',
      eyebrow: 'Why we started',
      title: 'We began in a spare room with one client and one rule: never promise what we cannot build.',
      subtitle: 'Twelve years on, the room is bigger and the rule has not changed. It is still the first thing new people hear.',
    }),
    b('collage', {
      eyebrow: 'Our story',
      title: 'Twelve years, one habit',
      body: 'Every Friday since the first week, the whole studio has shown what it built. Unfinished, rough, sometimes broken — but real.\n\nIt keeps us honest, and it keeps our clients close to the work.',
      link: { label: 'See how a project runs', href: '/services' },
      largeUrl: img('arch-facade'),
      largeAlt: 'Our building',
      smallUrl: img('interior-studio'),
      smallAlt: 'Inside the studio',
    }),
    b('numberedList', {
      eyebrow: 'Principles',
      title: 'What we believe',
      items: [
        { title: 'Working software is the only progress', body: 'Documents describe progress; a thing you can click is progress.' },
        { title: 'Small teams decide faster', body: 'Fewer people means fewer hand-offs, and more of the product in each head.' },
        { title: 'Say no early', body: 'The kindest thing we can do for a budget is tell you what not to build.' },
        { title: 'Leave it better', body: 'Every product we hand over comes with code and notes your team can own.' },
      ],
    }),
    b('stats', {
      eyebrow: 'The studio today',
      items: [
        { value: '22', label: 'Designers and engineers' },
        { value: '4', label: 'Time zones' },
        { value: '140', unit: '+', label: 'Products launched' },
        { value: '9', unit: 'yrs', label: 'Average client relationship' },
      ],
    }),
    b('cardGrid', {
      variant: 'imageCards',
      eyebrow: 'The team',
      title: 'Some of the people you would work with',
      columns: 4,
      cards: [
        { title: 'Sam Whitfield', body: 'Engineering lead', imageUrl: img('person-1'), alt: 'Portrait placeholder' },
        { title: 'Maya Lindqvist', body: 'Product strategy', imageUrl: img('person-2'), alt: 'Portrait placeholder' },
        { title: 'Priya Raman', body: 'Design director', imageUrl: img('person-3'), alt: 'Portrait placeholder' },
        { title: 'Tom Okafor', body: 'Mobile engineering', imageUrl: img('person-4'), alt: 'Portrait placeholder' },
      ],
    }),
    b('cta', { variant: 'card', eyebrow: 'Careers', title: 'Want to work with us?', body: 'We hire a few senior people each year. Tell us what you would like to build.', links: [link('Get in touch', '/contact', 'outline')] }),
  ]),
};

const services: PageDefinition = {
  path: '/services',
  slug: 'services',
  title: 'Services',
  navLabel: 'Services',
  excerpt: 'Strategy, design and engineering for digital products — separately or as one team.',
  seo: {},
  blocks: blocks('services', [
    b('hero', {
      kicker: 'Services',
      eyebrow: 'What we do',
      title: 'Everything it takes to ship a product',
      lede: 'Hire us for one part of the work, or for all of it.',
      body: 'Most clients start with a four-week discovery and stay because the work keeps paying for itself.',
      links: [link('Start a project', '/contact'), link('How projects run', '#how', 'outline')],
      figure: 'converge',
      figureLabels: ['Your goals', 'Our team', 'One product'],
    }),
    b('servicesIndex', { eyebrow: 'Services', title: 'Three ways we can help', intro: 'Each one works on its own; together they are one team.', tier: 'all' }),
    b(
      'tabs',
      {
        eyebrow: 'Process',
        title: 'How a project runs',
        tabs: [
          { label: 'Discover', title: 'Four weeks to a plan', body: 'Interviews, research and a working prototype. You finish with a plan, a budget and something to show your board.', imageUrl: img('interior-studio'), alt: 'Workshop session' },
          { label: 'Build', title: 'Weekly releases', body: 'Small, senior teams ship something you can use every week. You set priorities every Friday.', imageUrl: img('ui-dashboard'), alt: 'A dashboard' },
          { label: 'Launch', title: 'The first week matters most', body: 'We watch real people use it, fix what matters and hand over with documentation your team can follow.', imageUrl: img('scene-dawn'), alt: 'A sunrise' },
        ],
      },
      { anchorId: 'how' },
    ),
    b('faq', { variant: 'media', eyebrow: 'FAQ', title: 'Common questions', items: faqItems(3, true) }),
    b('cta', { eyebrow: 'Next step', title: 'Tell us what you are building', body: 'A short call is usually enough to know whether we are the right fit.', links: [link('Book a call', '/contact')] }),
  ]),
};

function servicePage(slug: string, title: string, navLabel: string, summary: string, image: string, next: [string, string], sortOrder: number) {
  void sortOrder;
  return {
    path: `/services/${slug}`,
    slug,
    title,
    navLabel,
    summary,
    excerpt: `${summary} Part of the studio's services: strategy, design and engineering for digital products.`,
    template: 'service',
    priorityTier: 'primary',
    seo: {},
    blocks: blocks(`svc-${slug}`, [
      b('hero', {
        variant: 'split',
        eyebrow: 'Service',
        title,
        lede: summary,
        links: [link('Talk to us', '/contact'), link('All services', '/services', 'outline')],
        imageUrl: img(image),
        alt: title,
      }),
      b('checkLists', {
        eyebrow: 'Scope',
        title: 'What is included',
        lists: [
          { title: 'You get', items: ['A senior team from day one', 'Weekly demos you can click', 'A written plan and budget', 'Everything in your own accounts'] },
          { title: 'We need from you', items: ['One decision-maker', 'An hour every Friday', 'Access to real users', 'Honest feedback, early'] },
        ],
      }),
      b('splitPoints', {
        eyebrow: 'Approach',
        title: 'How it works',
        intro: 'Three stages, each ending in something you can use.',
        points: [
          { title: 'Understand', body: 'We talk to your customers and your team, and write down the one decision the product must make easier.' },
          { title: 'Make', body: 'Small, frequent releases, each one tested with real people before the next begins.' },
          { title: 'Hand over', body: 'Documentation, training and a support period, so your team owns what we built.' },
        ],
      }),
      b('faq', { eyebrow: 'FAQ', title: `Questions about ${navLabel.toLowerCase()}`, items: faqItems(3) }),
      b('pager', { label: 'Next service', title: next[0], href: next[1] }),
    ]),
  } satisfies PageDefinition & { summary: string };
}

const serviceStrategy = servicePage('strategy', 'Product strategy', 'Strategy', 'Research, positioning and a plan your team can follow.', 'scene-dawn', ['Design', '/services/design'], 1);
const serviceDesign = servicePage('design', 'Product design', 'Design', 'Interfaces, identity and design systems that scale with the product.', 'interior-studio', ['Engineering', '/services/engineering'], 2);
const serviceEngineering = servicePage('engineering', 'Product engineering', 'Engineering', 'Web and mobile products, built with plain, well-documented code.', 'ui-dashboard', ['Strategy', '/services/strategy'], 3);

const contact: PageDefinition = {
  path: '/contact',
  slug: 'contact',
  title: 'Contact',
  navLabel: 'Contact',
  excerpt: 'Tell us about your project. We reply to every enquiry within one working day.',
  template: 'contact',
  seo: {},
  blocks: blocks('contact', [
    b('contactForm', {
      layout: 'split',
      eyebrow: 'Contact',
      title: 'Tell us about your project',
      titleAs: 'h1',
      intro: 'A few lines is plenty. We reply within one working day.',
      body: 'Prefer to talk? Book a call and we will walk you through how a first project could look, with no obligation.',
      imageUrl: img('interior-lounge'),
      alt: 'The studio lounge',
    }),
    b('infoPanel', {
      title: 'Other ways to reach us',
      items: [
        { label: 'Email', value: 'hello@example.com' },
        { label: 'Phone', value: '+44 20 0000 0000' },
        { label: 'Studio', value: '1 Example Street, London EC1A 1AA' },
        { label: 'Hours', value: 'Monday to Friday, 9:00–18:00' },
      ],
    }),
  ]),
};

const privacy: PageDefinition = {
  path: '/privacy',
  slug: 'privacy',
  title: 'Privacy policy',
  navLabel: 'Privacy',
  excerpt: 'How this site collects, uses and protects personal information.',
  template: 'legal',
  seo: {},
  blocks: blocks('privacy', [
    b('prose', {
      title: 'Privacy policy',
      titleAs: 'h1',
      html: `<p><strong>This is a template.</strong> Replace it with your own policy, checked by someone qualified, before the site goes live.</p>
<h2>What we collect</h2>
<p>When you use the contact form or sign up to the newsletter we store the details you give us: your name, email address and message. We also keep standard server logs for security.</p>
<h2>How we use it</h2>
<p>Only to reply to you, to send the newsletter you asked for, and to keep the site secure. We never sell personal information.</p>
<h2>How long we keep it</h2>
<p>Enquiries are kept for up to two years. Newsletter sign-ups are kept until you ask us to remove them.</p>
<h2>Your rights</h2>
<p>You can ask to see, correct or delete the information we hold about you at any time by writing to hello@example.com.</p>`,
    }),
  ]),
};

/* ── Block library ────────────────────────────────────────────────────────── */

const libraryIntro = (title: string, text: string[]) =>
  b('prose', { eyebrow: 'Block library', title, titleAs: 'h1', paragraphs: text });

const HOW_TO =
  'Every section on this page is a block. The strip above it gives the block’s name as it appears in the page editor (Pages → edit a page → Add block), the variant chosen in its settings, and the pattern code from the pattern book.';

const libraryIndex: PageDefinition = {
  path: '/library',
  slug: 'library',
  title: 'Block library',
  excerpt: 'Every block and variant the site can use, shown with real content.',
  template: 'library',
  seo: LIBRARY_SEO,
  blocks: blocks('lib', [
    libraryIntro('Block library', [
      'These pages show every block the site can use, with every variant, filled with sample content so you can see how each one looks in real life.',
      HOW_TO,
      'Header, menu and footer styles are not blocks: choose them under Appearance. These pages are hidden from search engines and can be deleted once the site is built.',
    ]),
    b('cardGrid', {
      variant: 'imageCards',
      title: 'Browse by kind',
      columns: 3,
      cards: [
        { title: 'Openers', body: 'Heroes, full-screen sliders, stacked panels and image bands.', href: '/library/openers', imageUrl: img('scene-dusk'), alt: '' },
        { title: 'Sliders', body: 'Card, product, gallery and cover-flow sliders, and scrolling strips.', href: '/library/sliders', imageUrl: img('product-graphite'), alt: '' },
        { title: 'Content', body: 'Text, images, tabs, collages, product windows and layouts.', href: '/library/content', imageUrl: img('interior-studio'), alt: '' },
        { title: 'Collections', body: 'Card grids, logos, quotes, services, posts, figures and FAQs.', href: '/library/collections', imageUrl: img('arch-facade'), alt: '' },
        { title: 'Scroll effects', body: 'Scroll stories, pinned media, kinetic text and reveal on scroll.', href: '/library/scroll-effects', imageUrl: img('scene-night'), alt: '' },
        { title: 'Calls to action', body: 'Call-to-action bands, newsletter sign-up, app download and forms.', href: '/library/conversion', imageUrl: img('phone-home'), alt: '' },
        { title: 'Elements', body: 'Headings, buttons, messages, progress, countdowns, social links, pricing and team.', href: '/library/elements', imageUrl: img('ui-analytics'), alt: '' },
        { title: 'Media and showcase', body: 'Before and after, video, galleries, panels, projects, maps, parallax and timelines.', href: '/library/showcase', imageUrl: img('arch-tower'), alt: '' },
        { title: 'More layouts', body: 'More layouts for blocks you already have: questions, cards, counters, calls to action and logos.', href: '/library/layouts', imageUrl: img('ui-dashboard'), alt: '' },
        { title: 'Widgets', body: 'Charts, image hotspots, flip cards, price lists, opening hours, share buttons, reviews and text on a path.', href: '/library/widgets', imageUrl: img('product-lamp'), alt: '' },
        { title: 'Navigation', body: 'Breadcrumbs, search boxes and tables of contents.', href: '/library/navigation', imageUrl: img('scene-forest'), alt: '' },
        { title: 'Effects and popups', body: 'Entrances, hover effects, shape dividers, gradients, sticky blocks and snapping, Lottie animations, and popups built from blocks.', href: '/library/effects', imageUrl: img('scene-night'), alt: '' },
      ],
    }),
    b('cta', {
      variant: 'inline',
      tone: 'raised',
      title: 'Whole pages, ready-made',
      body: 'Ten page templates built from these blocks — agency, restaurant, clinic and more. Start a new page from one in Pages → New page.',
      links: [link('See the templates', '/templates')],
    }),
  ]),
};

const libraryOpeners: PageDefinition = {
  path: '/library/openers',
  slug: 'openers',
  title: 'Openers — block library',
  excerpt: 'Hero layouts, full-screen sliders, stacked panels, image bands, statements and figures.',
  template: 'library',
  seo: LIBRARY_SEO,
  blocks: blocks('lib-open', [
    libraryIntro('Openers', ['The sections a page usually starts with. Any of them can also sit further down a page.', HOW_TO]),
    b('hero', {
      titleAs: 'h2',
      kicker: 'Consulting',
      eyebrow: 'Advisory',
      title: 'Clear advice for complicated decisions',
      lede: 'Independent guidance for teams facing a big technical choice.',
      body: 'We review the options, test the risky parts and give you a recommendation in writing within four weeks.',
      links: [link('Book a review', '/contact'), link('How it works', '/services', 'outline')],
      figure: 'converge',
      figureLabels: ['Your team', 'Our review', 'One decision'],
    }),
    b('hero', {
      variant: 'mediaCenter',
      titleAs: 'h2',
      eyebrow: 'New season',
      title: 'Made for the long haul',
      lede: 'A collection designed to be repaired, not replaced.',
      links: [link('Explore the range', '/services'), link('Find a store', '/contact', 'outline')],
      imageUrl: img('scene-ocean'),
      alt: 'Headlands over the sea',
      announcement: { label: 'Open studio day — 14 October', href: '/contact' },
      scrollCue: true,
    }),
    b('hero', {
      variant: 'mediaBottomLeft',
      titleAs: 'h2',
      eyebrow: 'Expeditions',
      title: 'Walk further, carry less',
      lede: 'Lightweight kit for multi-day routes, tested on the trails we love.',
      links: [link('Plan a route', '/services')],
      imageUrl: img('scene-forest'),
      alt: 'Misty green hills',
      overlay: 'strong',
    }),
    b('hero', {
      variant: 'layered',
      titleAs: 'h2',
      eyebrow: 'Ceramics atelier',
      title: 'Made to be used, not admired',
      lede: 'Mugs, bowls and vases thrown, glazed and fired by hand. Scroll slowly: the pictures move at their own speeds, and lean towards the pointer.',
      links: [link('See the collection', '/services'), link('Commission a piece', '/contact', 'outline')],
      imageUrl: img('scene-dawn'),
      alt: 'Hills at dawn under a pink sky',
      overlay: 'strong',
      pointerParallax: true,
      scrollCue: true,
      layers: [
        { imageUrl: img('interior-workshop'), alt: 'A workshop bench in daylight', depth: 'back' },
        { imageUrl: img('product-bottle'), alt: 'A glass bottle with a paper label', depth: 'middle' },
        { imageUrl: img('product-lamp'), alt: 'A desk lamp casting warm light', depth: 'front' },
      ],
    }),
    b('hero', {
      variant: 'split',
      titleAs: 'h2',
      eyebrow: 'Workspace',
      title: 'Offices that work as hard as you do',
      lede: 'Flexible floors in five cities, bookable by the day or the year.',
      links: [link('Book a viewing', '/contact'), link('See floor plans', '/services', 'outline')],
      imageUrl: img('arch-tower'),
      alt: 'An office tower at dusk',
      announcement: { label: 'Now open in Manchester', href: '/contact' },
    }),
    b('hero', {
      variant: 'statementFrame',
      titleAs: 'h2',
      eyebrow: 'Analytics',
      title: 'See every number that matters, in one place',
      lede: 'Connect your tools in minutes and share live reports with your team.',
      links: [link('Start free', '/contact'), link('Watch the demo', '/services', 'outline')],
      imageUrl: img('ui-dashboard'),
      alt: 'The analytics dashboard',
    }),
    b('hero', {
      variant: 'shaped',
      titleAs: 'h2',
      eyebrow: 'Annual report',
      title: 'A year of growing responsibly',
      lede: 'What we achieved, what we missed and what comes next.',
      links: [link('Read the report', '/blog')],
      imageUrl: img('scene-desert'),
      alt: 'Desert dunes',
    }),
    b('carousel', {
      mode: 'hero',
      autoplay: true,
      interval: 6,
      indicator: 'progress',
      arrows: 'side',
      slides: [
        { eyebrow: 'Coast', title: 'Where the land ends', body: 'Three new coastal routes for spring.', imageUrl: img('scene-ocean'), href: '/services', buttonLabel: 'Discover' },
        { eyebrow: 'Mountains', title: 'Higher, slower, quieter', body: 'Guided walks above the tree line.', imageUrl: img('scene-dusk'), href: '/services', buttonLabel: 'Discover' },
        { eyebrow: 'Night', title: 'Under a darker sky', body: 'Stargazing weekends far from any city.', imageUrl: img('scene-night'), href: '/services', buttonLabel: 'Discover' },
      ],
      strip: [link('Routes', '/services'), link('Guides', '/about'), link('Journal', '/blog'), link('Contact', '/contact')],
    }),
    b('carousel', {
      mode: 'heroCards',
      title: 'This month',
      autoplay: true,
      indicator: 'pill',
      arrows: 'none',
      slides: [
        { eyebrow: 'Just arrived', title: 'The new speaker', body: 'Room-filling sound, in a body you can repair.', imageUrl: img('product-speaker'), href: '/services', buttonLabel: 'Shop now' },
        { eyebrow: 'Workshop', title: 'Learn to repair it yourself', body: 'Free evening sessions at the studio.', imageUrl: img('interior-workshop'), href: '/contact', buttonLabel: 'Book a place' },
        { eyebrow: 'Gift guide', title: 'Things that last', body: 'Twelve gifts chosen to be kept for years.', imageUrl: img('product-watch'), href: '/blog', buttonLabel: 'See the guide' },
      ],
    }),
    b('stackedPanels', {
      panels: [
        { eyebrow: 'Chapter one', title: 'It starts with a sketch', body: 'Every product begins on paper, long before a pixel is drawn.', imageUrl: img('scene-dawn'), buttonLabel: 'Read more', href: '/about' },
        { eyebrow: 'Chapter two', title: 'Then we build it for real', body: 'Small teams, weekly releases, real people testing every step.', imageUrl: img('interior-workshop') },
        { eyebrow: 'Chapter three', title: 'And watch it grow', body: 'The first week after launch is when we learn the most.', imageUrl: img('scene-night') },
      ],
    }),
    b('mediaBand', {
      position: 'center',
      height: 'medium',
      eyebrow: 'Events',
      title: 'Open studio, every first Saturday',
      body: 'Come and see how things are made.',
      links: [link('Book a place', '/contact')],
      imageUrl: img('interior-lounge'),
      alt: 'The studio in the evening',
    }),
    b('mediaBand', {
      position: 'right',
      height: 'medium',
      overlay: 'strong',
      eyebrow: 'Sustainability',
      title: 'Built to be taken apart',
      body: 'Every part can be replaced, and every material can be recycled.',
      links: [link('Our approach', '/about')],
      imageUrl: img('arch-pavilion'),
      alt: 'Low buildings among trees',
    }),
    b('heading', {
      tone: 'raised',
      size: 'lede',
      layout: 'split',
      titleAs: 'p',
      eyebrow: 'Our promise',
      title: 'We will never promise what we cannot build, and we will always tell you what not to.',
      subtitle: 'Twelve years and 140 launches later, it is still the first thing every new client hears.',
    }),
    b('heading', {
      animation: 'kinetic',
      size: 'lede',
      layout: 'split',
      titleAs: 'p',
      title: 'Every part is designed to be taken apart, repaired and used again — for years, not seasons.',
      subtitle: 'Scroll this statement through the screen and its words light up one after another.',
    }),
    b('stats', {
      eyebrow: 'Last year',
      items: [
        { value: '140', unit: '+', label: 'Products launched' },
        { value: '96', unit: '%', label: 'Clients who returned' },
        { value: '3', unit: 'wk', label: 'Average time to first release' },
        { value: '0', label: 'Missed launch dates' },
      ],
      footnote: 'Figures for the twelve months to December.',
    }),
  ]),
};

const librarySliders: PageDefinition = {
  path: '/library/sliders',
  slug: 'sliders',
  title: 'Sliders — block library',
  excerpt: 'Card, product, gallery and cover-flow sliders, and endless scrolling strips.',
  template: 'library',
  seo: LIBRARY_SEO,
  blocks: blocks('lib-slide', [
    libraryIntro('Sliders and strips', [
      'Anything that moves sideways. All sliders share one set of controls: autoplay with a pause button, loop, slide or fade, seven indicator styles and four arrow positions.',
      HOW_TO,
    ]),
    b('carousel', { mode: 'cards', eyebrow: 'Selected work', title: 'Recent projects', link: { label: 'See all', href: '/services' }, slides: workSlides(), indicator: 'dots', arrows: 'corner' }),
    b('carousel', {
      mode: 'products',
      tone: 'raised',
      title: 'Pick your colour',
      intro: 'Four finishes, all anodised in-house.',
      indicator: 'none',
      arrows: 'side',
      slides: [
        { title: 'Pocket One', body: 'Graphite', imageUrl: img('product-graphite'), badge: 'New', price: 'From £499', swatches: ['#3a3d42', '#d4c3a3', '#2c5364', '#a3243a'], href: '/services' },
        { title: 'Pocket One', body: 'Sand', imageUrl: img('product-sand'), price: 'From £499', swatches: ['#d4c3a3', '#3a3d42', '#2c5364'], href: '/services' },
        { title: 'Pocket One', body: 'Ocean', imageUrl: img('product-ocean'), price: 'From £499', swatches: ['#2c5364', '#3a3d42', '#d4c3a3'], href: '/services' },
        { title: 'Pocket One', body: 'Ruby', imageUrl: img('product-ruby'), badge: 'Limited', price: 'From £549', swatches: ['#a3243a', '#3a3d42'], href: '/services' },
        { title: 'Field Watch', body: 'Brass case', imageUrl: img('product-watch'), price: '£320', swatches: ['#b89a6a', '#3a3d42'], href: '/services' },
        { title: 'Room Speaker', body: 'Stone', imageUrl: img('product-speaker'), price: '£260', swatches: ['#c9c3b8', '#3a3d42'], href: '/services' },
      ],
    }),
    b('carousel', {
      mode: 'media',
      eyebrow: 'Gallery',
      title: 'Inside the workshop',
      intro: 'Where each one is put together, by hand.',
      link: { label: 'Visit us', href: '/contact' },
      transition: 'fade',
      indicator: 'counter',
      arrows: 'side',
      slides: [
        { imageUrl: img('interior-workshop'), alt: 'The workbench', caption: 'The long bench — every unit starts here.' },
        { imageUrl: img('interior-studio'), alt: 'The design room', caption: 'The design room, where prototypes are tested.' },
        { imageUrl: img('product-lamp'), alt: 'A lamp on the bench', caption: 'Final checks under a daylight lamp.' },
        { imageUrl: img('interior-lounge'), alt: 'The lounge', caption: 'Where the team meets on Fridays.' },
      ],
    }),
    b('carousel', {
      mode: 'coverflow',
      title: 'Past expeditions',
      indicator: 'ring',
      arrows: 'corner',
      slides: [
        { imageUrl: img('scene-dawn'), alt: 'Hills at dawn', caption: 'Highlands, 2021' },
        { imageUrl: img('scene-desert'), alt: 'Desert dunes', caption: 'Desert crossing, 2022' },
        { imageUrl: img('scene-ocean'), alt: 'Coastline', caption: 'Coast path, 2023' },
        { imageUrl: img('scene-forest'), alt: 'Forest hills', caption: 'Forest trail, 2024' },
        { imageUrl: img('scene-night'), alt: 'Night sky', caption: 'Dark skies, 2025' },
      ],
    }),
    b('carousel', {
      mode: 'cards',
      title: 'Edge arrows, capsule indicator, autoplay',
      intro: 'The same card slider with the arrows at the screen edges and cards peeking on both sides.',
      autoplay: true,
      interval: 5,
      indicator: 'capsule',
      arrows: 'edge',
      slides: workSlides(6),
    }),
    b('carousel', {
      mode: 'media',
      tone: 'raised',
      eyebrow: 'Editorial gallery',
      title: 'Thumbnails, specifications and a slow drift',
      intro: 'The picture drifts while it is shown, the details sit under it, and the strip of thumbnails moves between pieces.',
      indicator: 'thumbs',
      arrows: 'side',
      kenBurns: true,
      link: { label: 'Enquire about a piece', href: '/contact' },
      slides: [
        {
          title: 'Oak lounge chair',
          caption: 'Oak lounge chair — shearling and solid oak',
          imageUrl: img('interior-lounge'),
          alt: 'A lounge with soft chairs',
          specs: [
            { label: 'Category', value: 'Lounge' },
            { label: 'Material', value: 'Shearling, solid oak' },
            { label: 'Size', value: 'H 72 × W 110 × D 85 cm' },
          ],
        },
        {
          title: 'One-dial lamp',
          caption: 'One-dial lamp — brushed aluminium',
          imageUrl: img('product-lamp'),
          alt: 'A desk lamp casting warm light',
          specs: [
            { label: 'Category', value: 'Lighting' },
            { label: 'Material', value: 'Brushed aluminium' },
            { label: 'Size', value: 'H 44 × Ø 18 cm' },
          ],
        },
        {
          title: 'Field speaker',
          caption: 'Field speaker — recycled polymer',
          imageUrl: img('product-speaker'),
          alt: 'A rounded speaker with a dotted grille',
          specs: [
            { label: 'Category', value: 'Audio' },
            { label: 'Material', value: 'Recycled polymer' },
            { label: 'Battery', value: '18 hours' },
          ],
        },
        {
          title: 'Harbour bottle',
          caption: 'Harbour bottle — hand-blown glass',
          imageUrl: img('product-bottle'),
          alt: 'A glass bottle with a paper label',
          specs: [
            { label: 'Category', value: 'Tableware' },
            { label: 'Material', value: 'Hand-blown glass' },
            { label: 'Size', value: '750 ml' },
          ],
        },
      ],
    }),
    b('carousel', {
      mode: 'cards',
      title: 'Drag it with the mouse',
      intro: 'The same card slider, but the track can be pulled sideways by hand as well as swiped or nudged with the arrows.',
      drag: true,
      indicator: 'counter',
      arrows: 'corner',
      slides: workSlides(6),
    }),
    b('carousel', {
      mode: 'hero',
      titleAs: 'h2',
      transition: 'fade',
      indicator: 'chapters',
      arrows: 'none',
      kenBurns: true,
      slides: [
        {
          eyebrow: 'Chapter one',
          title: 'Beneath the waves',
          body: 'Where the light stops and the cold begins.',
          imageUrl: img('scene-ocean'),
          alt: 'Headlands over a calm sea',
          href: '/services',
          buttonLabel: 'Read the chapter',
        },
        {
          eyebrow: 'Chapter two',
          title: 'Between the ridges',
          body: 'Four days of walking above the tree line.',
          imageUrl: img('scene-dusk'),
          alt: 'Layered mountains at dusk',
          href: '/services',
          buttonLabel: 'Read the chapter',
        },
        {
          eyebrow: 'Chapter three',
          title: 'Inner wilderness',
          body: 'The forest floor, close up and unhurried.',
          imageUrl: img('scene-forest'),
          alt: 'Soft green hills fading into mist',
          href: '/services',
          buttonLabel: 'Read the chapter',
        },
        {
          eyebrow: 'Chapter four',
          title: 'A quieter sky',
          body: 'Far enough out that the stars come back.',
          imageUrl: img('scene-night'),
          alt: 'A starry sky over dark ridges',
          href: '/services',
          buttonLabel: 'Read the chapter',
        },
      ],
    }),
    b('carousel', {
      mode: 'splitScreen',
      titleAs: 'h2',
      kenBurns: true,
      indicator: 'none',
      slides: [
        {
          eyebrow: '[ Dams ]',
          title: 'Managing water at scale',
          body: 'Forty years of embankments, spillways and the quiet engineering that keeps a valley dry.',
          imageUrl: img('arch-tower'),
          alt: 'A tall structure against the sky',
          href: '/services',
          buttonLabel: 'Discuss a project',
        },
        {
          eyebrow: '[ Bridges ]',
          title: 'Crossings that outlast us',
          body: 'Spans designed for a hundred years of weather, traffic and repair.',
          imageUrl: img('arch-facade'),
          alt: 'A pale stone facade',
          href: '/services',
          buttonLabel: 'Discuss a project',
        },
        {
          eyebrow: '[ Harbours ]',
          title: 'Working edges of the sea',
          body: 'Quays and breakwaters built where the ground is never still.',
          imageUrl: img('scene-ocean'),
          alt: 'Headlands over a calm sea',
          href: '/services',
          buttonLabel: 'Discuss a project',
        },
      ],
    }),
    b('carousel', {
      mode: 'filmstrip',
      eyebrow: 'Filmstrip',
      title: 'Frames drifting past',
      intro: 'The middle frame is sharp and the rest lean away; click any of them to bring it forward.',
      indicator: 'counter',
      arrows: 'corner',
      slides: [
        { title: 'Between frames', imageUrl: img('scene-dawn'), alt: 'Hills at dawn' },
        { title: 'The long bench', imageUrl: img('interior-workshop'), alt: 'A workshop bench in daylight' },
        { title: 'Harbour pavilion', imageUrl: img('arch-pavilion'), alt: 'Low buildings among trees' },
        { title: 'One-dial lamp', imageUrl: img('product-lamp'), alt: 'A desk lamp casting warm light' },
        { title: 'Open water', imageUrl: img('scene-ocean'), alt: 'Waves on open water' },
        { title: 'Dark skies', imageUrl: img('scene-night'), alt: 'A starry sky over dark ridges' },
      ],
    }),
    b('marquee', { kind: 'logos', eyebrow: 'Trusted by', title: 'Teams we have built with', items: LOGOS.map(([label, file]) => ({ label, imageUrl: img(file) })) }),
    b('marquee', {
      kind: 'quotes',
      tone: 'raised',
      rows: 2,
      speed: 'slow',
      title: 'What clients say',
      items: PEOPLE.map(([name, role, photo], i) => ({ quote: QUOTES[i], name, role, imageUrl: img(photo) })),
    }),
    b('marquee', {
      kind: 'chips',
      speed: 'fast',
      items: ['Repairable', 'Recyclable', 'Low power', 'Quiet', 'Modular', 'Open specs', 'Five-year warranty', 'Made locally'].map((label) => ({ label })),
    }),
  ]),
};

const libraryContent: PageDefinition = {
  path: '/library/content',
  slug: 'content',
  title: 'Content — block library',
  excerpt: 'Text, images, tabs, collages, product windows, colour pickers and layouts.',
  template: 'library',
  seo: LIBRARY_SEO,
  blocks: blocks('lib-content', [
    libraryIntro('Content sections', ['The body of a page. This introduction is itself the Text block, in its one-column layout.', HOW_TO]),
    b('prose', {
      eyebrow: 'Two columns',
      title: 'A heading beside the text',
      columns: 'two',
      paragraphs: [
        'The two-column layout puts the heading on the left and the paragraphs on the right, which suits introductions and short explanations.',
        'On phones the columns stack, with the heading first.',
      ],
    }),
    b('prose', {
      title: 'Rich text',
      html: '<p>Written in the editor, with <strong>bold</strong>, <em>italics</em>, <a href="/about">links</a> and lists:</p><ul><li>Headings and paragraphs</li><li>Bulleted and numbered lists</li><li>Quotes and links</li></ul><blockquote><p>Good products are made by people who care about the details nobody asks for.</p></blockquote>',
    }),
    b('splitMedia', {
      eyebrow: 'Craft',
      title: 'Made by hand, checked twice',
      body: 'Every unit is assembled at one bench by one person, who signs the inside of the case.\n\nIf something is wrong, we know who to ask — and so do you.',
      links: [link('Visit the workshop', '/contact'), link('Our approach', '/about', 'outline')],
      imageUrl: img('interior-workshop'),
      alt: 'The workshop bench',
      shape: 'organic',
      ratio: 'portrait',
    }),
    b('splitMedia', {
      mediaSide: 'right',
      eyebrow: 'Materials',
      title: 'Nothing we cannot take back',
      body: 'Aluminium, glass and a little steel — all of it recyclable, and all of it accepted back when you are done.',
      links: [link('Recycling programme', '/about')],
      imageUrl: img('product-sand'),
      alt: 'The device in sand',
      shape: 'rounded',
      ratio: 'landscape',
    }),
    b('overlayCard', {
      imageUrl: img('arch-facade'),
      alt: 'The new studio building',
      eyebrow: 'News',
      title: 'Our new studio opens in spring',
      body: 'Three floors, a public workshop and a café that serves the best coffee on the street.',
      link: { label: 'Read the story', href: '/blog' },
    }),
    b('overlayCard', {
      placement: 'insideLeft',
      imageUrl: img('scene-desert'),
      alt: 'Desert dunes',
      eyebrow: 'Warranty',
      title: 'Five years, no small print',
      body: 'If it breaks in the first five years, we repair it or replace it. That is the whole policy.',
      link: { label: 'How it works', href: '/about' },
    }),
    b('collage', {
      eyebrow: 'Behind the scenes',
      title: 'From sketch to shelf',
      body: 'A large picture sets the scene; a smaller one, offset, adds a detail. The text sits beside it.',
      link: { label: 'See the process', href: '/services' },
      largeUrl: img('interior-studio'),
      largeAlt: 'The studio',
      smallUrl: img('product-lamp'),
      smallAlt: 'A lamp',
    }),
    b('tabs', {
      eyebrow: 'For everyone',
      title: 'One platform, three ways in',
      barPosition: 'below',
      tabs: [
        { label: 'For teams', title: 'Share the work', body: 'Plan together, see progress live and stop chasing updates by email.', imageUrl: img('ui-dashboard'), alt: 'Team dashboard', link: link('See how', '/services') },
        { label: 'For partners', title: 'Build on it', body: 'A documented API and webhooks for everything, so partners can connect in a day.', imageUrl: img('interior-studio'), alt: 'Partners' },
        { label: 'For investors', title: 'Follow the numbers', body: 'Quarterly reports, published on time, in plain language.' },
      ],
    }),
    b('splitPoints', {
      eyebrow: 'Why us',
      title: 'Three things we do differently',
      intro: 'A heading on one side, labelled points on the other.',
      points: [
        { title: 'We ship weekly', body: 'Something you can use every Friday, not a progress report.' },
        { title: 'We say no early', body: 'The fastest project is the one that leaves out what nobody needs.' },
        { title: 'We hand over properly', body: 'Documentation and training so your team owns the product.' },
      ],
    }),
    b('numberedList', {
      eyebrow: 'Process',
      title: 'Four steps to launch',
      items: [
        { title: 'Talk', body: 'A short call to understand what you need.' },
        { title: 'Plan', body: 'A four-week discovery ending in a plan and a prototype.' },
        { title: 'Build', body: 'Weekly releases, each tested with real people.' },
        { title: 'Launch', body: 'Go live, watch closely and improve in the first week.' },
      ],
    }),
    b('checkLists', {
      title: 'What is included',
      lists: [
        { title: 'Every plan', items: ['Unlimited projects', 'Weekly reports', 'Email support', 'Two-factor sign-in'] },
        { title: 'Business plan', items: ['Everything in every plan', 'Single sign-on', 'Phone support', 'A named account manager'] },
      ],
    }),
    b('table', {
      title: 'Plans at a glance',
      head: ['Plan', 'Users', 'Support', 'Price'],
      rows: [
        ['Starter', 'Up to 5', 'Email', '£19 / month'],
        ['Team', 'Up to 25', 'Email and chat', '£79 / month'],
        ['Business', 'Unlimited', 'Phone, named manager', 'Talk to us'],
      ],
    }),
    b('image', { url: img('scene-ocean'), alt: 'Headlands over a calm sea', caption: 'Coast path, looking west', width: 1600, height: 1000 }),
    b('image', {
      url: img('arch-pavilion'),
      alt: 'Low buildings among trees',
      captionStyle: 'lead',
      captionLead: 'The new pavilion.',
      caption: 'Built from reclaimed timber, it houses the public workshop and a small café.',
      width: 1600,
      height: 1000,
    }),
    b('windowFrame', {
      eyebrow: 'Product',
      title: 'See it in a browser',
      chrome: 'browser',
      address: 'app.example.com/dashboard',
      tabs: [{ label: 'Dashboard', imageUrl: img('ui-dashboard'), alt: 'The dashboard' }],
    }),
    b('windowFrame', {
      title: 'An app window with a sidebar and tabs',
      chrome: 'app',
      address: 'Reports',
      sidebar: ['Overview', 'Projects', 'Reports', 'Team', 'Settings'],
      tabs: [
        { label: 'Screenshot', imageUrl: img('ui-analytics'), alt: 'The reports screen' },
        {
          label: 'Code',
          code: "import { createClient } from '@example/sdk';\n\nconst client = createClient({ key: process.env.API_KEY });\n\nconst report = await client.reports.create({\n  name: 'Weekly summary',\n  schedule: 'every monday 9:00',\n});\n\nconsole.log(report.id);",
        },
      ],
    }),
    b('windowFrame', {
      title: 'A terminal',
      chrome: 'terminal',
      address: 'bash',
      tabs: [{ label: 'Install', code: '$ npm install @example/sdk\nadded 1 package in 1.2s\n\n$ npx example login\n✔ Signed in as you@example.com' }],
    }),
    b('configurator', {
      title: 'Choose your colour',
      intro: 'Every finish is anodised in-house.',
      options: [
        { name: 'Graphite', color: '#3a3d42', imageUrl: img('product-graphite') },
        { name: 'Sand', color: '#d4c3a3', imageUrl: img('product-sand') },
        { name: 'Ocean', color: '#2c5364', imageUrl: img('product-ocean') },
        { name: 'Ruby', color: '#a3243a', imageUrl: img('product-ruby') },
      ],
    }),
    b('row', {
      gap: '48px',
      align: 'center',
      columns: [
        {
          id: 'lib-content-row-a',
          width: { base: 7, tablet: 12 },
          blocks: blocks('lib-content-row-a', [
            b('prose', {
              eyebrow: 'Rows and columns',
              title: 'Any blocks, side by side',
              paragraphs: ['A row holds columns, and each column holds its own blocks. Widths are set in twelfths, per screen size.', 'This row has text in a 7/12 column and a picture in a 5/12 column; on tablets they stack.'],
            }),
          ]),
        },
        {
          id: 'lib-content-row-b',
          width: { base: 5, tablet: 12 },
          blocks: blocks('lib-content-row-b', [b('image', { url: img('interior-lounge'), alt: 'The lounge', caption: 'A picture in a column' })]),
        },
      ],
    }),
    b('figure', { kind: 'layers', labels: ['Browser', 'App', 'API', 'Database'] }),
    b('spacer', { height: '64px', heightMobile: '32px', line: 'hairline' }),
  ]),
};

const libraryCollections: PageDefinition = {
  path: '/library/collections',
  slug: 'collections',
  title: 'Collections — block library',
  excerpt: 'Card grids, logo walls, quotes, services, posts, contact details, figures and FAQs.',
  template: 'library',
  seo: LIBRARY_SEO,
  blocks: blocks('lib-coll', [
    libraryIntro('Collections', ['Blocks that show several things of the same kind.', HOW_TO]),
    b('cardGrid', {
      eyebrow: 'Cards',
      title: 'The original card grid',
      columns: 3,
      cards: FEATURES.slice(0, 3).map(([title, body]) => ({ eyebrow: 'Principle', title, body, href: '/about' })),
    }),
    b('cardGrid', {
      variant: 'tiles',
      columns: 2,
      cards: [
        { eyebrow: 'Explore', title: 'The range', href: '/services', imageUrl: img('product-graphite'), buttonLabel: 'Discover' },
        { eyebrow: 'Explore', title: 'Stories', href: '/blog', imageUrl: img('scene-dusk'), buttonLabel: 'Discover' },
        { eyebrow: 'Explore', title: 'Workshops', href: '/contact', imageUrl: img('interior-workshop'), buttonLabel: 'Discover' },
        { eyebrow: 'Explore', title: 'Find us', href: '/contact', imageUrl: img('arch-facade'), buttonLabel: 'Discover' },
      ],
    }),
    b('cardGrid', {
      variant: 'mosaic',
      eyebrow: 'Mosaic',
      title: 'Two sizes of tile',
      columns: 3,
      cards: [
        { eyebrow: 'Lead', title: 'The workshop', body: 'Every fifth tile leads, at twice the size.', href: '/about', imageUrl: img('interior-workshop'), badge: 'New' },
        { eyebrow: 'Range', title: 'Speakers', href: '/services', imageUrl: img('product-graphite') },
        { eyebrow: 'Range', title: 'Lamps', href: '/services', imageUrl: img('interior-lounge') },
        { eyebrow: 'Range', title: 'Desks', href: '/services', imageUrl: img('interior-studio'), badge: 'Coming soon' },
        { eyebrow: 'Range', title: 'Outdoors', href: '/services', imageUrl: img('scene-forest') },
      ],
    }),
    b('cardGrid', { variant: 'icons', eyebrow: 'Features', title: 'Everything included', columns: 3, cards: featureCards() }),
    b('cardGrid', {
      variant: 'imageCards',
      eyebrow: 'Categories',
      title: 'Shop by room',
      columns: 4,
      cards: [
        { title: 'Living room', body: 'Speakers, lamps and chargers.', imageUrl: img('interior-lounge'), href: '/services' },
        { title: 'Studio', body: 'Tools for focused work.', imageUrl: img('interior-studio'), href: '/services' },
        { title: 'Workshop', body: 'Parts and repair kits.', imageUrl: img('interior-workshop'), href: '/services' },
        { title: 'Outdoors', body: 'Built for bad weather.', imageUrl: img('scene-forest'), href: '/services' },
      ],
    }),
    b('logoWall', { eyebrow: 'Customers', title: 'Trusted by teams at', framed: true, columns: 4, logos: logoItems(8), link: { label: 'Read their stories', href: '/blog' } }),
    b('logoWall', { title: 'Certified and accredited', align: 'left', columns: 5, logos: logoItems(5) }),
    b('quote', {
      eyebrow: 'Kestrel',
      quote: QUOTES[1],
      name: PEOPLE[1][0],
      role: PEOPLE[1][1],
      avatarUrl: img(PEOPLE[1][2]),
      imageUrl: img('product-speaker'),
      alt: 'The Kestrel speaker',
      links: [link('Read the case study', '/blog'), link('Talk to us', '/contact', 'outline')],
    }),
    b('quote', { tone: 'raised', quote: QUOTES[2], name: PEOPLE[2][0], role: PEOPLE[2][1], avatarUrl: img(PEOPLE[2][2]) }),
    b('servicesIndex', { eyebrow: 'Services', title: 'Services index', intro: 'Filled automatically from the pages that use the Service template.', tier: 'all' }),
    b('postList', { eyebrow: 'Journal', title: 'Latest posts, as text cards', intro: 'Filled automatically from published posts.', limit: 3 }),
    b('postList', { variant: 'news', eyebrow: 'Newsroom', title: 'Latest posts, as news cards', limit: 3 }),
    b('infoPanel', {
      title: 'Contact details panel',
      items: [
        { label: 'Email', value: 'hello@example.com' },
        { label: 'Phone', value: '+44 20 0000 0000' },
        { label: 'Response time', value: 'Within one working day' },
      ],
    }),
    b('stats', {
      variant: 'figures',
      title: 'By the numbers',
      intro: 'Measured in our lab, not estimated.',
      imageUrl: img('product-graphite'),
      alt: 'The device',
      items: [
        { value: '6.9', unit: 'mm', label: 'At its thinnest' },
        { value: '168', unit: 'g', label: 'Total weight' },
        { value: '5', unit: 'yr', label: 'Warranty' },
        { value: '100', unit: '%', label: 'Recycled aluminium' },
      ],
    }),
    b('faq', { eyebrow: 'FAQ', title: 'Questions beside a heading', items: faqItems(4) }),
    b('faq', { variant: 'media', title: 'Questions beside a picture', items: faqItems(3, true) }),
  ]),
};

const libraryMotion: PageDefinition = {
  path: '/library/scroll-effects',
  slug: 'scroll-effects',
  title: 'Scroll effects — block library',
  excerpt: 'Scroll stories, pinned media, kinetic statements, reveal on scroll and the sticky section menu.',
  template: 'library',
  seo: LIBRARY_SEO,
  blocks: blocks('lib-motion', [
    libraryIntro('Scroll effects', [
      'Sections that react to scrolling. Every effect stops for visitors who ask for less motion, and nothing is ever hidden while it waits.',
      HOW_TO,
    ]),
    b('subNav', {
      name: 'Scroll effects',
      links: [link('Story', '#story'), link('Pinned', '#pinned'), link('Kinetic', '#kinetic'), link('Reveal', '#reveal')],
      cta: { label: 'Get started', href: '/contact' },
    }),
    b(
      'scrollStory',
      {
        eyebrow: 'How it works',
        title: 'From order to door',
        intro: 'The step crossing the middle of the screen picks the picture beside it.',
        items: [
          { title: 'You choose', body: 'Pick a finish and a size online, or try them in the studio.', imageUrl: img('product-sand') },
          { title: 'We build', body: 'One person assembles your unit at one bench, start to finish.', imageUrl: img('interior-workshop') },
          { title: 'We check', body: 'Every unit is tested for a full day before it is packed.', imageUrl: img('product-lamp') },
          { title: 'It arrives', body: 'Delivered in recycled packaging, usually within three days.', imageUrl: img('scene-dawn') },
        ],
      },
      { anchorId: 'story' },
    ),
    b('pinnedMedia', { eyebrow: 'Up close', title: 'Every detail, in order', body: 'The section holds still while the picture moves with your scroll.', imageUrl: img('product-watch'), alt: 'The watch', length: 'short' }, { anchorId: 'pinned' }),
    b(
      'heading',
      {
        tone: 'raised',
        animation: 'kinetic',
        size: 'lede',
        layout: 'split',
        titleAs: 'p',
        title: 'Good products are made by people who care about the details nobody asks for.',
        subtitle: 'The words light up as this statement moves up the screen.',
      },
      { anchorId: 'kinetic' },
    ),
    b('cardGrid', { variant: 'icons', title: 'Reveal on scroll — rise', intro: 'Any block can rise into place the first time it scrolls into view. Set it in the block’s Design tab.', columns: 3, cards: featureCards(3) }, { anchorId: 'reveal', reveal: 'rise' }),
    b('splitMedia', { title: 'Reveal on scroll — fade', body: 'This section fades in the first time it reaches the screen.', imageUrl: img('scene-forest'), alt: 'Green hills', mediaSide: 'right' }, { reveal: 'fade' }),
    b('stats', { eyebrow: 'Reveal on scroll', items: [{ value: '1', label: 'Setting per block' }, { value: '2', label: 'Styles: fade and rise' }, { value: '0', label: 'Effects for reduced motion' }] }, { reveal: 'rise' }),
  ]),
};

const libraryConversion: PageDefinition = {
  path: '/library/conversion',
  slug: 'conversion',
  title: 'Calls to action — block library',
  excerpt: 'Call-to-action bands, newsletter sign-up, app download, contact form and the next-page link.',
  template: 'library',
  seo: LIBRARY_SEO,
  blocks: blocks('lib-conv', [
    libraryIntro('Calls to action and forms', ['Closing prompts, sign-ups and forms.', HOW_TO]),
    b('cta', { eyebrow: 'Get started', title: 'Ready when you are', body: 'The original full-width band, in the site’s accent colour.', links: [link('Start a project', '/contact'), link('See pricing', '/services')] }),
    b('cta', { variant: 'big', eyebrow: 'Have something in mind?', title: 'Let’s build the next one together', links: [link('Start a project', '/contact')] }),
    b('cta', { variant: 'card', title: 'Questions before you buy?', body: 'Talk to someone who builds them.', links: [link('Book a call', '/contact', 'outline')] }),
    b('newsletter', {
      title: 'Stay in the loop',
      body: 'One email a month about what we are building. No noise.',
      consentText: 'I agree to receive the newsletter and know I can unsubscribe at any time.',
      successText: 'Thanks — you’re on the list.',
    }),
    b('cta', { variant: 'inline', tone: 'raised', title: 'Get the monthly letter', body: 'Sign up on our mailing page.', links: [{ label: 'Sign up', href: '/contact' }] }),
    b('appPromo', {
      iconUrl: img('app-icon'),
      eyebrow: 'Mobile app',
      title: 'Take it with you',
      body: 'Everything in your pocket, even offline.',
      appStoreHref: 'https://apps.apple.com/',
      playStoreHref: 'https://play.google.com/',
      screens: [
        { imageUrl: img('phone-home'), alt: 'The app home screen' },
        { imageUrl: img('phone-stats'), alt: 'The stats screen' },
        { imageUrl: img('phone-profile'), alt: 'The profile screen' },
      ],
    }),
    b('contactForm', {
      layout: 'split',
      eyebrow: 'Contact',
      title: 'Tell us what you need',
      intro: 'A few lines is plenty.',
      body: 'Every enquiry lands in the admin under Enquiries, and is answered within one working day.',
      imageUrl: img('interior-studio'),
      alt: 'The studio',
    }),
    b('contactForm', { eyebrow: 'Contact', title: 'The same form, stacked', intro: 'The original layout: heading above the form.' }),
    b('pager', { label: 'Next page', title: 'Back to the block library', href: '/library' }),
  ]),
};

const IN_45_DAYS = new Date(Date.now() + 45 * 86_400_000).toISOString();
const IN_200_DAYS = new Date(Date.now() + 200 * 86_400_000).toISOString();

const TEAM = [
  { name: 'Sam Whitfield', role: 'Engineering lead', bio: 'Twelve years of shipping software people rely on.', imageUrl: img('person-1') },
  { name: 'Maya Lindqvist', role: 'Product strategy', bio: 'Turns vague ambitions into plans a team can follow.', imageUrl: img('person-2') },
  { name: 'Priya Raman', role: 'Design director', bio: 'Designs systems that stay consistent at any size.', imageUrl: img('person-3') },
  { name: 'Tom Okafor', role: 'Mobile engineering', bio: 'Makes apps feel fast on the slowest phone.', imageUrl: img('person-4') },
].map((m) => ({ ...m, links: [{ network: 'linkedin', href: 'https://www.linkedin.com/' }, { network: 'github', href: 'https://github.com/' }] }));

const PLANS = [
  {
    name: 'Starter',
    tagline: 'For trying things out',
    price: '$0',
    period: '/ month',
    yearlyPrice: '$0',
    yearlyPeriod: '/ month',
    description: 'Everything you need for one small site.',
    features: [
      { text: 'One website', included: true },
      { text: '5 GB storage', included: true },
      { text: 'Community support', included: true },
      { text: 'Custom domain', included: false },
    ],
    button: { label: 'Start free', href: '/contact' },
  },
  {
    name: 'Team',
    tagline: 'Most teams pick this',
    price: '$29',
    period: '/ month',
    yearlyPrice: '$23',
    yearlyPeriod: '/ month, billed yearly',
    badge: 'Popular',
    featured: true,
    description: 'For small teams running several sites.',
    features: [
      { text: 'Ten websites', included: true },
      { text: '50 GB storage', included: true },
      { text: 'Priority email support', included: true },
      { text: 'Custom domains', included: true },
    ],
    button: { label: 'Get started', href: '/contact' },
  },
  {
    name: 'Business',
    tagline: 'For larger organisations',
    price: '$79',
    period: '/ month',
    yearlyPrice: '$63',
    yearlyPeriod: '/ month, billed yearly',
    description: 'For agencies and companies with many sites.',
    features: [
      { text: 'Unlimited websites', included: true },
      { text: '250 GB storage', included: true },
      { text: 'Phone support', included: true },
      { text: 'Single sign-on', included: true },
    ],
    button: { label: 'Talk to sales', href: '/contact' },
  },
];

const libraryElements: PageDefinition = {
  path: '/library/elements',
  slug: 'elements',
  title: 'Elements — block library',
  excerpt: 'Headings, buttons, messages, progress, countdowns, social links, pricing and team.',
  template: 'library',
  seo: LIBRARY_SEO,
  blocks: blocks('lib-el', [
    libraryIntro('Elements', ['Smaller building blocks: headings, buttons, messages, figures and people. Most sit between larger sections.', HOW_TO]),
    b('heading', {
      badge: 'New',
      eyebrow: 'Heading',
      title: 'Changing the way products are made',
      highlight: 'products',
      highlightStyle: 'marker',
      subtitle: 'A heading on its own, with a badge, a highlighted phrase, an accent divider and a subtitle.',
      divider: 'accent',
    }),
    b('heading', { align: 'center', size: 'display', title: 'We design', rotating: ['brands', 'products', 'interfaces', 'experiences'], typingSpeed: 'normal', divider: 'line' }),
    b('heading', { size: 'medium', title: 'Compatible with the tools you already use', highlight: 'tools you already use', highlightStyle: 'underline', subtitle: 'The medium size, with an underlined phrase.' }),
    b('buttons', {
      items: [
        { label: 'Get started', href: '/contact', style: 'primary', icon: 'arrow' },
        { label: 'Book a demo', href: '/contact', style: 'outline' },
        { label: 'See pricing', href: '/library/elements', style: 'soft' },
        { label: 'Read the docs', href: '/blog', style: 'text', icon: 'arrow' },
        { label: 'Add to list', href: '/contact', style: 'primary', icon: 'plus', iconOnly: true },
      ],
    }),
    b('buttons', {
      align: 'center',
      size: 'large',
      items: [
        { label: 'Watch the film', href: '/contact', style: 'primary', icon: 'play', iconSide: 'left', shadow: true },
        { label: 'Write to us', href: '/contact', style: 'outline', icon: 'mail', iconSide: 'left' },
      ],
    }),
    b('buttons', { size: 'small', fullWidth: true, items: [{ label: 'Monthly', href: '/contact', style: 'soft' }, { label: 'Yearly', href: '/contact', style: 'soft' }, { label: 'Lifetime', href: '/contact', style: 'primary' }] }),
    b('notice', { kind: 'info', title: 'Heads up', text: 'The studio is closed on public holidays; we reply the next working day.', link: { label: 'Opening hours', href: '/contact' } }),
    b('notice', { kind: 'success', text: 'Your order is confirmed. A receipt is on its way to your inbox.', dismissible: true }),
    b('notice', { kind: 'warning', text: 'Stock is running low on the sand finish.', width: 'fit', align: 'center', size: 'small' }),
    b('notice', { kind: 'danger', title: 'Service interruption', text: 'Payments are delayed while our provider fixes an outage. Nothing needs doing on your side.', size: 'large' }),
    b('progress', {
      eyebrow: 'Skills',
      title: 'What the team spends its time on',
      kind: 'bars',
      tooltip: true,
      items: [
        { label: 'Product design', value: 90 },
        { label: 'Front-end engineering', value: 80 },
        { label: 'Research', value: 65, note: 'Interviews, testing and analytics' },
      ],
    }),
    b('progress', {
      title: 'Project health',
      kind: 'rings',
      thickness: 'bold',
      labelPosition: 'beside',
      items: [
        { label: 'On time', value: 96, note: 'Last 50 projects' },
        { label: 'On budget', value: 92, note: 'Last 50 projects' },
        { label: 'Returning clients', value: 75, note: 'Since 2020' },
      ],
    }),
    b('countdown', { eyebrow: 'Launch', title: 'The new studio opens in', target: IN_45_DAYS, style: 'boxed', dividers: true, expiredText: 'We are open — come and visit.' }),
    b('countdown', { title: 'Until the annual conference', target: IN_200_DAYS, style: 'plain', units: ['months', 'days', 'hours'] }),
    b('countdown', { title: 'Early-bird tickets end in', target: IN_45_DAYS, style: 'inline', align: 'left', units: ['days', 'hours', 'minutes'] }),
    b('socialLinks', { title: 'Follow the studio', source: 'site', style: 'outlined' }),
    b('socialLinks', {
      source: 'custom',
      style: 'filled',
      brandColors: true,
      links: [
        { network: 'linkedin', href: 'https://www.linkedin.com/' },
        { network: 'instagram', href: 'https://www.instagram.com/' },
        { network: 'facebook', href: 'https://www.facebook.com/' },
        { network: 'youtube', href: 'https://www.youtube.com/' },
        { network: 'github', href: 'https://github.com/' },
        { network: 'x', href: 'https://x.com/' },
      ],
    }),
    b('socialLinks', { source: 'site', style: 'text', size: 'large' }),
    b('socialLinks', { source: 'site', style: 'boxed', size: 'large', align: 'left' }),
    b('socialLinks', { source: 'site', style: 'plain', size: 'small', align: 'right' }),
    b('pricing', {
      eyebrow: 'Pricing',
      title: 'Simple plans that grow with you',
      intro: 'Switch to yearly billing and save a fifth.',
      billing: 'switch',
      yearlyNote: 'Save 20%',
      plans: PLANS,
      footnote: 'Prices exclude VAT. Cancel any time.',
    }),
    b('pricing', { title: 'The same plans in one panel', layout: 'contained', buttonPosition: 'top', tone: 'raised', plans: PLANS }),
    b('team', { eyebrow: 'Team', title: 'The people you would work with', columns: 4, members: TEAM }),
    b('team', { title: 'Details on hover', variant: 'overlay', columns: 3, hover: 'greyscale', members: TEAM.slice(0, 3) }),
    b('team', { title: 'Profile beside the portraits', variant: 'split', hover: 'scale', members: TEAM }),
  ]),
};

/** A sample film: Big Buck Bunny, © Blender Foundation, CC BY 3.0. Nothing loads from YouTube until play. */
const FILM = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
const FILM_CREDIT = 'Big Buck Bunny © Blender Foundation (CC BY 3.0), used as a sample film.';
const STUDIO = { lat: 51.5138, lng: -0.0984 };

const PROJECTS = [
  { title: 'Harbour pavilion', category: 'Architecture', year: '2025', summary: 'A timber pavilion for a working harbour.', imageUrl: img('arch-pavilion'), hoverImageUrl: img('scene-ocean'), alt: 'A timber pavilion by the water', href: '/services/design' },
  { title: 'Northside tower', category: 'Architecture', year: '2024', summary: 'Wayfinding and identity for a mixed-use tower.', imageUrl: img('arch-tower'), hoverImageUrl: img('scene-night'), alt: 'A tall tower against the sky', href: '/services/design' },
  { title: 'Makers’ workshop', category: 'Interiors', year: '2025', summary: 'A shared workshop that doubles as a gallery.', imageUrl: img('interior-workshop'), hoverImageUrl: img('interior-studio'), alt: 'Benches in a workshop', href: '/services/strategy' },
  { title: 'Quiet lounge', category: 'Interiors', year: '2023', summary: 'A members’ lounge designed around daylight.', imageUrl: img('interior-lounge'), hoverImageUrl: img('scene-dawn'), alt: 'Armchairs in a sunny lounge', href: '/services/strategy' },
  { title: 'Field speaker', category: 'Product', year: '2026', summary: 'A rugged speaker for festivals and building sites.', imageUrl: img('product-speaker'), hoverImageUrl: img('product-sand'), alt: 'A portable speaker', href: '/services/engineering' },
  { title: 'One-dial lamp', category: 'Product', year: '2024', summary: 'A desk lamp with one dial and no app.', imageUrl: img('product-lamp'), hoverImageUrl: img('product-graphite'), alt: 'A desk lamp', href: '/services/engineering' },
];

const PICTURES = [
  { url: img('scene-dawn'), alt: 'Hills at dawn', caption: 'Dawn over the hills' },
  { url: img('arch-pavilion'), alt: 'A timber pavilion by the water', caption: 'Harbour pavilion' },
  { url: img('interior-studio'), alt: 'A bright studio with long desks', caption: 'The studio' },
  { url: img('product-lamp'), alt: 'A desk lamp', caption: 'One-dial lamp' },
  { url: img('scene-forest'), alt: 'A path through a forest', caption: 'Forest walk' },
  { url: img('arch-tower'), alt: 'A tall tower against the sky', caption: 'Northside tower' },
  { url: img('interior-lounge'), alt: 'Armchairs in a sunny lounge', caption: 'Members’ lounge' },
  { url: img('scene-ocean'), alt: 'Waves on open water', caption: 'Open water' },
  { url: img('product-speaker'), alt: 'A portable speaker', caption: 'Field speaker' },
];

/** Mixed shapes, so the masonry layout has something to do. */
const MIXED_PICTURES = [
  { url: img('person-1'), alt: 'Portrait of Sam', caption: 'Sam, engineering' },
  { url: img('scene-dusk'), alt: 'Hills at dusk', caption: 'Dusk' },
  { url: img('person-2'), alt: 'Portrait of Maya', caption: 'Maya, product' },
  { url: img('product-watch'), alt: 'A wristwatch', caption: 'Watch face study' },
  { url: img('scene-desert'), alt: 'Dunes in a desert', caption: 'The dunes' },
  { url: img('person-3'), alt: 'Portrait of Priya', caption: 'Priya, design' },
  { url: img('phone-home'), alt: 'A phone showing an app’s home screen', caption: 'App home screen' },
  { url: img('person-4'), alt: 'Portrait of Tom', caption: 'Tom, mobile' },
];

const libraryShowcase: PageDefinition = {
  path: '/library/showcase',
  slug: 'showcase',
  title: 'Media and showcase — block library',
  excerpt: 'Before and after, video, galleries, panels, projects, maps, parallax and timelines.',
  template: 'library',
  seo: LIBRARY_SEO,
  blocks: blocks('lib-sh', [
    libraryIntro('Media and showcase', [
      'Pictures, films, maps and portfolios. Films and maps from other sites load only when a visitor asks for them, so nobody is tracked by a page view.',
      HOW_TO,
    ]),
    b('compare', {
      eyebrow: 'Compare',
      title: 'The same hills at dawn and at dusk',
      beforeUrl: img('scene-dawn'),
      afterUrl: img('scene-dusk'),
      beforeAlt: 'The hills at dawn',
      afterAlt: 'The same hills at dusk',
      beforeLabel: 'Dawn',
      afterLabel: 'Dusk',
      caption: 'Drag the handle, or focus it and use the arrow keys.',
    }),
    b('compare', {
      title: 'Before and after the refit',
      tone: 'raised',
      orientation: 'vertical',
      handle: 'arrows',
      ratio: '4/3',
      start: 40,
      beforeUrl: img('interior-workshop'),
      afterUrl: img('interior-studio'),
      beforeAlt: 'The room as a workshop',
      afterAlt: 'The room as a studio',
      beforeLabel: 'Before',
      afterLabel: 'After',
    }),
    b('video', { eyebrow: 'Video', title: 'A film that plays in place', source: FILM, videoTitle: 'Big Buck Bunny', posterUrl: img('scene-forest'), caption: FILM_CREDIT }),
    b('video', { title: 'A play button on its own', display: 'button', buttonStyle: 'outlined', buttonSize: 'large', buttonLabel: 'Watch the film', source: FILM, videoTitle: 'Big Buck Bunny' }),
    b('video', { title: 'Over a picture, in frosted glass', display: 'button', buttonStyle: 'blurred', ratio: '21/9', posterUrl: img('scene-night'), source: FILM, videoTitle: 'Big Buck Bunny', caption: FILM_CREDIT }),
    b('gallery', { eyebrow: 'Gallery', title: 'An even grid with a picture viewer', captions: 'below', images: PICTURES }),
    b('gallery', { title: 'Masonry keeps each picture’s shape', layout: 'masonry', columns: 4, gap: 'small', hover: 'greyscale', captions: 'overlay', images: MIXED_PICTURES }),
    b('gallery', { title: 'Metro mixes tile sizes', layout: 'metro', gap: 'none', images: PICTURES, link: { label: 'Follow on Instagram', href: 'https://www.instagram.com/' } }),
    b('horizontalAccordion', {
      eyebrow: 'Horizontal accordion',
      title: 'Panels that widen on hover',
      trigger: 'hover',
      panels: [
        { title: 'Dawn', label: 'Early', body: 'Soft light and long shadows: the best hour for photographing buildings.', imageUrl: img('scene-dawn'), alt: 'Hills at dawn', link: { label: 'Our process', href: '/about' } },
        { title: 'Forest', label: 'Field trip', body: 'The team spends a week outside every spring.', imageUrl: img('scene-forest'), alt: 'A forest path' },
        { title: 'Open water', label: 'Research', body: 'Sea trials for the field speaker.', imageUrl: img('scene-ocean'), alt: 'Waves on open water' },
        { title: 'Night', label: 'Late', body: 'The studio after hours, lit for a launch.', imageUrl: img('scene-night'), alt: 'A city at night' },
      ],
    }),
    b('horizontalAccordion', {
      title: 'Panels that open on click',
      tone: 'raised',
      height: 'tall',
      panels: [
        { title: 'The studio', label: 'Room 1', body: 'Long desks, one big screen and a lot of daylight.', imageUrl: img('interior-studio'), alt: 'A bright studio' },
        { title: 'The workshop', label: 'Room 2', body: 'Where prototypes are built and broken.', imageUrl: img('interior-workshop'), alt: 'Benches in a workshop' },
        { title: 'The lounge', label: 'Room 3', body: 'For clients, coffee and slower conversations.', imageUrl: img('interior-lounge'), alt: 'Armchairs in a lounge', link: { label: 'Visit us', href: '/contact' } },
      ],
    }),
    b('projects', { eyebrow: 'Projects', title: 'Filter by discipline', items: PROJECTS, link: { label: 'All services', href: '/services' } }),
    b('projects', { title: 'Details over the picture, a second picture on hover', layout: 'overlay', hover: 'swap', filter: false, items: PROJECTS.slice(0, 3) }),
    b('projects', { title: 'Minimal, in greyscale until hovered', layout: 'minimal', columns: 4, hover: 'greyscale', filter: false, items: PROJECTS.slice(0, 4) }),
    b('projects', { title: 'Metro', layout: 'metro', tone: 'raised', items: PROJECTS }),
    b('projects', { title: 'A list whose picture follows the pointer', layout: 'list', filter: false, items: PROJECTS }),
    b('map', {
      eyebrow: 'Map',
      title: 'Visit the studio',
      address: '1 Example Street\nLondon EC1A 1AA',
      ...STUDIO,
      details: [
        { label: 'Opening hours', value: 'Monday to Friday, 9:00–18:00' },
        { label: 'Phone', value: '+44 20 7946 0000' },
      ],
      link: { label: 'Get in touch', href: '/contact' },
    }),
    b('map', {
      title: 'Details beside the map',
      layout: 'split',
      provider: 'google',
      height: 'short',
      address: '1 Example Street, London EC1A 1AA',
      details: [{ label: 'Nearest station', value: 'St Paul’s, four minutes on foot' }],
    }),
    b('map', { title: 'Full width, in greyscale', layout: 'full', height: 'tall', greyscale: true, zoom: 14, address: '1 Example Street\nLondon EC1A 1AA', ...STUDIO }),
    b('mediaBand', {
      imageUrl: img('scene-forest'),
      parallax: 'vertical',
      position: 'left',
      overlay: 'gradient',
      height: 'tall',
      eyebrow: 'Parallax',
      title: 'The picture drifts as you scroll',
      body: 'A media band with its drift switched on. It moves more slowly than the page, and stays still for anyone who asks for less motion.',
      links: [{ label: 'See the services', href: '/services' }],
    }),
    b('mediaBand', { imageUrl: img('scene-desert'), alt: 'Dunes in a desert', parallax: 'horizontal', strength: 'strong', height: 'short', overlay: 'none' }),
    b('numberedList', {
      variant: 'steps',
      eyebrow: 'Process',
      title: 'How a project runs',
      items: [
        { title: 'Listen', body: 'Two weeks of interviews, research and reading.' },
        { title: 'Shape', body: 'A plan, a budget and a first prototype.' },
        { title: 'Build', body: 'Short cycles, shown to real people every fortnight.' },
        { title: 'Look after', body: 'Launch, measure and keep improving.' },
      ],
    }),
    b('numberedList', {
      variant: 'timeline',
      tone: 'raised',
      title: 'The studio so far',
      items: [
        { label: '2019', title: 'Two people, one room', body: 'The first client was a bakery with a very old website.' },
        { label: '2021', title: 'A workshop of our own', body: 'Room to build physical prototypes as well as software.' },
        { label: '2023', title: 'Fifteen people', body: 'Design, engineering and research under one roof.' },
        { label: '2026', title: '140 launches', body: 'And a waiting list we are working hard to shorten.' },
      ],
    }),
  ]),
};

const FAQ_ITEMS = [
  { question: 'How long does a project take?', answer: 'Most websites take eight to twelve weeks from the first workshop to launch. Apps take longer; we will give you a plan with dates after the first two weeks.' },
  { question: 'Do you work with in-house teams?', answer: 'Often. We can lead the work, join your team for a while, or review what your team has built.' },
  { question: 'Who owns the code and the designs?', answer: 'You do, from the first commit. Everything lives in accounts you control.' },
  { question: 'What happens after launch?', answer: 'We stay on for a month of fixes at no charge, then offer a monthly care plan if you want one.' },
];

const SERVICE_ROWS = [
  {
    eyebrow: 'Strategy',
    title: 'Research and positioning',
    body: 'Interviews, analytics and a plan the whole team can follow.',
    points: ['Stakeholder interviews', 'Competitor review', 'A one-page plan'],
    imageUrl: img('app-icon'),
    href: '/services/strategy',
    buttonLabel: 'About strategy',
  },
  {
    eyebrow: 'Design',
    title: 'Interfaces and identity',
    body: 'A design system that stays consistent at any size.',
    points: ['Brand and type', 'Component library', 'Prototypes you can click'],
    imageUrl: img('app-icon'),
    href: '/services/design',
    buttonLabel: 'About design',
  },
  {
    eyebrow: 'Engineering',
    title: 'Web and mobile builds',
    body: 'Fast, accessible products that are easy to change.',
    points: ['Websites and web apps', 'iOS and Android', 'Hosting and monitoring'],
    imageUrl: img('app-icon'),
    href: '/services/engineering',
    buttonLabel: 'About engineering',
  },
];

const PICTURE_CARDS = [
  { eyebrow: 'Architecture', title: 'Harbour pavilion', body: 'A timber pavilion for a working harbour.', imageUrl: img('arch-pavilion'), alt: 'A timber pavilion by the water', href: '/services/design', buttonLabel: 'See the project' },
  { eyebrow: 'Interiors', title: 'The studio', body: 'Long desks and a lot of daylight.', imageUrl: img('interior-studio'), alt: 'A bright studio', href: '/about', buttonLabel: 'Visit us' },
  { eyebrow: 'Product', title: 'Field speaker', body: 'Built for festivals and building sites.', imageUrl: img('product-speaker'), alt: 'A portable speaker', href: '/services/engineering', buttonLabel: 'See the product' },
  { eyebrow: 'Architecture', title: 'Northside tower', body: 'Wayfinding for a mixed-use tower.', imageUrl: img('arch-tower'), alt: 'A tall tower', href: '/services/design', buttonLabel: 'See the project' },
  { eyebrow: 'Interiors', title: 'Quiet lounge', body: 'A members’ lounge around daylight.', imageUrl: img('interior-lounge'), alt: 'Armchairs in a lounge', href: '/about', buttonLabel: 'Visit us' },
  { eyebrow: 'Product', title: 'One-dial lamp', body: 'One dial, no app.', imageUrl: img('product-lamp'), alt: 'A desk lamp', href: '/services/engineering', buttonLabel: 'See the product' },
];

const LOGO_NAMES = ['Northwind', 'Fabrikam', 'Contoso', 'Tailspin', 'Litware', 'Adatum', 'Proseware', 'Woodgrove'];

const libraryLayouts: PageDefinition = {
  path: '/library/layouts',
  slug: 'layouts',
  title: 'More layouts — block library',
  excerpt: 'More layouts for blocks you already have: questions, cards, counters, calls to action and logos.',
  template: 'library',
  seo: LIBRARY_SEO,
  blocks: blocks('lib-ly', [
    libraryIntro('More layouts', [
      'The same blocks as the other library pages, drawn differently. Each layout here is an option in the block’s own settings, not a separate block.',
      HOW_TO,
    ]),
    b('faq', { eyebrow: 'Questions', title: 'Filled boxes, with a chevron', style: 'filled', icon: 'chevron', items: FAQ_ITEMS }),
    b('faq', { title: 'All in one panel', style: 'contained', tone: 'raised', items: FAQ_ITEMS }),
    b('faq', { title: 'Outlined boxes, with an arrow', style: 'outlined', icon: 'arrow', items: FAQ_ITEMS }),
    b('cardGrid', { variant: 'rows', eyebrow: 'Services', title: 'Rows with a checklist', hover: 'zoom', cards: SERVICE_ROWS }),
    b('cardGrid', { variant: 'overlay', eyebrow: 'Work', title: 'Text over a picture', columns: 3, hover: 'zoom', shadow: true, cards: PICTURE_CARDS.slice(0, 3) }),
    b('cardGrid', { variant: 'overlay', title: 'Every other column lower', columns: 3, offset: true, cards: PICTURE_CARDS }),
    b('cardGrid', { variant: 'imageCards', title: 'Image cards that lift, offset', columns: 4, offset: true, hover: 'lift', cards: PICTURE_CARDS.slice(0, 4) }),
    b('cardGrid', { variant: 'icons', eyebrow: 'Features', title: 'Outlined icons beside the text', iconStyle: 'outlined', iconPosition: 'left', columns: 3, cards: featureCards() }),
    b('cardGrid', { variant: 'icons', title: 'Icons floating over cards', iconStyle: 'circle', iconPosition: 'floating', shadow: true, hover: 'lift', tone: 'raised', columns: 3, cards: featureCards() }),
    b('cardGrid', { variant: 'icons', title: 'Icons on their own', iconStyle: 'plain', columns: 3, cards: featureCards() }),
    b('stats', {
      variant: 'counters',
      eyebrow: 'Counters',
      title: 'Numbers that count up',
      intro: 'They count once, when they first scroll into view.',
      items: [
        { value: '140', unit: '+', label: 'Launches', iconUrl: img('app-icon') },
        { value: '12', label: 'Years in business', iconUrl: img('app-icon') },
        { value: '98', unit: '%', label: 'Clients who come back', iconUrl: img('app-icon') },
        { value: '4,200', label: 'Cups of coffee', iconUrl: img('app-icon') },
      ],
    }),
    b('stats', {
      variant: 'counters',
      title: 'Icons beside the numbers, no counting',
      tone: 'raised',
      iconPosition: 'left',
      countUp: false,
      items: [
        { value: '15', label: 'People', iconUrl: img('app-icon') },
        { value: '3', label: 'Studios', iconUrl: img('app-icon') },
        { value: '24', unit: 'h', label: 'Reply time', iconUrl: img('app-icon') },
      ],
    }),
    b('cta', { variant: 'inline', eyebrow: 'Call to action', title: 'Have a project in mind?', body: 'Tell us about it — we reply within a working day.', links: [{ label: 'Start a project', href: '/contact' }, { label: 'See our work', href: '/services' }] }),
    b('logoWall', { eyebrow: 'Clients', title: 'Lines between cells', style: 'grid', columns: 4, logos: LOGO_NAMES.map((name) => ({ name })) }),
    b('logoWall', { title: 'No cells, a name under each logo', style: 'plain', captions: true, columns: 6, logos: LOGO_NAMES.slice(0, 6).map((name) => ({ name, imageUrl: img('app-icon') })) }),
    b('postList', { eyebrow: 'Writing', title: 'A list, two at a time', variant: 'list', limit: 6, pagination: 'more', perPage: 2 }),
    b('postList', { title: 'Minimal — titles and dates', variant: 'minimal', limit: 6 }),
    b('postList', { title: 'Text over the cover', variant: 'overlay', limit: 3, tone: 'raised' }),
    b('postList', { title: 'Compact, with page numbers', variant: 'compact', limit: 6, pagination: 'pages', perPage: 2 }),
    b('postList', { title: 'Wide — one post per row', variant: 'wide', limit: 2 }),
    b('carousel', {
      mode: 'quotes',
      eyebrow: 'Testimonials',
      title: 'What clients say',
      indicator: 'numbers',
      arrows: 'corner',
      slides: [
        { body: 'They shipped in ten weeks what our last agency could not ship in a year, and they told us early when something would not work.', title: 'Maya Lindqvist', caption: 'Head of product, Northwind', imageUrl: img('person-2') },
        { body: 'Every fortnight we saw real work in front of real customers. There were no surprises at launch.', title: 'Tom Okafor', caption: 'CTO, Fabrikam', imageUrl: img('person-4') },
        { body: 'The design system they left behind is still how our own team builds, three years later.', title: 'Priya Raman', caption: 'Design lead, Contoso', imageUrl: img('person-3') },
      ],
    }),
    b('carousel', {
      mode: 'hero',
      direction: 'vertical',
      indicator: 'numbers',
      arrows: 'none',
      slides: [
        { eyebrow: 'Slider · up and down', title: 'Slides that move vertically', body: 'Numbered pages down the right-hand side.', imageUrl: img('scene-dawn'), alt: 'Hills at dawn', href: '/about', buttonLabel: 'About us' },
        { eyebrow: 'Second slide', title: 'Pick a number to jump', imageUrl: img('scene-forest'), alt: 'A forest path', href: '/services', buttonLabel: 'Services' },
        { eyebrow: 'Third slide', title: 'Or use the keyboard', imageUrl: img('scene-night'), alt: 'A city at night', href: '/contact', buttonLabel: 'Contact' },
      ],
    }),
    b('marquee', { kind: 'text', separator: 'star', direction: 'right', hoverSlow: true, speed: 'slow', items: ['Strategy', 'Design', 'Engineering', 'Research'].map((label) => ({ label })) }),
    b('quote', {
      eyebrow: 'Northwind',
      quote: 'The most useful thing they did was tell us which features not to build.',
      name: 'Maya Lindqvist',
      role: 'Head of product, Northwind',
      avatarUrl: img('person-2'),
      avatarPosition: 'above',
      avatarSize: 'large',
    }),
    b('quote', {
      tone: 'raised',
      quote: 'Our release cadence went from quarterly to weekly, and nobody burnt out getting there.',
      name: 'Tom Okafor',
      role: 'CTO, Fabrikam',
      avatarUrl: img('person-4'),
      avatarSize: 'small',
      imageUrl: img('interior-studio'),
      alt: 'The Fabrikam office',
    }),
    b('tabs', {
      eyebrow: 'Tabs',
      title: 'Underlined, down the side, with icons',
      style: 'underline',
      orientation: 'vertical',
      tabs: [
        { label: 'Strategy', iconUrl: img('app-icon'), title: 'Research and positioning', body: 'Interviews, analytics and a one-page plan the whole team can follow.', imageUrl: img('ui-analytics'), alt: 'A reporting dashboard' },
        { label: 'Design', iconUrl: img('app-icon'), title: 'Interfaces and identity', body: 'A design system that stays consistent at any size.', imageUrl: img('ui-dashboard'), alt: 'An app dashboard' },
        { label: 'Engineering', iconUrl: img('app-icon'), title: 'Web and mobile builds', body: 'Fast, accessible products that are easy to change.', imageUrl: img('phone-home'), alt: 'An app on a phone' },
      ],
    }),
    b('tabs', {
      title: 'Large text tabs',
      style: 'text',
      barPosition: 'above',
      tone: 'raised',
      tabs: [
        { label: 'Now', title: 'What we are working on', body: 'Two public-sector services and a hardware launch.' },
        { label: 'Next', title: 'What is coming', body: 'A second studio, and an open-source design kit.' },
        { label: 'Later', title: 'Where we are heading', body: 'Fewer, longer projects with the people we already know.' },
      ],
    }),
    b('newsletter', { layout: 'centered', fieldStyle: 'underline', eyebrow: 'Newsletter', title: 'One useful email a month', body: 'What we learned, what we read, and nothing else.' }),
    b('newsletter', { title: 'A rounded field', fieldStyle: 'pill', tone: 'raised' }),
    b('contactForm', { layout: 'centered', eyebrow: 'Contact', title: 'Tell us about your project', intro: 'A few details now save a long call later.' }),
    b('prose', {
      variant: 'footnotes',
      title: 'Small print',
      html: '<ol><li>Launch figures count every product we shipped between 2014 and 2026.</li><li>“Clients who come back” counts clients with a second project within three years.</li></ol>',
    }),
    // Package 3 upgrades: heading marks and letters, image shapes, icon lists, dividers, the tabs switch.
    b('heading', {
      eyebrow: 'Heading marks',
      title: 'Design that feels effortless',
      highlight: 'effortless',
      highlightStyle: 'circle',
      subtitle: 'Hand-drawn marks around or under the words you pick: a circle here, then a curly underline, a strike-through, a zigzag and a double line below.',
    }),
    b('heading', { align: 'center', size: 'display', textStyle: 'outline', title: 'We build', rotating: ['websites', 'apps', 'brands', 'teams'], rotateEffect: 'slide' }),
    b('heading', { size: 'medium', title: 'Loved by teams who dislike meetings', highlight: 'dislike meetings', highlightStyle: 'curly', rotating: [], subtitle: 'A curly underline.' }),
    b('heading', { size: 'medium', title: 'No surprises on the invoice', highlight: 'surprises', highlightStyle: 'strike', subtitle: 'Struck through.' }),
    b('heading', { size: 'medium', title: 'Fewer steps, faster checkouts', highlight: 'faster checkouts', highlightStyle: 'zigzag', subtitle: 'A zigzag underline, and the heading in gradient letters below.' }),
    b('heading', { size: 'large', textStyle: 'gradient', title: 'Quietly brilliant software', highlight: 'software', highlightStyle: 'double', rotating: ['for clinics', 'for shops', 'for charities'], rotateEffect: 'blur' }),
    b('row', {
      gap: '32px',
      align: 'end',
      columns: [
        { id: 'lib-mask-a', width: { base: 4, mobile: 12 }, blocks: blocks('lib-mask-a', [b('image', { url: img('person-2'), alt: 'Portrait of Maya', mask: 'circle', caption: 'Circle' })]) },
        { id: 'lib-mask-b', width: { base: 4, mobile: 12 }, blocks: blocks('lib-mask-b', [b('image', { url: img('interior-lounge'), alt: 'Armchairs in a sunny lounge', mask: 'arch', caption: 'Arch' })]) },
        { id: 'lib-mask-c', width: { base: 4, mobile: 12 }, blocks: blocks('lib-mask-c', [b('image', { url: img('scene-dawn'), alt: 'Hills at dawn', mask: 'blob', caption: 'Blob' })]) },
      ],
    }),
    b('row', {
      gap: '32px',
      align: 'center',
      columns: [
        { id: 'lib-mask-d', width: { base: 4, mobile: 12 }, blocks: blocks('lib-mask-d', [b('image', { url: img('product-lamp'), alt: 'A desk lamp', mask: 'leaf', caption: 'Leaf' })]) },
        { id: 'lib-mask-e', width: { base: 4, mobile: 12 }, blocks: blocks('lib-mask-e', [b('image', { url: img('arch-tower'), alt: 'A tall tower against the sky', mask: 'hexagon', caption: 'Hexagon' })]) },
        { id: 'lib-mask-f', width: { base: 4, mobile: 12 }, blocks: blocks('lib-mask-f', [b('image', { url: img('scene-ocean'), alt: 'Waves on open water', mask: 'diamond', caption: 'Diamond' })]) },
      ],
    }),
    b('image', { url: img('interior-studio'), alt: 'A bright studio with long desks', size: 'medium', align: 'center', rounded: true, caption: 'A medium-width picture, centred' }),
    b('checkLists', {
      eyebrow: 'Icon lists',
      title: 'What every project includes',
      layout: 'plain',
      icon: 'arrow',
      lists: [
        { title: 'Before launch', items: ['A discovery sprint with real users', { text: 'A design system your team can keep', href: '/services/design', note: 'Delivered in Figma and in code' }, 'Weekly releases you can click'] },
        { title: 'After launch', items: ['Two weeks of hands-on support', 'A handover your team can run with', { text: 'Ongoing care, if you want it', href: '/contact' }] },
      ],
    }),
    b('checkLists', {
      layout: 'inline',
      icon: 'dot',
      lists: [{ items: ['Fixed launch dates', 'Senior people only', 'Your code, your accounts', 'Cancel any month'] }],
    }),
    b('checkLists', {
      title: 'How a project runs',
      layout: 'grid',
      icon: 'number',
      tone: 'raised',
      lists: [{ items: ['Kick-off and interviews', 'A clickable prototype', 'Design and build in weekly steps', 'Testing with real users', 'Launch rehearsal', 'Launch and support'] }],
    }),
    b('checkLists', { layout: 'plain', icon: 'custom', iconUrl: img('icon-leaf'), lists: [{ title: 'How we keep it light', items: ['Hosting on renewable energy', 'Pages under a megabyte', 'No tracking without consent'] }] }),
    b('spacer', { height: '72px', line: 'rule', lineStyle: 'dashed', label: 'Chapter two' }),
    b('spacer', { height: '56px', line: 'accent', lineStyle: 'dotted', lineWidth: 'short', ornament: 'star' }),
    b('spacer', { height: '56px', line: 'rule', lineStyle: 'double', lineWidth: 'wide' }),
    b('spacer', { height: '56px', line: 'accent', lineStyle: 'wave', lineWidth: 'wide', ornament: 'diamond' }),
    b('spacer', { height: '56px', line: 'rule', lineStyle: 'zigzag', lineWidth: 'short', align: 'left' }),
    b('tabs', {
      eyebrow: 'Switch',
      title: 'Two ways to start',
      intro: 'The switch style: a centred toggle for two or three panels, kept as a toggle on phones.',
      style: 'switch',
      tabs: [
        { label: 'For teams', title: 'Join your team', body: 'We work inside your tools and your rituals, and hand over gradually so your people own the product from launch.', imageUrl: img('interior-workshop'), alt: 'Benches in a workshop' },
        { label: 'For founders', title: 'Build it with you', body: 'A small senior team that takes a product from first sketch to launch, and stays on while you hire.', imageUrl: img('scene-dawn'), alt: 'Hills at dawn' },
      ],
    }),
    // Package 3 upgrades, part two: post and project carousels, a featured post, a photo strip, starred testimonials, a video playlist.
    b('postList', { eyebrow: 'From the journal', title: 'Swipe through the latest', variant: 'carousel', limit: 6, columns: 3 }),
    b('postList', { title: 'This week', variant: 'featured', limit: 4, tone: 'raised' }),
    b('projects', { eyebrow: 'Work', title: 'Projects as a carousel', layout: 'carousel', items: PROJECTS, link: { label: 'All projects', href: '/library/showcase' } }),
    b('marquee', { eyebrow: 'Photo strip', title: 'Around the studio', kind: 'photos', photoRatio: '3/4', speed: 'slow', items: PICTURES.map(({ url, caption }) => ({ imageUrl: url, label: caption })) }),
    b('carousel', {
      mode: 'quotes',
      title: 'Rated by the people who hired us',
      tone: 'raised',
      slides: QUOTES.slice(0, 4).map((quote, i) => ({ body: quote, title: PEOPLE[i]![0], caption: PEOPLE[i]![1], imageUrl: img(PEOPLE[i]![2]), rating: [5, 4.5, 5, 4][i] })),
    }),
    b('video', {
      eyebrow: 'Playlist',
      title: 'Three short films',
      source: FILM,
      videoTitle: 'Big Buck Bunny',
      posterUrl: img('scene-forest'),
      playlist: [
        { source: 'https://www.youtube.com/watch?v=eRsGyueVLvQ', videoTitle: 'Sintel', posterUrl: img('scene-night') },
        { source: 'https://www.youtube.com/watch?v=R6MlUcmOul8', videoTitle: 'Tears of Steel', posterUrl: img('arch-tower') },
      ],
      caption: 'Open films by the Blender Foundation (CC BY 3.0). Nothing loads from YouTube until you press play.',
    }),
  ]),
};

/* ── Package 3 widgets ────────────────────────────────────────────────────── */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

const REVIEWS = [
  { name: 'Hannah Okoro', meta: 'Clinic manager', rating: 5, title: 'Calm, clear and quick', text: 'They rebuilt our booking flow in six weeks. Patients stopped calling to ask how it works.', date: 'March 2026', source: 'Google' },
  { name: 'Lukas Brandt', meta: 'Founder, Tailspin', rating: 4.5, text: 'Honest about what would not fit in the budget — and right about it.', date: 'February 2026', source: 'Clutch', avatarUrl: img('person-1') },
  { name: 'Aisha Rahman', meta: 'Head of Digital, Halcyon', rating: 5, title: 'Our own team learned a lot', text: 'Every Friday we saw progress we could click. By launch our developers knew the code as well as they did.', date: 'January 2026', source: 'Google', avatarUrl: img('person-3') },
  { name: 'Tom Okafor', meta: 'Founder, Kestrel', rating: 4, text: 'Good work and good people. The first release slipped a week, but we were told early and knew why.', date: 'December 2025', source: 'Trustpilot', avatarUrl: img('person-4') },
  { name: 'Marta Silva', meta: 'Operations, Everly', rating: 5, text: 'Two years on, the app still runs without drama.', date: 'November 2025', source: 'Google' },
  { name: 'Jon Reyes', meta: 'Product lead', rating: 4.5, title: 'Would hire again', text: 'Clear weekly updates, sensible trade-offs and a design system our team actually uses.', date: 'October 2025', source: 'Clutch', avatarUrl: img('person-2') },
];
const openDays = (days: string[], open: string, close: string) => days.map((day) => ({ day, slots: [{ open, close }] }));
const WEEKDAYS_ONLY = ['mon', 'tue', 'wed', 'thu', 'fri'];

const libraryWidgets: PageDefinition = {
  path: '/library/widgets',
  slug: 'widgets',
  title: 'Widgets — block library',
  excerpt: 'Charts, image hotspots, flip cards, price lists, opening hours, share buttons, reviews and text on a path.',
  template: 'library',
  seo: LIBRARY_SEO,
  blocks: blocks('lib-wg', [
    libraryIntro('Widgets', [
      'Charts drawn from your own numbers, pictures with points to explore, cards that turn over, menus and price lists, opening hours that know whether you are open right now, buttons for sharing a page, reviews with star ratings, and words set along a curve.',
      HOW_TO,
    ]),
    b('chart', {
      eyebrow: 'Charts',
      title: 'Visitors by month',
      intro: 'Columns, two series side by side. Every chart is drawn on the server and carries its numbers as a table for screen readers.',
      series: [{ name: '2025' }, { name: '2026' }],
      rows: MONTHS.map((label, i) => ({ label, values: [[3200, 3900, 4100, 4800, 5200, 6100][i]!, [4100, 4700, 5600, 6300, 7400, 8200][i]!] })),
    }),
    b('chart', {
      title: 'Where our clients are',
      kind: 'bar',
      palette: 'accent',
      suffix: '%',
      series: [{ name: 'Share of clients' }],
      rows: ([['United Kingdom', 38], ['Germany', 21], ['Netherlands', 14], ['United States', 12], ['Nordics', 9], ['Elsewhere', 6]] as const).map(([label, v]) => ({ label, values: [v] })),
    }),
    b('chart', {
      title: 'Weekly active users',
      kind: 'line',
      tone: 'raised',
      series: [{ name: 'Active users' }],
      rows: [1200, 1350, 1300, 1600, 1750, 1720, 1980, 2240].map((v, i) => ({ label: `Week ${i + 1}`, values: [v] })),
    }),
    b('chart', {
      title: 'Revenue and costs',
      kind: 'area',
      height: 'large',
      prefix: '€',
      suffix: 'k',
      series: [{ name: 'Revenue' }, { name: 'Costs' }],
      rows: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'].map((label, i) => ({ label, values: [[410, 460, 520, 610, 640, 720][i]!, [300, 320, 350, 380, 390, 410][i]!] })),
      caption: 'Quarterly figures, rounded to the nearest thousand euros.',
    }),
    b('chart', {
      title: 'Where the time goes on a typical project',
      kind: 'pie',
      suffix: '%',
      series: [{ name: 'Share of time' }],
      rows: ([['Discovery', 15], ['Design', 30], ['Engineering', 40], ['Launch and support', 15]] as const).map(([label, v]) => ({ label, values: [v] })),
    }),
    b('chart', {
      title: 'Where the studio’s power came from last year',
      kind: 'doughnut',
      palette: 'mono',
      height: 'small',
      tone: 'raised',
      suffix: ' MWh',
      series: [{ name: 'used in 2025' }],
      rows: ([['Solar panels on the roof', 22.1], ['Wind contract', 15.4], ['The grid', 10.5]] as const).map(([label, v]) => ({ label, values: [v] })),
    }),
    b('hotspots', {
      eyebrow: 'Image hotspots',
      title: 'Inside the field speaker',
      intro: 'Pulsing dots on a medium-width picture. Click or tap one to open its card; Escape closes it.',
      width: 'medium',
      imageUrl: img('product-speaker'),
      alt: 'A portable speaker',
      points: [
        { x: 50, y: 24, title: 'Carry handle', body: 'Recycled aluminium, tested to carry forty kilos.' },
        { x: 34, y: 56, title: 'Fabric grille', body: 'A water-resistant weave that hoses clean after a muddy weekend.' },
        { x: 66, y: 62, title: 'Controls', body: 'Three large buttons you can press with gloves on.', link: { label: 'See the project', href: '/services/engineering' } },
        { x: 50, y: 84, title: 'Battery', body: 'Thirty hours at medium volume, and it swaps out in a minute.' },
      ],
    }),
    b('hotspots', {
      title: 'A tour of the studio',
      intro: 'Numbered pins with the same points listed beside the picture.',
      tone: 'raised',
      marker: 'number',
      list: true,
      imageUrl: img('interior-studio'),
      alt: 'A bright studio with long desks',
      points: [
        { x: 22, y: 38, title: 'The long desk', body: 'Where the whole team sits on Mondays.' },
        { x: 48, y: 30, title: 'North windows', body: 'Even daylight all day, so screens never glare.' },
        { x: 70, y: 58, title: 'Prototype bench', body: 'Printers, a soldering station and a lot of cardboard.' },
        { x: 86, y: 40, title: 'Quiet room', body: 'Book it for calls, or for an hour of thinking.' },
        { x: 36, y: 72, title: 'Kitchen', body: 'Lunch together on Fridays.', imageUrl: img('interior-lounge') },
      ],
    }),
    b('hotspots', {
      title: 'The harbour pavilion',
      intro: 'Plus signs that open on hover, still and without the pulse.',
      marker: 'plus',
      trigger: 'hover',
      pulse: false,
      imageUrl: img('arch-pavilion'),
      alt: 'A timber pavilion by the water',
      points: [
        { x: 30, y: 44, title: 'Larch cladding', body: 'Left untreated, it silvers in the sea air.' },
        { x: 58, y: 36, title: 'Folded roof', body: 'Sheds rain towards the harbour and shades the benches in summer.' },
        { x: 74, y: 70, title: 'Public deck', body: 'Open to everyone, every day, from sunrise to sunset.' },
      ],
      caption: 'Hover or tap a plus sign.',
    }),
    b('flipBox', {
      eyebrow: 'Flip cards',
      title: 'Three ways to work with us',
      intro: 'Hover the card, or tap or press it, to turn it over.',
      cards: [
        { imageUrl: img('scene-dawn'), title: 'Discovery', text: 'Four weeks', backTitle: 'A discovery sprint', backText: 'Interviews, a working prototype and a plan with dates, in four weeks.', link: { label: 'Plan a sprint', href: '/contact' } },
        { imageUrl: img('interior-workshop'), title: 'A product team', text: 'Three to twelve months', backTitle: 'A team of our own', backText: 'Design, engineering and research people who ship every week.', link: { label: 'Meet the team', href: '/about' } },
        { imageUrl: img('scene-ocean'), title: 'Ongoing care', text: 'Month by month', backTitle: 'After launch', backText: 'Fixes, improvements and a named person who knows your product.', link: { label: 'Talk to us', href: '/contact' } },
      ],
    }),
    b('flipBox', {
      title: 'What you can count on',
      effect: 'slide',
      direction: 'vertical',
      columns: 4,
      height: 'small',
      align: 'left',
      tone: 'raised',
      cards: FEATURES.slice(0, 4).map(([title, body, icon]) => ({ iconUrl: img(icon), title, backText: body })),
    }),
    b('flipBox', {
      title: 'Before you ask',
      effect: 'fade',
      columns: 2,
      height: 'small',
      cards: [
        { title: 'Do you work to a fixed price?', backText: 'For discovery, yes. After that we work in monthly blocks, so you can stop at any time.' },
        { title: 'Can we start small?', backText: 'Most clients start with a four-week sprint and decide what comes next once they have seen it.' },
      ],
    }),
    b('priceList', {
      eyebrow: 'Price list',
      title: 'Coffee and breakfast',
      intro: 'One column, with dotted leaders, badges and tags.',
      groups: [
        {
          title: 'Coffee',
          items: [
            { name: 'Espresso', price: '€2.60', description: 'A double shot of the house blend.' },
            { name: 'Flat white', price: '€3.40', badge: 'Popular', description: 'A double shot with silky milk.' },
            { name: 'Filter of the week', price: '€3.20', description: 'Ask what we are brewing today.', tags: ['Single origin'] },
          ],
        },
        {
          title: 'Breakfast',
          note: 'Served until 11:30.',
          items: [
            { name: 'Sourdough toast', price: '€4.50', description: 'Cultured butter and seasonal jam.', tags: ['Vegetarian'] },
            { name: 'Granola bowl', price: '€6.80', description: 'Yoghurt, fruit and toasted oats.', tags: ['Vegetarian', 'Nut-free'] },
            { name: 'Eggs on toast', price: '€8.20', description: 'Two eggs, any style.' },
          ],
        },
      ],
      footnote: 'Oat and soy milk at no extra cost. Ask us about allergens.',
    }),
    b('priceList', {
      title: 'Workshop prices',
      layout: 'columns',
      leader: 'line',
      tone: 'raised',
      groups: [
        {
          title: 'Half-day sessions',
          items: [
            { name: 'Product review', price: '€900', description: 'Two of us go through your product and write up what we find.' },
            { name: 'Design critique', price: '€750', description: 'Bring your team and your screens; leave with a list.' },
            { name: 'Research planning', price: '€750', description: 'Who to talk to, what to ask and how to share it.' },
          ],
        },
        {
          title: 'Full-day sessions',
          items: [
            { name: 'Roadmap day', price: '€1,600', description: 'Turn a long wish-list into three months of work.' },
            { name: 'Design sprint', price: '€1,800', badge: 'New', description: 'From problem to a tested prototype in a day.' },
            { name: 'Team training', price: 'from €1,400', description: 'Accessibility, design systems or product analytics.' },
          ],
        },
      ],
    }),
    b('priceList', {
      title: 'The studio shop',
      intro: 'Cards with photos, one group at a time behind tabs.',
      layout: 'cards',
      leader: 'none',
      groupNav: 'tabs',
      groups: [
        {
          title: 'For the home',
          items: [
            { name: 'One-dial lamp', price: '€189', badge: 'New', imageUrl: img('product-lamp'), description: 'A desk lamp with one dial and no app.' },
            { name: 'Field speaker', price: '€249', imageUrl: img('product-speaker'), description: 'Rugged, loud and thirty hours on a charge.', tags: ['Waterproof'] },
            { name: 'Studio watch', price: '€320', imageUrl: img('product-watch'), description: 'A calm face and a strap that lasts.' },
          ],
        },
        {
          title: 'Phones',
          items: [
            { name: 'Phone, graphite', price: '€699', imageUrl: img('product-graphite'), description: 'Our companion-app test phone, in a dark matte finish.' },
            { name: 'Phone, sand', price: '€699', imageUrl: img('product-sand'), description: 'The same phone in a warm sand colour.', tags: ['Limited run'] },
          ],
        },
      ],
    }),
    b('businessHours', {
      eyebrow: 'Opening hours',
      title: 'When you can visit the studio',
      intro: 'Today is marked, and the line at the top says whether we are open right now, in London time.',
      timeZone: 'Europe/London',
      week: [...openDays(WEEKDAYS_ONLY, '09:00', '17:30'), ...openDays(['sat'], '10:00', '14:00')],
      notes: [
        { label: '24 – 26 December', text: 'Closed' },
        { label: '31 December', text: '10:00 – 13:00' },
      ],
    }),
    b('businessHours', {
      title: 'The café downstairs',
      intro: 'The card style: the live status runs across the top, and Sunday has a lunch break.',
      style: 'card',
      tone: 'raised',
      week: [...openDays([...WEEKDAYS_ONLY, 'sat'], '07:30', '16:00'), { day: 'sun', slots: [{ open: '09:00', close: '12:00' }, { open: '13:00', close: '15:00' }] }],
      link: { label: 'Get directions', href: '/contact' },
    }),
    b('businessHours', {
      title: 'The late bar',
      intro: 'Compact, a 12-hour clock, the week from Sunday, and hours that run past midnight.',
      style: 'compact',
      clock: '12h',
      firstDay: 'sun',
      merge: false,
      week: [...openDays(['wed', 'thu'], '18:00', '00:00'), ...openDays(['fri', 'sat'], '18:00', '02:00')],
    }),
    b('share', { title: 'Share this page' }),
    b('share', { style: 'icons', brandColors: true, align: 'center', tone: 'raised', networks: ['x', 'linkedin', 'facebook', 'whatsapp', 'reddit', 'telegram', 'email', 'copy', 'native'] }),
    b('share', { title: 'Pass it on', style: 'outlined', size: 'large', networks: ['linkedin', 'x', 'email', 'copy'] }),
    b('share', { title: 'Share', style: 'text', align: 'right', size: 'small', networks: ['x', 'linkedin', 'facebook', 'email'] }),
    b('reviews', {
      eyebrow: 'Reviews',
      title: 'What clients say about working with us',
      summary: { rating: 4.8, count: '126 reviews', label: 'on Google', link: { label: 'Read them all', href: '/contact' } },
      items: REVIEWS,
    }),
    b('reviews', {
      title: 'Straight from the people who hired us',
      intro: 'Masonry, with the rating summary in its own column.',
      layout: 'masonry',
      columns: 2,
      summaryPosition: 'side',
      tone: 'raised',
      summary: { rating: 4.7, count: '38 reviews', label: 'on Clutch' },
      items: REVIEWS.slice(0, 5),
    }),
    b('reviews', {
      title: 'Recent reviews',
      layout: 'list',
      items: REVIEWS.slice(2, 5),
      link: { label: 'Leave a review', href: '/contact' },
    }),
    b('textPath', { text: 'Start a project', centerText: '→', href: '/contact', size: 'large' }),
    b('textPath', { text: 'Made slowly, built to last', shape: 'arc', color: 'accent', size: 'large', tone: 'raised' }),
    b('textPath', { text: 'Strategy · Design · Engineering · Research', shape: 'wave' }),
    b('form', {
      eyebrow: 'Form builder',
      title: 'Tell us about your project',
      intro: 'A form with the questions you choose, in steps. Answers are kept in Form submissions in the admin.',
      formName: 'Project brief',
      submitLabel: 'Send the brief',
      successTitle: 'Thank you — your brief is with us.',
      successText: 'A senior person will read it and reply within one working day.',
      fields: [
        { id: 'step-you', type: 'step', label: 'About you' },
        { id: 'name', type: 'text', label: 'Your name', required: true, width: 'half' },
        { id: 'email', type: 'email', label: 'Email', required: true, width: 'half' },
        { id: 'phone', type: 'phone', label: 'Phone', width: 'half', help: 'Only if you would rather talk.' },
        { id: 'company', type: 'text', label: 'Company', width: 'half' },
        { id: 'step-project', type: 'step', label: 'The project' },
        { id: 'kind', type: 'radio', label: 'What do you need?', required: true, options: ['A new product', 'A redesign', 'An extra team', 'Not sure yet'] },
        { id: 'areas', type: 'checkboxes', label: 'Which parts?', options: ['Strategy', 'Design', 'Engineering', 'Research'] },
        { id: 'budget', type: 'select', label: 'Budget', width: 'half', placeholder: 'Choose a range', options: ['Under €25k', '€25k – €75k', '€75k – €200k', 'Over €200k'] },
        { id: 'start', type: 'date', label: 'Ideal start', width: 'half' },
        { id: 'step-details', type: 'step', label: 'Details' },
        { id: 'message', type: 'textarea', label: 'Tell us more', required: true, placeholder: 'Goals, deadlines, anything we should know…' },
        { id: 'consent', type: 'consent', label: 'I agree to be contacted about this brief.', required: true },
      ],
    }),
    b('form', {
      title: 'Book a studio visit',
      layout: 'plain',
      tone: 'raised',
      formName: 'Studio visit',
      submitLabel: 'Request a visit',
      fields: [
        { id: 'name', type: 'text', label: 'Name', required: true, width: 'half' },
        { id: 'email', type: 'email', label: 'Email', required: true, width: 'half' },
        { id: 'people', type: 'number', label: 'How many people?', width: 'half' },
        { id: 'day', type: 'select', label: 'Which open day?', width: 'half', options: ['First Friday of next month', 'The one after'] },
      ],
    }),
  ]),
};

/* ── Package 3 navigation ─────────────────────────────────────────────────── */

const GUIDE_HTML = [
  '<h2>Agree the date first</h2>',
  '<p>A launch date is the one decision everything else can be planned around. Pick it on day one, tell everyone, and let the scope bend to meet it — not the other way round.</p>',
  '<h3>Why a date, not a scope</h3>',
  '<p>Scope always grows. A fixed date turns every new idea into a question with an answer: does it fit before launch, or does it wait for the next release?</p>',
  '<h2>Decide what not to build</h2>',
  '<p>Write the list of things you will not do in the first release, and share it as widely as the list of things you will. It saves more arguments than any roadmap.</p>',
  '<h2>Rehearse the launch</h2>',
  '<p>Walk through launch day a week early: who presses which button, who watches which dashboard, and who is on call if something goes wrong at six in the evening.</p>',
  '<h3>A checklist for the day</h3>',
  '<p>Redirects in place, analytics checked, the support inbox staffed, the old site kept for a week, and a message ready for anyone who spots a problem.</p>',
  '<h2>After launch</h2>',
  '<p>Plan the first two weeks as carefully as the launch itself. The most useful feedback arrives in the first few days, while everyone still remembers why each decision was made.</p>',
].join('');

const libraryNavigation: PageDefinition = {
  path: '/library/navigation',
  slug: 'navigation',
  title: 'Navigation — block library',
  excerpt: 'Breadcrumbs, search boxes and tables of contents.',
  template: 'library',
  seo: LIBRARY_SEO,
  blocks: blocks('lib-nav', [
    b('breadcrumbs', {}),
    libraryIntro('Navigation', [
      'Blocks that help visitors find their way: where they are on the site, a search box for the blog, and a table of contents that follows them down a long page. The trail above is this page’s own, the same one search engines are given.',
      HOW_TO,
    ]),
    b('breadcrumbs', { style: 'pill', separator: 'slash', tone: 'raised' }),
    b('breadcrumbs', {
      source: 'custom',
      style: 'boxed',
      separator: 'arrow',
      align: 'center',
      items: [
        { label: 'Services', href: '/services' },
        { label: 'Product design', href: '/services/design' },
      ],
      current: 'Design systems',
    }),
    b('search', { title: 'Search the journal', intro: 'Find articles by topic, client or technique.', suggestionsLabel: 'Popular:', suggestions: ['Design systems', 'Accessibility', 'Research'] }),
    b('search', { title: 'What are you looking for?', style: 'pill', size: 'large', align: 'center', tone: 'raised', placeholder: 'Try “launch checklist”' }),
    b('search', { title: 'Search', style: 'underline', buttonLabel: 'Go' }),
    b('search', { style: 'minimal', size: 'small', placeholder: 'Search articles…' }),
    b('row', {
      gap: '48px',
      align: 'stretch',
      columns: [
        {
          id: 'lib-nav-row-a',
          width: { base: 4, tablet: 12 },
          blocks: blocks('lib-nav-row-a', [b('toc', { title: 'In this guide', scope: 'row', sticky: true })]),
        },
        {
          id: 'lib-nav-row-b',
          width: { base: 8, tablet: 12 },
          blocks: blocks('lib-nav-row-b', [b('prose', { eyebrow: 'Table of contents', title: 'A guide to planning a launch', html: GUIDE_HTML })]),
        },
      ],
    }),
    b('toc', { title: 'Everything on this page', style: 'numbered', levels: 'h2', collapsible: true, tone: 'raised' }),
    b('toc', { title: 'On this page', style: 'list', levels: 'h2' }),
  ]),
};

/* ── Package 3 effects ────────────────────────────────────────────────────── */

const libraryEffects: PageDefinition = {
  path: '/library/effects',
  slug: 'effects',
  title: 'Effects — block library',
  excerpt: 'Entrances, hover effects, shape dividers, gradient backgrounds, sticky blocks and snapping, and Lottie animations.',
  template: 'library',
  seo: LIBRARY_SEO,
  blocks: blocks('lib-fx', [
    libraryIntro('Effects', [
      'Effects are not blocks of their own: they are in every block’s Design tab, so any section on any page can use them. The strip above each example names the effects it uses.',
      'Entrances play once as a section scrolls into view, and never for visitors who ask for less motion. Hover effects answer a mouse; touch screens see the block at rest.',
    ]),
    b('heading', { eyebrow: 'Entrance', title: 'This heading zooms in', subtitle: 'Scroll down slowly to see each entrance play.' }, { reveal: 'zoom' }),
    b('cardGrid', { title: 'These cards slide in from the left', columns: 3, variant: 'icons', cards: featureCards(3) }, { reveal: 'left' }),
    b('cardGrid', { title: 'And these from the right, a moment later', columns: 3, variant: 'icons', cards: featureCards(6).slice(3) }, { reveal: 'right', revealDelay: 200 }),
    b('stats', { variant: 'counters', title: 'Numbers that blur in', items: [{ value: '140', label: 'launches' }, { value: '12', label: 'years' }, { value: '96', unit: '%', label: 'on time' }] }, { reveal: 'blur', revealDelay: 100 }),
    b('row', {
      gap: '24px',
      align: 'stretch',
      columns: (['lift', 'grow', 'shadow', 'tilt'] as const).map((hover, i) => ({
        id: `lib-fx-hover-${hover}`,
        width: { base: 3, tablet: 6, mobile: 12 },
        blocks: blocks(`lib-fx-hover-${hover}`, [
          b('image', { url: img(['interior-lounge', 'interior-workshop', 'arch-pavilion', 'scene-dawn'][i]!), alt: '', rounded: true, caption: `Hover — ${hover === 'tilt' ? 'tilts towards the pointer' : hover}` }, { hover }),
        ]),
      })),
    }),
    // 2.15 — a synced saved block, placed by reference; the demo seed creates it.
    b('savedBlock', { savedBlockId: DEMO_SAVED_BLOCK_ID, name: 'Demo call to action' }),
    b(
      'cta',
      { eyebrow: 'Shape dividers', title: 'A wave along the top and a curve along the bottom', body: 'Drawn in the neighbouring section’s colour, so the edge between two sections takes a shape.', links: [link('Start a project', '/contact')] },
      { shapeTop: { kind: 'wave' }, shapeBottom: { kind: 'curve', height: 'small' } },
    ),
    b(
      'heading',
      { align: 'center', eyebrow: 'Gradient background', title: 'A background that drifts slowly', subtitle: 'An animated gradient from three colours, still for visitors who ask for less motion. A zigzag runs along the bottom.' },
      { background: { gradient: { from: '#2a1846', via: '#b8321d', to: '#e5a23a', angle: '135', animate: true } }, shapeBottom: { kind: 'zigzag', height: 'small' }, spacing: { base: { paddingTop: '48px', paddingBottom: '64px' } } },
    ),
    b(
      'mediaBand',
      { imageUrl: img('scene-ocean'), alt: 'Waves on open water', title: 'A tilt above, an arrow below', height: 'short', position: 'center', links: [] },
      { shapeTop: { kind: 'tilt', height: 'large' }, shapeBottom: { kind: 'arrow', height: 'small', flip: true } },
    ),
    b('row', {
      gap: '48px',
      align: 'stretch',
      columns: [
        {
          id: 'lib-fx-sticky-a',
          width: { base: 4, tablet: 12 },
          blocks: blocks('lib-fx-sticky-a', [b('notice', { kind: 'info', title: 'Sticky', text: 'This message stays in view while the text beside it scrolls past.' }, { sticky: true })]),
        },
        {
          id: 'lib-fx-sticky-b',
          width: { base: 8, tablet: 12 },
          blocks: blocks('lib-fx-sticky-b', [b('prose', { eyebrow: 'Sticky blocks', title: 'Keep the important thing in view', html: GUIDE_HTML })]),
        },
      ],
    }),
    b('heading', { align: 'center', eyebrow: 'Snapping', title: 'The page settles here', subtitle: 'Stop scrolling near this block and the page lines it up under the header.' }, { snap: true, background: { color: '#2d2b2b' } }),
    b('heading', {
      eyebrow: 'Lottie',
      title: 'Animations from a file',
      subtitle:
        'A Lottie block plays an animation exported as JSON and uploaded to the media library — on a loop, once as it comes into view, on hover, or tied to the scroll. Visitors who ask for less motion see a single still frame.',
    }),
    b('row', {
      gap: '24px',
      align: 'stretch',
      columns: (
        [
          ['loop', 'lottie-orbit', 'first', 'On a loop while in view', 'Three dots circling a pulsing centre', 400],
          ['once', 'lottie-done', 'last', 'Once, as it comes into view', 'A tick drawn inside a red circle', 400],
          ['hover', 'lottie-growth', 'first', 'On hover, backwards as you leave', 'A bar chart rising, with an upward trend line', 300],
        ] as const
      ).map(([play, name, still, caption, label, height]) => ({
        id: `lib-fx-lottie-${play}`,
        width: { base: 4, tablet: 4, mobile: 12 },
        blocks: blocks(`lib-fx-lottie-${play}`, [b('lottie', { url: anim(name), play, still, size: 'full', caption, label, width: 400, height })]),
      })),
    }),
    b('lottie', {
      eyebrow: 'Lottie · scroll',
      title: 'This route follows the scroll',
      intro: 'Scroll up and down: the line draws and undraws with the page, and the pin drops at the end.',
      url: anim('lottie-route'),
      play: 'scroll',
      size: 'medium',
      label: 'A winding route drawn to a map pin',
      width: 400,
      height: 400,
    }),
    b('heading', {
      eyebrow: 'Popups',
      title: 'Popups, built from blocks',
      subtitle:
        'Popups are made in Popups in the admin, from the same blocks as a page. On this page a small one appears in the corner after eight seconds, and a bar along the bottom once you have scrolled part of the way. The buttons open the others: a link to #popup-name opens a popup from anywhere on the site.',
    }),
    b('buttons', {
      items: [
        { label: 'Centred sign-up', href: '#popup-newsletter', style: 'primary' },
        { label: 'Side panel', href: '#popup-hours', style: 'outline' },
        { label: 'Full screen', href: '#popup-full', style: 'outline' },
        { label: 'The corner one', href: '#popup-studio-tour', style: 'soft' },
      ],
    }),
  ]),
};

/* ── Everything the demo seed writes ──────────────────────────────────────── */

export const demoStarterPages: (PageDefinition & { summary?: string })[] = [
  home,
  about,
  services,
  serviceStrategy,
  serviceDesign,
  serviceEngineering,
  contact,
  privacy,
];

export const demoLibraryPages: PageDefinition[] = [
  libraryIndex,
  libraryOpeners,
  librarySliders,
  libraryContent,
  libraryCollections,
  libraryMotion,
  libraryConversion,
  libraryElements,
  libraryShowcase,
  libraryLayouts,
  libraryWidgets,
  libraryNavigation,
  libraryEffects,
];

export const demoPages = [...demoStarterPages, ...demoLibraryPages, ...demoTemplatePages];
