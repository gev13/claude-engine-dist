/* ═══════════════════════════════════════════════════════════════════════════
   WordPress content, cleaned for the engine (T37, 2.20)
   ───────────────────────────────────────────────────────────────────────────
   A WXR export holds a post's content as typed: shortcodes, and paragraphs
   only as blank lines (WordPress adds the <p> when it renders). So:

     1. accordions become FAQ items — a page builder's accordion is how most
        WordPress sites wrote their FAQs, and the engine has a block for it,
        with its structured data;
     2. page-builder shortcodes are removed and what they wrapped is kept;
        images and captions a shortcode names become ordinary HTML;
     3. paragraphs are made the way WordPress makes them;
     4. addresses of uploaded files point at the engine's copies, whatever
        size WordPress had cut.

   Everything here is text in, text out. The result still goes through the
   engine's sanitiser on import, like anything an editor saves.
   ═══════════════════════════════════════════════════════════════════════════ */

export type FaqItem = { question: string; answer: string };

/** Page builders and WordPress's own media shortcodes: removed even when they wrap nothing. */
const KNOWN_SHORTCODES = /^(vc_|ohio_|et_pb_|fusion_|av_|mk_|cs_|elementor|rev_slider|contact-form-7|wpforms|gravityform|caption|gallery|embed|audio|video|playlist|row|column|col|section|button|divider|spacer)/i;

const attr = (attrs: string, name: string) => new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s\\]]+))`, 'i').exec(attrs)?.slice(1).find((v) => v !== undefined);

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Accordions and toggles, in any builder's shortcodes, as questions and
 * answers: a container whose name says accordion, toggle or faq, holding
 * items with a `title`. Returns the content without them.
 */
export function extractAccordions(content: string): { content: string; faqs: FaqItem[] } {
  const faqs: FaqItem[] = [];
  const container = /\[([a-z0-9_-]*(?:accordion|toggle|faq)[a-z0-9_-]*)(\s[^\]]*)?\]([\s\S]*?)\[\/\1\]/gi;
  const out = content.replace(container, (whole, _name: string, _attrs: string, inner: string) => {
    const found: FaqItem[] = [];
    const item = /\[([a-z0-9_-]+)(\s[^\]]*)\]([\s\S]*?)\[\/\1\]/gi;
    for (const match of inner.matchAll(item)) {
      const question = attr(match[2] ?? '', 'title')?.trim();
      if (question) found.push({ question, answer: match[3]!.trim() });
    }
    if (found.length === 0) return whole;
    faqs.push(...found);
    return '\n\n';
  });
  // A lone toggle, not inside a container.
  const single = /\[((?:vc_)?toggle|[a-z0-9_]*accordion_item)(\s[^\]]*)\]([\s\S]*?)\[\/\1\]/gi;
  const rest = out.replace(single, (whole, _name: string, attrs: string, inner: string) => {
    const question = attr(attrs, 'title')?.trim();
    if (!question) return whole;
    faqs.push({ question, answer: inner.trim() });
    return '\n\n';
  });
  return { content: rest, faqs };
}

/**
 * Shortcodes out, what they wrapped kept. A shortcode is removed when it is
 * a known builder's or when the same name also closes somewhere — so
 * "[1]" in a footnote, or "[sic]", is left as the text it is.
 */
export function stripShortcodes(content: string, imageUrl: (id: number) => string | undefined = () => undefined): string {
  let html = content;

  // [caption]<img …> Words[/caption] → a figure.
  html = html.replace(/\[caption([^\]]*)\]([\s\S]*?)\[\/caption\]/gi, (_whole, _attrs: string, inner: string) => {
    const image = /<img[^>]*>/i.exec(inner)?.[0] ?? '';
    const caption = inner.replace(/<a[^>]*>\s*<img[^>]*>\s*<\/a>|<img[^>]*>/i, '').trim();
    return `<figure>${image}${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
  });
  // A builder's single image, by attachment id.
  html = html.replace(/\[(?:vc_single_image|ohio_image|et_pb_image)(\s[^\]]*)\](?:\s*\[\/[a-z_]+\])?/gi, (_whole, attrs: string) => {
    const id = Number(attr(attrs, 'image') ?? attr(attrs, 'id'));
    const src = attr(attrs, 'src') ?? (id ? imageUrl(id) : undefined);
    return src ? `<img src="${escape(src)}" alt="${escape(attr(attrs, 'alt') ?? '')}">` : '';
  });
  // [gallery ids="1,2,3"] → the pictures.
  html = html.replace(/\[gallery(\s[^\]]*)?\]/gi, (_whole, attrs = '') => {
    const ids = (attr(attrs, 'ids') ?? '').split(',').map((v) => Number(v.trim())).filter(Boolean);
    return ids.map((id) => imageUrl(id)).filter(Boolean).map((src) => `<img src="${escape(src!)}" alt="">`).join('\n');
  });
  // [embed]https://…[/embed] → the address, on its own line, as WordPress would auto-embed it.
  html = html.replace(/\[embed[^\]]*\]([\s\S]*?)\[\/embed\]/gi, (_whole, url: string) => `\n\n<a href="${escape(url.trim())}">${escape(url.trim())}</a>\n\n`);

  const closers = new Set([...html.matchAll(/\[\/([a-z][a-z0-9_-]*)\]/gi)].map((m) => m[1]!.toLowerCase()));
  html = html.replace(/\[\/?([a-z][a-z0-9_-]*)(?:\s[^\]]*)?\/?\]/gi, (whole, name: string) =>
    KNOWN_SHORTCODES.test(name) || closers.has(name.toLowerCase()) ? '\n' : whole,
  );
  return html;
}

