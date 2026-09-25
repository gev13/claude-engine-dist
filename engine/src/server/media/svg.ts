import 'server-only';
import { parseDocument } from 'htmlparser2';
import render from 'dom-serializer';
import { type ChildNode, type Element, isTag, isText } from 'domhandler';

/* ═══════════════════════════════════════════════════════════════════════════
   SVG, cleaned on upload (T17, 2.17)
   ───────────────────────────────────────────────────────────────────────────
   An SVG is a document, not a picture: it can carry script, event handlers,
   HTML inside `foreignObject`, and links to anywhere. Opened directly from
   this origin, any of that would run as the site. So an upload is parsed as
   XML and rebuilt from an allowlist — shapes, text, gradients, filters,
   masks — and everything else is dropped, not escaped. Links may only point
   inside the file (`#id`), and CSS may not fetch anything.

   The route serves it with a policy that runs nothing either
   (`default-src 'none'; style-src 'unsafe-inline'; sandbox`), so the
   cleaning is not the only line.
   ═══════════════════════════════════════════════════════════════════════════ */

export const SVG_MAX_BYTES = 1_048_576;

const ELEMENTS = new Set([
  'svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc', 'metadata', 'switch',
  'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'textPath',
  'linearGradient', 'radialGradient', 'stop', 'pattern', 'clipPath', 'mask', 'marker', 'image', 'style',
  'filter', 'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite', 'feDropShadow', 'feFlood', 'feFuncA',
  'feFuncB', 'feFuncG', 'feFuncR', 'feGaussianBlur', 'feMerge', 'feMergeNode', 'feMorphology', 'feOffset', 'feTile', 'feTurbulence',
]);

const ATTRIBUTES = new Set([
  'xmlns', 'xmlns:xlink', 'version', 'id', 'class', 'style', 'lang', 'xml:space',
  'viewBox', 'preserveAspectRatio', 'width', 'height', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'fx', 'fy', 'fr',
  'd', 'points', 'pathLength', 'transform', 'href', 'xlink:href',
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin',
  'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'color', 'display', 'visibility', 'overflow',
  'clip-path', 'clip-rule', 'clipPathUnits', 'mask', 'maskUnits', 'maskContentUnits', 'filter', 'filterUnits', 'primitiveUnits',
  'marker-start', 'marker-mid', 'marker-end', 'markerWidth', 'markerHeight', 'markerUnits', 'refX', 'refY', 'orient',
  'gradientUnits', 'gradientTransform', 'spreadMethod', 'offset', 'stop-color', 'stop-opacity',
  'patternUnits', 'patternContentUnits', 'patternTransform',
  'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant', 'text-anchor', 'dominant-baseline', 'alignment-baseline',
  'baseline-shift', 'letter-spacing', 'word-spacing', 'text-decoration', 'dx', 'dy', 'rotate', 'textLength', 'lengthAdjust',
  'startOffset', 'method', 'spacing', 'side',
  'in', 'in2', 'result', 'mode', 'values', 'type', 'operator', 'k1', 'k2', 'k3', 'k4', 'stdDeviation', 'edgeMode',
  'flood-color', 'flood-opacity', 'lighting-color', 'radius', 'scale', 'baseFrequency', 'numOctaves', 'seed', 'stitchTiles',
  'tableValues', 'slope', 'intercept', 'amplitude', 'exponent', 'color-interpolation', 'color-interpolation-filters',
  'vector-effect', 'shape-rendering', 'image-rendering', 'text-rendering', 'paint-order', 'mix-blend-mode', 'isolation',
  'systemLanguage', 'requiredFeatures', 'focusable', 'role', 'aria-label', 'aria-hidden',
]);

/** A link may only point inside the file. `image` may also embed a raster as data. */
function safeHref(element: string, value: string): boolean {
  const v = value.trim();
  if (v.startsWith('#')) return /^#[A-Za-z_][\w.:-]*$/.test(v);
  return element === 'image' && /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(v);
}

