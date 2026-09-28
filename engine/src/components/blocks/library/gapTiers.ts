import type React from 'react';

/**
 * 3.13 — a grid's gap, with its own values on tablets and phones.
 *
 * A gap written inline cannot be overridden by a media query, so while only
 * the one value is set it stays inline (the markup every existing site has);
 * once a tablet or phone value is set, all of them travel as custom
 * properties, each switched on by its own class (library-upgrades.css).
 */
export function gapTiers(p: { gap?: string; gapTablet?: string; gapMobile?: string }): { style?: React.CSSProperties; className?: string } {
  if (!p.gapTablet && !p.gapMobile) return p.gap ? { style: { gap: p.gap } } : {};
  const style: Record<string, string> = {};
  const classes = ['he-gap-tiers'];
  if (p.gap) (style['--he-g'] = p.gap), classes.push('has-g');
  if (p.gapTablet) (style['--he-g-t'] = p.gapTablet), classes.push('has-gt');
  if (p.gapMobile) (style['--he-g-m'] = p.gapMobile), classes.push('has-gm');
  return { style: style as React.CSSProperties, className: classes.join(' ') };
}
