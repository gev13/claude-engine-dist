// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FooterExtrasPanel, HeaderExtrasPanel, MotionExtrasPanel } from '../../src/app/(system)/admin/(panel)/appearance/ChromeExtrasPanels';
import { CardHoverFields } from '../../src/components/admin/CardHoverFields';

/* 2.19 — the Appearance controls for the header, footer and site-wide motion,
   and the card hover fields. Each starts at the site's current behaviour and
   writes nothing until changed; a field set back writes `undefined`, so an
   untouched theme row stays untouched. */

afterEach(cleanup);

const recorder = () => {
  const calls: [readonly (string | number)[], unknown][] = [];
  const set = (path: readonly (string | number)[]) => (value: unknown) => calls.push([path, value]);
  return { calls, set };
};

describe('the header panel', () => {
  it('names the defaults and asks for glass settings only for glass', () => {
    const { set } = recorder();
    render(<HeaderExtrasPanel chrome={undefined} set={set} />);
    expect(screen.getByText('Default — Solid')).toBeTruthy();
    expect(screen.queryByText('Blur')).toBeNull();
    cleanup();
    render(<HeaderExtrasPanel chrome={{ header: { background: 'glass' } }} set={set} />);
    expect(screen.getByText('Blur')).toBeTruthy();
  });

  it('writes a height per tier, clamped, and clears it when emptied', () => {
    const { calls, set } = recorder();
    render(<HeaderExtrasPanel chrome={{ header: { height: { base: 80 } } }} set={set} />);
    const base = screen.getByLabelText('Large desktop') as HTMLInputElement;
    fireEvent.change(base, { target: { value: '400' } });
    fireEvent.change(base, { target: { value: '' } });
    expect(calls).toEqual([
      [['chrome', 'header', 'height', 'base'], 160],
      [['chrome', 'header', 'height', 'base'], undefined],
    ]);
  });
});

describe('the footer and motion panels', () => {
  it('offers the phone reveal only once the reveal is on', () => {
    const { calls, set } = recorder();
    render(<MotionExtrasPanel chrome={undefined} set={set} />);
    expect(screen.queryByText('On phones too')).toBeNull();
    fireEvent.click(screen.getByLabelText('The page lifts off the footer, which waits underneath'));
    expect(calls).toEqual([[['chrome', 'footer', 'reveal'], true]]);
    cleanup();
    render(<FooterExtrasPanel chrome={undefined} set={set} />);
    expect(screen.getByText('Footer background and logo')).toBeTruthy();
  });

  /* 3.1 — the logo's height is asked only once the uploaded logo is chosen;
     the panel is a tick that writes only when ticked. */
  it('asks the footer logo’s height only for the uploaded logo, and ticks the panel', () => {
    const { calls, set } = recorder();
    render(<FooterExtrasPanel chrome={undefined} set={set} />);
    expect(screen.queryByText('Logo height')).toBeNull();
    fireEvent.click(screen.getByLabelText('Draw the footer as a panel (Shape → Panels)'));
    expect(calls).toEqual([[['chrome', 'footer', 'panel'], true]]);
    cleanup();
    render(<FooterExtrasPanel chrome={{ footer: { logo: 'image' } }} set={set} />);
    expect(screen.getByText('Logo height')).toBeTruthy();
  });

  it('says when motion is off for everyone', () => {
    const { calls, set } = recorder();
    render(<MotionExtrasPanel chrome={{ reduceMotion: true }} set={set} />);
    expect(screen.getByRole('status').textContent).toMatch(/off for everyone/);
    fireEvent.click(screen.getByLabelText('Reduce motion for everyone'));
    expect(calls).toEqual([[['chrome', 'reduceMotion'], undefined]]);
  });

  it('shows the rail options only when the rails are on', () => {
    const { set } = recorder();
    render(<MotionExtrasPanel chrome={undefined} set={set} />);
    expect(screen.queryByText('Its label')).toBeNull();
    cleanup();
    render(<MotionExtrasPanel chrome={{ rails: { enabled: true } }} set={set} />);
    expect(screen.getByText('Its label')).toBeTruthy();
  });

  it('keeps only paths a rail can be left off', () => {
    const { calls, set } = recorder();
    render(<MotionExtrasPanel chrome={{ rails: { enabled: true } }} set={set} />);
    const box = screen.getByLabelText(/Leave them off/) as HTMLTextAreaElement;
    fireEvent.blur(box, { target: { value: '/blog/*\njavascript:alert(1)\n/about' } });
    expect(calls.at(-1)).toEqual([['chrome', 'rails', 'hideOn'], ['/blog/*', '/about']]);
  });
});

describe('card hover fields', () => {
  it('ask for tilt settings only for tilt, and drop them when tilt goes', () => {
    const onChange = vi.fn();
    render(<CardHoverFields value={{ effect: 'tilt', perspective: 6000, glare: true }} onChange={onChange} />);
    expect(screen.getByText('Perspective')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/On hover, each card/), { target: { value: 'lift' } });
    expect(onChange).toHaveBeenLastCalledWith({ effect: 'lift' });
    fireEvent.change(screen.getByLabelText(/On hover, each card/), { target: { value: 'none' } });
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
});
