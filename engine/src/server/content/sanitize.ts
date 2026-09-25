import 'server-only';
import sanitizeHtml from 'sanitize-html';
import { toSlug } from '@/lib/slug';

/** Players a post may embed — the ones the CSP's `frame-src` already allows (lib/embeds.ts). */
const IFRAME_HOSTS = ['www.youtube-nocookie.com', 'player.vimeo.com'];

/** A same-site media path: the CSP plays video only from the site itself (`media-src 'self'`). */
const SITE_MEDIA = /^\/[A-Za-z0-9._~\-/%]+$/;

/**
 * Sanitisation happens on WRITE, so nothing unsafe is ever stored. The render
 * side then trusts the database.
 *
 * The allow-list matches what the TinyMCE configuration can produce, plus the
 * classes the public prose styles use. Anything else is dropped silently.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'a', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
    'strong', 'em', 'b', 'i', 'u', 's', 'sub', 'sup', 'br', 'hr', 'span', 'div',
    'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
    /* 2.13 — what an article moved from another CMS carries: a video that
       plays inline, and a YouTube or Vimeo player. */
    'video', 'source', 'iframe',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'srcset', 'sizes', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
    video: ['src', 'poster', 'controls', 'muted', 'loop', 'playsinline', 'autoplay', 'preload', 'width', 'height'],
    source: ['src', 'type'],
    iframe: ['src', 'title', 'width', 'height', 'allow', 'allowfullscreen', 'loading', 'referrerpolicy'],
    th: ['colspan', 'rowspan', 'scope'],
    td: ['colspan', 'rowspan'],
    col: ['span'],
    '*': ['class', 'id', 'dir', 'lang'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'], video: [], source: [], iframe: ['https'] },
  allowedIframeHostnames: IFRAME_HOSTS,
  allowIframeRelativeUrls: false,
  allowProtocolRelative: false,
  // Anything pointing off-site opens in a new tab and cannot reach window.opener.
  transformTags: {
    a: (tagName, attribs) => {
      const href = attribs.href ?? '';
      const external = /^https?:\/\//i.test(href);
      return {
        tagName,
        attribs: {
          ...attribs,
          ...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {}),
        },
      };
    },
    img: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, loading: 'lazy', decoding: 'async' },
    }),
    // A poster is fetched like an image; only the site's own files are kept.
    video: (tagName, attribs) => {
      const { poster, src, ...rest } = attribs;
      return {
        tagName,
        attribs: {
          ...rest,
          ...(src && SITE_MEDIA.test(src) ? { src } : {}),
          ...(poster && SITE_MEDIA.test(poster) ? { poster } : {}),
          preload: attribs.autoplay !== undefined ? 'auto' : 'metadata',
        },
      };
    },
    source: (tagName, attribs) => ({
      tagName,
      attribs: attribs.src && SITE_MEDIA.test(attribs.src) ? attribs : { type: attribs.type ?? '' },
    }),
    iframe: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: 'lazy' } }),
  },
  // No inline styles: they are the usual vector for CSS-based exfiltration and
  // they fight the design system.
  allowedStyles: {},
  disallowedTagsMode: 'discard',
};

export function sanitizeRichText(html: string): string {
  return withHeadingIds(sanitizeHtml(html, OPTIONS));
}

/**
 * Give every h2 and h3 an id made from its words, unless it already has one.
 *
 * A table of contents — the post's own, or a TOC block — links to these, and
 * a link into the middle of an article is only useful if it survives the next
 * save. So it is stored with the HTML, on write, rather than invented in the
 * browser each visit. Ids are unique within the article (`-2`, `-3`…).
 */
export function withHeadingIds(html: string): string {
  const used = new Set<string>();
  for (const match of html.matchAll(/\sid="([^"]+)"/g)) used.add(match[1]!);
  return html.replace(/<(h[23])((?:\s[^>]*)?)>([\s\S]*?)<\/\1>/g, (whole, tag: string, attrs: string, inner: string) => {
    if (/\sid="/.test(attrs)) return whole;
    const words = inner.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').trim();
    const base = toSlug(words, 'section').slice(0, 60) || 'section';
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return `<${tag}${attrs} id="${id}">${inner}</${tag}>`;
  });
}

/**
 * Strip every tag — for excerpts, meta descriptions and search indexing.
 *
 * Tags are replaced with a space rather than removed, so `</h2><p>` does not
 * run the heading into the paragraph that follows it.
 */
export function toPlainText(html: string): string {
  const spaced = sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
    textFilter: (text) => `${text} `,
  });
  return spaced.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
