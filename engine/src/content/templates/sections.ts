import { ICONS, THREE_PLANS, WEEKDAYS, img, logos, openDays, person } from './shared';
import { type SectionTemplate, b, link } from './types';

/* ═══════════════════════════════════════════════════════════════════════════
   Ready sections — one to three blocks that belong together, already filled
   in, to add to any page from Add block → Ready sections. An opening hero
   arrives as the page's h1 only when the page has none yet; otherwise the
   builder turns it into an h2.
   ═══════════════════════════════════════════════════════════════════════════ */

export const SECTION_TEMPLATES: SectionTemplate[] = [
  {
    id: 'hero-photo',
    name: 'Opening over a photo',
    group: 'Openers',
    description: 'A tall photo with the headline, a line of text and two buttons.',
    blocks: [
      b('hero', {
        variant: 'mediaBottomLeft',
        eyebrow: 'A short line above the headline',
        title: 'Say what you do in one confident sentence',
        lede: 'A second sentence that tells people who it is for and why it matters.',
        links: [link('Main action', '/contact'), link('Second action', '/about', 'outline')],
        imageUrl: img('scene-dusk'),
        alt: 'Hills at dusk',
        height: 'tall',
        overlay: 'medium',
      }),
    ],
  },
  {
    id: 'hero-split',
    name: 'Opening beside a picture',
    group: 'Openers',
    description: 'Headline and buttons on one side, a picture on the other.',
    blocks: [
      b('hero', {
        variant: 'split',
        eyebrow: 'A short line above the headline',
        title: 'A clear promise, next to a picture that proves it',
        lede: 'One or two sentences about what people get.',
        links: [link('Main action', '/contact'), link('Learn more', '/about', 'outline')],
        imageUrl: img('interior-studio'),
        alt: 'A bright studio',
      }),
    ],
  },
  {
    id: 'features-icons',
    name: 'Three reasons with icons',
    group: 'Features',
    description: 'Three short benefits, each with an icon and a line of text.',
    blocks: [
      b('cardGrid', {
        variant: 'icons',
        eyebrow: 'Why us',
        title: 'Three reasons people choose us',
        columns: 3,
        cards: [
          { title: 'Quick to start', body: 'Up and running in a day, with help at every step.', imageUrl: ICONS.bolt },
          { title: 'Safe by default', body: 'Your data stays yours, protected and backed up.', imageUrl: ICONS.shield },
          { title: 'Always on time', body: 'Dates we agree are dates we keep.', imageUrl: ICONS.clock },
        ],
      }),
    ],
  },
  {
    id: 'story-split',
    name: 'Story beside a picture',
    group: 'Features',
    description: 'A heading, two paragraphs and a link beside a picture.',
    blocks: [
      b('splitMedia', {
        eyebrow: 'Our story',
        title: 'Why we started, in two short paragraphs',
        body: 'Tell the moment it began: the problem you saw and why nobody was solving it well.\n\nThen say what you do differently today, and what someone gets by choosing you.',
        links: [link('More about us', '/about')],
        imageUrl: img('interior-workshop'),
        alt: 'A workshop in daylight',
        shape: 'organic',
      }),
    ],
  },
  {
    id: 'steps',
    name: 'How it works, in four steps',
    group: 'Features',
    description: 'A numbered process from first contact to result.',
    blocks: [
      b('numberedList', {
        variant: 'steps',
        eyebrow: 'How it works',
        title: 'Four steps from hello to done',
        items: [
          { title: 'Get in touch', body: 'Tell us what you need in a few lines.' },
          { title: 'Get a plan', body: 'A clear proposal with a price and a date.' },
          { title: 'We get to work', body: 'Regular updates, no surprises.' },
          { title: 'Enjoy the result', body: 'And support for as long as you need it.' },
        ],
      }),
    ],
  },
  {
    id: 'logos',
    name: 'Logos of clients',
    group: 'Proof',
    description: 'A row of client or partner logos.',
    blocks: [b('logoWall', { eyebrow: 'Trusted by', title: 'Teams that rely on us', columns: 6, logos: logos(6) })],
  },
  {
    id: 'testimonial',
    name: 'One strong testimonial',
    group: 'Proof',
    description: 'A single quote with a portrait and a picture.',
    blocks: [
      b('quote', {
        eyebrow: 'Client story',
        quote: 'A sentence from a happy customer that says what changed for them — in their words, not yours.',
        name: 'Alex Morgan',
        role: 'Role, Company',
        avatarUrl: person(4),
        imageUrl: img('interior-lounge'),
        alt: 'A warm lounge',
      }),
    ],
  },
  {
    id: 'reviews',
    name: 'Reviews with a rating',
    group: 'Proof',
    description: 'An average rating and three reviews.',
    blocks: [
      b('reviews', {
        eyebrow: 'Reviews',
        title: 'What customers say',
        summary: { rating: 4.8, count: '200 reviews', label: 'on Google' },
        items: [
          { name: 'Sam R.', rating: 5, text: 'Friendly, quick and exactly what we asked for.', date: 'June 2026', source: 'Google' },
          { name: 'Lea K.', rating: 5, text: 'We would recommend them to anyone.', date: 'May 2026', source: 'Google' },
          { name: 'Omar H.', rating: 4.5, text: 'Great result, and they kept us informed all the way.', date: 'May 2026', source: 'Google' },
        ],
      }),
    ],
  },
  {
    id: 'figures',
    name: 'Numbers that count up',
    group: 'Proof',
    description: 'Four figures that count up as they come into view.',
    blocks: [
      b('stats', {
        variant: 'counters',
        title: 'In numbers',
        items: [
          { value: '250', unit: '+', label: 'Happy clients' },
          { value: '15', label: 'Years in business' },
          { value: '98', unit: '%', label: 'Would recommend us' },
          { value: '24', unit: 'h', label: 'Reply time' },
        ],
      }),
    ],
  },
  {
    id: 'pricing',
    name: 'Three plans',
    group: 'Selling',
    description: 'Three pricing plans with a monthly and yearly switch.',
    blocks: [
      b('pricing', {
        eyebrow: 'Pricing',
        title: 'Simple plans, no surprises',
        billing: 'switch',
        yearlyNote: 'Save 20%',
        plans: THREE_PLANS,
        footnote: 'Prices include VAT. Cancel any time.',
      }),
    ],
  },
  {
    id: 'faq',
    name: 'Common questions',
    group: 'Selling',
    description: 'Four questions and answers that open one at a time.',
    blocks: [
      b('faq', {
        eyebrow: 'FAQ',
        title: 'Questions people ask us',
        items: [
          { question: 'How long does it take?', answer: 'Most work is done within two weeks. We agree a date before we start.' },
          { question: 'What does it cost?', answer: 'Every plan has a fixed price. You will never get a bill you did not expect.' },
          { question: 'Can I change my mind?', answer: 'Yes — cancel or change your plan at any time.' },
          { question: 'How do I get help?', answer: 'Email or call us; a real person replies within a working day.' },
        ],
      }),
    ],
  },
  {
    id: 'cta-band',
    name: 'Big call to action',
    group: 'Selling',
    description: 'A large closing line with one button.',
    blocks: [b('cta', { variant: 'big', eyebrow: 'Ready when you are', title: 'One line that makes people want to start', links: [link('Get started', '/contact')] })],
  },
  {
    id: 'newsletter',
    name: 'Newsletter sign-up',
    group: 'Selling',
    description: 'A centred sign-up for your mailing list.',
    blocks: [
      b('newsletter', {
        layout: 'centered',
        fieldStyle: 'underline',
        eyebrow: 'Newsletter',
        title: 'One useful email a month',
        body: 'What is new, and nothing else. Leave whenever you like.',
      }),
    ],
  },
  {
    id: 'team',
    name: 'The team',
    group: 'People and places',
    description: 'Four people with photos, roles and a line about each.',
    blocks: [
      b('team', {
        eyebrow: 'Team',
        title: 'The people behind it',
        columns: 4,
        members: [
          { name: 'Name Surname', role: 'Founder', bio: 'One line about what they bring.', imageUrl: person(1) },
          { name: 'Name Surname', role: 'Design', bio: 'One line about what they bring.', imageUrl: person(2) },
          { name: 'Name Surname', role: 'Operations', bio: 'One line about what they bring.', imageUrl: person(3) },
          { name: 'Name Surname', role: 'Support', bio: 'One line about what they bring.', imageUrl: person(4) },
        ],
      }),
    ],
  },
  {
    id: 'hours-map',
    name: 'Opening hours and a map',
    group: 'People and places',
    description: 'Opening hours with an open-now line, then a map with the address.',
    blocks: [
      b('businessHours', {
        eyebrow: 'Visit us',
        title: 'Opening hours',
        style: 'card',
        week: [...openDays(WEEKDAYS, '09:00', '18:00'), ...openDays(['sat'], '10:00', '14:00')],
      }),
      b('map', {
        title: 'Where to find us',
        layout: 'split',
        address: '1 Example Street\nYour City',
        lat: 51.5138,
        lng: -0.0984,
        details: [{ label: 'Phone', value: '+00 000 000 000' }],
      }),
    ],
  },
  {
    id: 'contact',
    name: 'Contact form beside a picture',
    group: 'Contact',
    description: 'The contact form with a short introduction and a picture.',
    blocks: [
      b('contactForm', {
        layout: 'split',
        eyebrow: 'Contact',
        title: 'Tell us what you need',
        intro: 'A few lines is plenty. We reply within one working day.',
        imageUrl: img('interior-lounge'),
        alt: 'A warm lounge',
      }),
    ],
  },
  {
    id: 'booking',
    name: 'Booking request form',
    group: 'Contact',
    description: 'A form for booking requests — a date, a time and details; answers go to Form submissions.',
    blocks: [
      b('form', {
        eyebrow: 'Bookings',
        title: 'Request a booking',
        intro: 'Choose a day and time and we will confirm by email.',
        formName: 'Booking request',
        submitLabel: 'Send the request',
        successTitle: 'Thank you — your request is with us.',
        successText: 'We will confirm by email shortly.',
        fields: [
          { id: 'name', type: 'text', label: 'Name', required: true, width: 'half' },
          { id: 'email', type: 'email', label: 'Email', required: true, width: 'half' },
          { id: 'date', type: 'date', label: 'Date', required: true, width: 'half' },
          { id: 'time', type: 'select', label: 'Time', required: true, width: 'half', placeholder: 'Choose a time', options: ['Morning', 'Midday', 'Afternoon', 'Evening'] },
          { id: 'notes', type: 'textarea', label: 'Anything else?' },
        ],
      }),
    ],
  },

  /* ── Sliders and heroes (package 4) ─────────────────────────────────────── */
  {
    id: 'hero-cinematic',
    name: 'Cinematic opening',
    group: 'Sliders and heroes',
    description: 'A full-screen picture with restrained type and a scroll cue. Swap in a video in the editor for a film opening.',
    blocks: [
      b('hero', {
        variant: 'mediaCenter',
        eyebrow: '/əˈtenʃn/ · Attention',
        title: 'Own the first impression',
        lede: 'One sentence, held in the middle of the screen, with everything else out of its way.',
        links: [link('See what follows', '#next')],
        imageUrl: img('scene-night'),
        alt: 'A starry sky over dark ridges',
        height: 'screen',
        overlay: 'strong',
        scrollCue: true,
      }),
    ],
  },
  {
    id: 'hero-layered',
    name: 'Layered parallax opening',
    group: 'Sliders and heroes',
    description: 'Three pictures at different depths that separate as the page scrolls and lean towards the pointer.',
    blocks: [
      b('hero', {
        variant: 'layered',
        eyebrow: 'Atelier & workshop',
        title: 'Made to be used, not admired',
        lede: 'Two sentences at most: the pictures are doing the talking here.',
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
    ],
  },
  {
    id: 'slider-split',
    name: 'Split-screen slider',
    group: 'Sliders and heroes',
    description: 'Words on one side, picture on the other, moving in opposite directions, with numbered steps.',
    blocks: [
      b('carousel', {
        mode: 'splitScreen',
        kenBurns: true,
        indicator: 'none',
        slides: [
          {
            eyebrow: '[ One ]',
            title: 'The first thing you do',
            body: 'A sentence or two about this part of the work, and why it matters to the person reading.',
            imageUrl: img('arch-tower'),
            alt: 'A tall structure against the sky',
            href: '/contact',
            buttonLabel: 'Discuss a project',
          },
          {
            eyebrow: '[ Two ]',
            title: 'The second thing you do',
            body: 'Keep each slide to one idea; the picture carries the rest.',
            imageUrl: img('arch-facade'),
            alt: 'A pale stone facade',
            href: '/contact',
            buttonLabel: 'Discuss a project',
          },
          {
            eyebrow: '[ Three ]',
            title: 'The third thing you do',
            body: 'Three or four slides is usually enough before people stop clicking.',
            imageUrl: img('scene-ocean'),
            alt: 'Headlands over a calm sea',
            href: '/contact',
            buttonLabel: 'Discuss a project',
          },
        ],
      }),
    ],
  },
  {
    id: 'slider-chapters',
    name: 'Chapter slider',
    group: 'Sliders and heroes',
    description: 'A full-screen slider whose navigation is the slide titles, with the pictures drifting slowly.',
    blocks: [
      b('carousel', {
        mode: 'hero',
        transition: 'fade',
        indicator: 'chapters',
        arrows: 'none',
        kenBurns: true,
        slides: [
          { eyebrow: 'Chapter one', title: 'Beneath the waves', body: 'A line about this chapter.', imageUrl: img('scene-ocean'), alt: 'Headlands over a calm sea', href: '/services', buttonLabel: 'Read the chapter' },
          { eyebrow: 'Chapter two', title: 'Between the ridges', body: 'A line about this chapter.', imageUrl: img('scene-dusk'), alt: 'Layered mountains at dusk', href: '/services', buttonLabel: 'Read the chapter' },
          { eyebrow: 'Chapter three', title: 'A quieter sky', body: 'A line about this chapter.', imageUrl: img('scene-night'), alt: 'A starry sky over dark ridges', href: '/services', buttonLabel: 'Read the chapter' },
        ],
      }),
    ],
  },
  {
    id: 'slider-filmstrip',
    name: 'Filmstrip gallery',
    group: 'Sliders and heroes',
    description: 'Frames drifting past in perspective; the middle one is sharp and any other can be clicked forward.',
    blocks: [
      b('carousel', {
        mode: 'filmstrip',
        eyebrow: 'Gallery',
        title: 'Selected frames',
        intro: 'Six pictures is a good number: enough to browse, few enough to finish.',
        indicator: 'counter',
        arrows: 'corner',
        slides: [
          { title: 'First frame', imageUrl: img('scene-dawn'), alt: 'Hills at dawn' },
          { title: 'Second frame', imageUrl: img('interior-workshop'), alt: 'A workshop bench in daylight' },
          { title: 'Third frame', imageUrl: img('arch-pavilion'), alt: 'Low buildings among trees' },
          { title: 'Fourth frame', imageUrl: img('product-lamp'), alt: 'A desk lamp casting warm light' },
          { title: 'Fifth frame', imageUrl: img('scene-ocean'), alt: 'Waves on open water' },
          { title: 'Sixth frame', imageUrl: img('scene-night'), alt: 'A starry sky over dark ridges' },
        ],
      }),
    ],
  },
  {
    id: 'slider-editorial',
    name: 'Editorial product slider',
    group: 'Sliders and heroes',
    description: 'One piece at a time with its specifications beside it, thumbnails underneath and an enquiry link.',
    blocks: [
      b('carousel', {
        mode: 'media',
        tone: 'raised',
        eyebrow: 'The collection',
        title: 'One piece at a time',
        intro: 'Specifications sit under the picture, and the thumbnails move between pieces.',
        indicator: 'thumbs',
        arrows: 'side',
        kenBurns: true,
        link: { label: 'Enquire about a piece', href: '/contact' },
        slides: [
          {
            title: 'First piece',
            caption: 'First piece — material and finish',
            imageUrl: img('interior-lounge'),
            alt: 'A warm lounge in the evening',
            specs: [
              { label: 'Category', value: 'Lounge' },
              { label: 'Material', value: 'Shearling, solid oak' },
              { label: 'Size', value: 'H 72 × W 110 × D 85 cm' },
            ],
          },
          {
            title: 'Second piece',
            caption: 'Second piece — material and finish',
            imageUrl: img('product-lamp'),
            alt: 'A desk lamp casting warm light',
            specs: [
              { label: 'Category', value: 'Lighting' },
              { label: 'Material', value: 'Brushed aluminium' },
              { label: 'Size', value: 'H 44 × Ø 18 cm' },
            ],
          },
          {
            title: 'Third piece',
            caption: 'Third piece — material and finish',
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
    ],
  },
  {
    id: 'slider-process',
    name: 'Process slider',
    group: 'Sliders and heroes',
    description: 'The stages of a piece of work, with the stage names as the navigation.',
    blocks: [
      b('carousel', {
        mode: 'media',
        eyebrow: 'How it is made',
        title: 'From first sketch to finished piece',
        indicator: 'chapters',
        arrows: 'none',
        slides: [
          { title: 'Sketch', caption: 'Sketch — loose lines, no rules yet', imageUrl: img('interior-studio'), alt: 'A bright studio' },
          { title: 'Define', caption: 'Define — the shape settles', imageUrl: img('ui-dashboard'), alt: 'A dashboard with a chart' },
          { title: 'Shape', caption: 'Shape — the first real object', imageUrl: img('interior-workshop'), alt: 'A workshop bench in daylight' },
          { title: 'Refine', caption: 'Refine — the last ten per cent', imageUrl: img('product-watch'), alt: 'A wristwatch with a dark dial' },
          { title: 'Result', caption: 'Result — ready to use', imageUrl: img('product-lamp'), alt: 'A desk lamp casting warm light' },
        ],
      }),
    ],
  },
  {
    id: 'carousel-drag',
    name: 'Draggable portfolio carousel',
    group: 'Sliders and heroes',
    description: 'A horizontal row of work that can be pulled sideways by hand as well as swiped.',
    blocks: [
      b('carousel', {
        eyebrow: 'Selected work',
        title: 'Recent projects',
        intro: 'Pull the row sideways, or use the arrows.',
        drag: true,
        indicator: 'counter',
        arrows: 'corner',
        link: { label: 'See everything', href: '/services' },
        slides: [
          { eyebrow: 'Identity', title: 'A harbour pavilion', body: 'Signage and a visitor site.', imageUrl: img('arch-pavilion'), alt: 'Low buildings among trees', href: '/contact', buttonLabel: 'Read the case study' },
          { eyebrow: 'Product', title: 'A one-dial lamp', body: 'Launch site and packaging.', imageUrl: img('product-lamp'), alt: 'A desk lamp casting warm light', href: '/contact', buttonLabel: 'Read the case study' },
          { eyebrow: 'Website', title: 'A shared workshop', body: 'Booking for a makers’ space.', imageUrl: img('interior-workshop'), alt: 'A workshop bench in daylight', href: '/contact', buttonLabel: 'Read the case study' },
          { eyebrow: 'Interiors', title: 'A members’ lounge', body: 'Designed around daylight.', imageUrl: img('interior-lounge'), alt: 'A warm lounge in the evening', href: '/contact', buttonLabel: 'Read the case study' },
          { eyebrow: 'Audio', title: 'A field speaker', body: 'For festivals and building sites.', imageUrl: img('product-speaker'), alt: 'A rounded speaker', href: '/contact', buttonLabel: 'Read the case study' },
        ],
      }),
    ],
  },
];