/**
 * CSS that fetches nothing and runs nothing: an `@import`, a `url()` to
 * anywhere but `#id`, and the old IE expression hooks are removed; the rest
 * of the rule survives.
 */
export function safeSvgCss(css: string): string {
  return css
    .replace(/<\/?[a-z]/gi, '')
    .replace(/@import[^;]*;?/gi, '')
    .replace(/url\(\s*(['"]?)(?!#)[^)]*\1\s*\)/gi, 'none')
    .replace(/expression\s*\(/gi, '(')
    .replace(/(-moz-binding|behavior)\s*:[^;}]*/gi, '')
    .replace(/javascript\s*:/gi, '');
}

function clean(nodes: ChildNode[]): ChildNode[] {
  const kept: ChildNode[] = [];
  for (const node of nodes) {
    if (isText(node)) {
      kept.push(node);
      continue;
    }
    // Comments, processing instructions, doctypes, CDATA outside <style>: gone.
    if (!isTag(node)) continue;
    const element = node as Element;
    if (!ELEMENTS.has(element.name)) continue;

    for (const name of Object.keys(element.attribs)) {
      const value = element.attribs[name] ?? '';
      const allowed =
        ATTRIBUTES.has(name) &&
        !/^on/i.test(name) &&
        ((name !== 'href' && name !== 'xlink:href') || safeHref(element.name, value)) &&
        !/javascript\s*:|data\s*:\s*text\/html/i.test(value);
      if (!allowed) delete element.attribs[name];
      else if (name === 'style') element.attribs[name] = safeSvgCss(value);
      else if (/url\(/i.test(value)) element.attribs[name] = value.replace(/url\(\s*(['"]?)(?!#)[^)]*\1\s*\)/gi, 'none');
    }

    if (element.name === 'style') {
      // Only its text, cleaned; nothing inside a stylesheet is an element.
      const css = textOf(element.children);
      element.children = [];
      const text = parseDocument(`<t>${escapeText(safeSvgCss(css))}</t>`, { xmlMode: true }).children[0] as Element;
      element.children = text.children;
      for (const child of element.children) child.parent = element;
      kept.push(element);
      continue;
    }

    element.children = clean(element.children);
    for (const child of element.children) child.parent = element;
    kept.push(element);
  }
  return kept;
}

/** The text inside a node list, CDATA sections included. */
function textOf(nodes: ChildNode[]): string {
  return nodes.map((node) => ('data' in node ? String(node.data) : 'children' in node ? textOf(node.children as ChildNode[]) : '')).join('');
}

const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export type CleanedSvg = { svg: string; width: number | null; height: number | null };

/** Parse, clean and re-serialise an SVG; null when it is not one. */
export function cleanSvg(raw: string): CleanedSvg | null {
  const text = raw.replace(/^﻿/, '');
  const doc = parseDocument(text, { xmlMode: true, recognizeCDATA: true });
  const root = doc.children.find((node) => isTag(node)) as Element | undefined;
  if (!root || root.name !== 'svg') return null;
  const [svg] = clean([root]) as Element[];
  if (!svg) return null;
  if (!svg.attribs.xmlns) svg.attribs.xmlns = 'http://www.w3.org/2000/svg';

  const size = (value: string | undefined) => {
    const n = value && /^\s*[\d.]+\s*(px)?\s*$/.test(value) ? Math.round(Number.parseFloat(value)) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  let width = size(svg.attribs.width);
  let height = size(svg.attribs.height);
  const box = svg.attribs.viewBox?.trim().split(/[\s,]+/).map(Number);
  if ((!width || !height) && box && box.length === 4 && box.every(Number.isFinite) && box[2]! > 0 && box[3]! > 0) {
    width ??= Math.round(box[2]!);
    height ??= Math.round(box[3]!);
  }

  return { svg: render(svg, { xmlMode: true, selfClosingTags: true }), width, height };
}
