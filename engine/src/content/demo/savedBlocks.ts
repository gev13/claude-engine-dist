import type { AnyBlock } from '@/lib/blocks';

/* The demo's saved block (2.15): one synced call-to-action band, referenced
   from the block library's Effects page. A fixed id, so the library page's
   reference points at it on every site the demo is seeded into. */

export const DEMO_SAVED_BLOCK_ID = '5a7ed0b1-0c7a-4000-8000-00000000d3a0';

export const demoSavedBlock = {
  id: DEMO_SAVED_BLOCK_ID,
  name: 'Demo call to action',
  description: 'The band that closes a page — change it once here and every page using it follows.',
  category: 'Calls to action',
  mode: 'synced' as const,
  tree: [
    {
      id: 'demo-saved-cta',
      type: 'cta',
      props: {
        eyebrow: 'A saved block',
        title: 'Got a project? Drop us a line',
        body: 'This band is a synced saved block: every page that uses it shows this, and editing it once changes all of them.',
        links: [{ label: 'Start a project', href: '/contact' }],
      },
    },
  ] as AnyBlock[],
};