const BLOCK = '(?:table|thead|tfoot|caption|col|colgroup|tbody|tr|td|th|div|dl|dd|dt|ul|ol|li|pre|form|map|area|blockquote|address|math|style|p|h[1-6]|hr|fieldset|legend|section|article|aside|hgroup|header|footer|nav|figure|figcaption|details|menu|summary|iframe|video|audio|picture|source)';

/**
 * WordPress's `wpautop`, in the form that matters for stored content: blank
 * lines make paragraphs, single line breaks inside one become <br>, and
 * block-level elements are left as they are.
 */
export function wpautop(content: string): string {
  let text = content.replace(/\r\n?/g, '\n').trim();
  if (!text) return '';
  // Space block tags onto their own paragraphs so they are never wrapped.
  text = text.replace(new RegExp(`(<${BLOCK}[\\s/>])`, 'gi'), '\n\n$1').replace(new RegExp(`(</${BLOCK}>)`, 'gi'), '$1\n\n');
  // Keep line breaks inside <pre> as they are.
  const pres: string[] = [];
  text = text.replace(/<pre[\s\S]*?<\/pre>/gi, (m) => `\u0000${pres.push(m) - 1}\u0000`);
  const blockStart = new RegExp(`^</?${BLOCK}[\\s/>]`, 'i');
  const blockEnd = new RegExp(`</?${BLOCK}[^>]*>$`, 'i');
  const out = text
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => (/^\u0000\d+\u0000$/.test(chunk) || blockStart.test(chunk) || blockEnd.test(chunk) ? chunk : `<p>${chunk.replace(/\n/g, '<br>\n')}</p>`))
    .join('\n');
  return out.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => pres[Number(i)]!);
}

/**
 * The file an uploaded image's address names, whatever size WordPress cut:
 * `photo-300x200.jpg` and `photo-scaled.jpg` are both `photo.jpg`. Only the
 * path under uploads counts, so http, https and another host all match.
 */
export function uploadKey(url: string): string | null {
  const match = /\/wp-content\/uploads\/(.+?)(?:[?#].*)?$/i.exec(url);
  if (!match) return null;
  return decodeURIComponent(match[1]!)
    .replace(/-\d+x\d+(?=\.[a-z0-9]+$)/i, '')
    .replace(/-scaled(?=\.[a-z0-9]+$)/i, '')
    .toLowerCase();
}

/**
 * Point every uploaded file's address at the engine's copy. `srcset` and
 * `sizes` go: they list WordPress's cuts, and the engine writes its own.
 */
export function rewriteUploads(html: string, files: Map<string, string>): string {
  const swap = (url: string) => {
    const key = uploadKey(url);
    return key && files.has(key) ? files.get(key)! : url;
  };
  return html
    .replace(/\s(?:srcset|sizes)\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/(\s(?:src|href|poster)\s*=\s*)(["'])([^"']+)\2/gi, (_whole, pre: string, quote: string, url: string) => `${pre}${quote}${swap(url)}${quote}`)
    .replace(/url\((["']?)([^)"']+)\1\)/gi, (_whole, quote: string, url: string) => `url(${quote}${swap(url)}${quote})`);
}

/** Everything above, in order, for one post's raw content. */
export function cleanContent(
  raw: string,
  opts: { rendered: boolean; files: Map<string, string>; imageUrl?: (id: number) => string | undefined; extractFaq: boolean },
): { html: string; faqs: FaqItem[] } {
  let content = raw;
  let faqs: FaqItem[] = [];
  if (!opts.rendered) {
    if (opts.extractFaq) ({ content, faqs } = extractAccordions(content));
    content = wpautop(stripShortcodes(content, opts.imageUrl));
    faqs = faqs.map((f) => ({ question: f.question, answer: wpautop(stripShortcodes(f.answer, opts.imageUrl)) }));
  }
  return {
    html: rewriteUploads(content, opts.files),
    faqs: faqs.map((f) => ({ question: f.question, answer: rewriteUploads(f.answer, opts.files) })),
  };
}
