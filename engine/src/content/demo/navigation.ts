import type { Navigation } from '@/lib/navigation';
import { demoImageUrl } from './images';

/** Default header and footer menus for the demo pages. */
export const demoNavigation: Navigation = {
  header: [
    {
      id: 'nav-services',
      label: 'Services',
      href: '/services',
      children: [
        { id: 'nav-strategy', label: 'Strategy', href: '/services/strategy', group: 'Services', description: 'Research, positioning and a plan the team can follow.' },
        { id: 'nav-design', label: 'Design', href: '/services/design', group: 'Services', description: 'Interfaces, identity and systems that scale.' },
        { id: 'nav-engineering', label: 'Engineering', href: '/services/engineering', group: 'Services', description: 'Web and mobile products, built to last.' },
        { id: 'nav-all', label: 'All services', href: '/services', group: 'Services' },
        { id: 'nav-studio', label: 'Inside the studio', href: '/about', description: 'How we work, and who you will work with.', imageUrl: demoImageUrl('interior-studio') },
      ],
    },
    { id: 'nav-about', label: 'About', href: '/about' },
    { id: 'nav-blog', label: 'Blog', href: '/blog' },
    { id: 'nav-contact', label: 'Contact', href: '/contact' },
  ],
  headerCta: { label: 'Start a project', href: '/contact' },
  footer: [
    {
      id: 'ft-company',
      title: 'Company',
      items: [
        { id: 'ft-about', label: 'About', href: '/about' },
        { id: 'ft-services', label: 'Services', href: '/services' },
        { id: 'ft-blog', label: 'Blog', href: '/blog' },
        { id: 'ft-contact', label: 'Contact', href: '/contact' },
      ],
    },
    {
      id: 'ft-work',
      title: 'Services',
      items: [
        { id: 'ft-strategy', label: 'Strategy', href: '/services/strategy' },
        { id: 'ft-design', label: 'Design', href: '/services/design' },
        { id: 'ft-engineering', label: 'Engineering', href: '/services/engineering' },
      ],
    },
    {
      id: 'ft-library',
      title: 'Block library',
      items: [
        { id: 'ft-lib', label: 'All blocks', href: '/library' },
        { id: 'ft-lib-openers', label: 'Openers', href: '/library/openers' },
        { id: 'ft-lib-sliders', label: 'Sliders', href: '/library/sliders' },
        { id: 'ft-lib-content', label: 'Content', href: '/library/content' },
        { id: 'ft-lib-collections', label: 'Collections', href: '/library/collections' },
        { id: 'ft-lib-motion', label: 'Scroll effects', href: '/library/scroll-effects' },
        { id: 'ft-lib-conversion', label: 'Calls to action', href: '/library/conversion' },
        { id: 'ft-lib-elements', label: 'Elements', href: '/library/elements' },
        { id: 'ft-lib-showcase', label: 'Media and showcase', href: '/library/showcase' },
        { id: 'ft-lib-layouts', label: 'More layouts', href: '/library/layouts' },
      ],
    },
    { id: 'ft-legal', title: 'Legal', placement: 'legal', items: [{ id: 'ft-privacy', label: 'Privacy', href: '/privacy' }] },
  ],
  footerAddress: '1 Example Street\nLondon EC1A 1AA',
  social: [
    { network: 'linkedin', href: 'https://www.linkedin.com/' },
    { network: 'instagram', href: 'https://www.instagram.com/' },
    { network: 'github', href: 'https://github.com/' },
  ],
};
