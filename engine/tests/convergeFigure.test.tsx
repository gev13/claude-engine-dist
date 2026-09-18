// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ConvergeFigure } from '@/components/blocks/ConvergeFigure';
import { FIGURE_LABELS } from '@/lib/blocks';
import { figureStyleProperties } from '@/lib/figureStyle';

/* ═══════════════════════════════════════════════════════════════════════════
   A diagram that counts its own sources
   ───────────────────────────────────────────────────────────────────────────
   It was two hardcoded curves, two hardcoded boxes and three hardcoded
   coordinates, so a third source was a label that drew nothing — typed in,
   saved, and silently ignored. The geometry is worked out now.

   The thing that must not move: three labels is what every existing page has,
   and it has to render exactly the drawing it always did.
   ═══════════════════════════════════════════════════════════════════════════ */

afterEach(cleanup);

const draw = (labels: string[]) => {
  const { container } = render(<ConvergeFigure labels={labels} />);
  const svg = container.querySelector('svg')!;
  return {
    svg,
    boxes: svg.querySelectorAll('rect').length,
    curves: [...svg.querySelectorAll('path')].filter((p) => p.getAttribute('d')?.startsWith('M148')),
    texts: [...svg.querySelectorAll('text')].map((t) => t.textContent),
    viewBox: svg.getAttribute('viewBox'),
  };
};

describe('two sources — what every existing page has', () => {
  it('draws exactly what it drew before', () => {
    const d = draw(['SOURCE A', 'SOURCE B', 'OUTCOME']);
    expect(d.viewBox).toBe('0 0 420 300');
    expect(d.curves).toHaveLength(2);
    // Two source boxes plus the destination.
    expect(d.boxes).toBe(3);
    // The original rows, to the pixel.
    expect(d.curves[0]!.getAttribute('d')).toContain('M148 60');
    expect(d.curves[1]!.getAttribute('d')).toContain('M148 240');
  });

  it('falls back to the drawn-in words when given none', () => {
    expect(draw([]).texts).toEqual([...FIGURE_LABELS.converge]);
  });
});

describe('more than two sources', () => {
  it('draws a curve and a box for each', () => {
    const d = draw(['One', 'Two', 'Three', 'Outcome']);
    expect(d.curves).toHaveLength(3);
    expect(d.boxes).toBe(4);
    expect(d.texts).toEqual(['One', 'Two', 'Three', 'Outcome']);
  });

  it('keeps them evenly spaced, and centred on the destination', () => {
    const d = draw(['One', 'Two', 'Three', 'Outcome']);
    const ys = d.curves.map((p) => Number(p.getAttribute('d')!.match(/^M148 ([\d.]+)/)![1]));
    const gaps = ys.slice(1).map((y, i) => y - ys[i]!);
    expect(new Set(gaps.map((g) => g.toFixed(2))).size).toBe(1);
    // The middle source sits level with what they all meet at.
    expect(ys[1]).toBe(150);
  });

  /* Five sources at the original spacing would have the boxes overlapping, so
     the drawing grows rather than the boxes colliding. */
  it('grows the drawing rather than crowding the boxes', () => {
    const five = draw(['A', 'B', 'C', 'D', 'E', 'Outcome']);
    const height = Number(five.viewBox!.split(' ')[3]);
    expect(height).toBeGreaterThan(300);

    const ys = five.curves.map((p) => Number(p.getAttribute('d')!.match(/^M148 ([\d.]+)/)![1]));
    // A 36px box needs more than 36px of separation.
    expect(ys[1]! - ys[0]!).toBeGreaterThanOrEqual(60);
  });

  it('says what it shows, for a screen reader', () => {
    const d = draw(['One', 'Two', 'Three', 'Outcome']);
    expect(d.svg.getAttribute('aria-label')).toBe('One, Two, Three converging on Outcome');
  });

  it('ignores blank rows rather than drawing an empty box', () => {
    const d = draw(['One', '', 'Two', 'Outcome']);
    expect(d.curves).toHaveLength(2);
  });
});

describe('how it is drawn', () => {
  it('carries no properties when nothing was chosen', () => {
    expect(figureStyleProperties(undefined)).toEqual({});
    expect(figureStyleProperties({})).toEqual({});
  });

  it('writes the properties the SVG reads', () => {
    const props = figureStyleProperties({ lineColor: '#00ff00', targetSize: '22px', radius: '6px' });
    expect(props).toMatchObject({
      '--he-fig-line': '#00ff00',
      '--he-fig-target-size': '22px',
      '--he-fig-radius': '6px',
    });
  });

  /* It lands in a style attribute, so the grammar is the guard — checked here
     as well as in the schema. */
  it('drops anything that is not a colour or a length', () => {
    const props = figureStyleProperties({ lineColor: 'red; position: fixed', targetSize: 'huge' } as never);
    expect(props).toEqual({});
  });

  it('reaches the rendered diagram', () => {
    const { container } = render(
      <ConvergeFigure labels={['A', 'B', 'Out']} style={{ lineColor: '#00ff00' }} />,
    );
    expect(container.querySelector('svg')!.getAttribute('style')).toContain('--he-fig-line');
  });
});

describe('the grid behind it', () => {
  /* An odd number of sources puts one level with the destination, so the row
     rule and the centre rule land on the same line — drawn twice, visibly
     darker than every other rule. */
  it('draws each rule once, however many sources there are', () => {
    for (const labels of [['A', 'B', 'Out'], ['A', 'B', 'C', 'Out'], ['A', 'B', 'C', 'D', 'E', 'Out']]) {
      const { container } = render(<ConvergeFigure labels={labels} />);
      const rules = [...container.querySelectorAll('path')]
        .map((p) => p.getAttribute('d')!)
        .filter((d) => d.startsWith('M0 '));
      expect(new Set(rules).size, labels.join('/')).toBe(rules.length);
      cleanup();
    }
  });
});
