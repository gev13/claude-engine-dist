import 'server-only';
import sanitizeHtml from 'sanitize-html';

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
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
    th: ['colspan', 'rowspan', 'scope'],
    td: ['colspan', 'rowspan'],
    col: ['span'],
    '*': ['class', 'id', 'dir', 'lang'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
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
  },
  // No inline styles: they are the usual vector for CSS-based exfiltration and
  // they fight the design system.
  allowedStyles: {},
  disallowedTagsMode: 'discard',
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, OPTIONS);
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
