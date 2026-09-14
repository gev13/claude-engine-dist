'use client';

import { useCallback, useRef } from 'react';
import { Editor as TinyEditor } from '@tinymce/tinymce-react';
import type { Editor as TinyMCEEditor } from 'tinymce';

/* ═══════════════════════════════════════════════════════════════════════════
   TinyMCE — self-hosted
   ───────────────────────────────────────────────────────────────────────────
   The CSP forbids third-party scripts, so nothing here may come from the Tiny
   cloud. Every part of the editor is imported from the npm package so the
   bundler ships it with the admin chunk:

     • core + model + theme + icons
     • the skin and content CSS, which register themselves through
       `tinymce.Resource` — the theme then loads them from memory instead of
       fetching /skins/... over the network
     • one import per plugin we expose in the toolbar

   `licenseKey: 'gpl'` is the self-hosted, open-source licence declaration.
   This module touches `window` at import time, so consumers MUST pull it in
   with `next/dynamic` and `ssr: false`.
   ═══════════════════════════════════════════════════════════════════════════ */

import 'tinymce/tinymce';
import 'tinymce/models/dom';
import 'tinymce/themes/silver';
import 'tinymce/icons/default';

import 'tinymce/skins/ui/oxide-dark/skin.js';
import 'tinymce/skins/ui/oxide-dark/content.js';
import 'tinymce/skins/content/dark/content.js';

import 'tinymce/plugins/advlist';
import 'tinymce/plugins/anchor';
import 'tinymce/plugins/autolink';
import 'tinymce/plugins/charmap';
import 'tinymce/plugins/code';
import 'tinymce/plugins/codesample';
import 'tinymce/plugins/fullscreen';
import 'tinymce/plugins/image';
import 'tinymce/plugins/importcss';
import 'tinymce/plugins/insertdatetime';
import 'tinymce/plugins/link';
import 'tinymce/plugins/lists';
import 'tinymce/plugins/media';
import 'tinymce/plugins/nonbreaking';
import 'tinymce/plugins/pagebreak';
import 'tinymce/plugins/preview';
import 'tinymce/plugins/quickbars';
import 'tinymce/plugins/searchreplace';
import 'tinymce/plugins/table';
import 'tinymce/plugins/visualblocks';
import 'tinymce/plugins/visualchars';
import 'tinymce/plugins/wordcount';

/** What the media library hands back when it satisfies a file-picker request. */
export type RichTextPick = { url: string; alt?: string; title?: string };

export type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  /**
   * Replaces TinyMCE's file input. Called with a callback to invoke once the
   * author has chosen something, plus the kind of file TinyMCE asked for.
   */
  onImagePick?: (accept: (pick: RichTextPick) => void, meta: { filetype: string }) => void;
  height?: number;
};

/** Same face stack the public site loads; the editor body is an iframe with its
 *  own document, so it needs its own copy of the stylesheet link. */
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=JetBrains+Mono:wght@400;500&display=swap';

/** Makes the editing surface read like the published page: same ink/bone/flare
 *  palette, same display face for headings, same rules and code styling. */
const CONTENT_STYLE = `
  @import url('${FONT_HREF}');
  :root { color-scheme: dark; }
  body {
    background: #201e1d;
    color: #f3f2f2;
    font-family: 'Archivo', system-ui, -apple-system, sans-serif;
    font-size: 16px;
    line-height: 1.62;
    margin: 20px 24px;
    -webkit-font-smoothing: antialiased;
  }
  body.mce-content-body[data-mce-placeholder]:not(.mce-visualblocks)::before { color: #9b9797; }
  h1, h2, h3, h4, h5, h6 {
    font-family: 'Bricolage Grotesque', 'Archivo', system-ui, sans-serif;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.08;
    color: #f3f2f2;
    text-wrap: balance;
    margin: 1.6em 0 0.5em;
  }
  h1 { font-size: 40px; }
  h2 { font-size: 30px; }
  h3 { font-size: 23px; }
  h4 { font-size: 19px; }
  p { color: #bab6b6; text-wrap: pretty; margin: 0 0 1.15em; }
  a { color: #ff9783; text-decoration: underline; text-underline-offset: 3px; }
  strong { color: #f3f2f2; font-weight: 700; }
  ul, ol { color: #bab6b6; padding-left: 1.3em; }
  li { margin: 0.35em 0; }
  ul { list-style: square; }
  blockquote {
    margin: 1.6em 0;
    padding: 0.2em 0 0.2em 1.2em;
    border-left: 2px solid #ec3013;
    color: #f3f2f2;
    font-size: 19px;
  }
  hr { border: 0; border-top: 1px solid rgba(243,242,242,0.14); margin: 2em 0; }
  code, kbd, samp {
    font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
    font-size: 0.88em;
    background: #2d2b2b;
    color: #ff9783;
    padding: 0.12em 0.36em;
  }
  pre, pre[class*='language-'] {
    background: #2d2b2b;
    border-left: 2px solid #ec3013;
    color: #f3f2f2;
    padding: 16px 18px;
    overflow-x: auto;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 13.5px;
    line-height: 1.6;
  }
  pre code { background: none; color: inherit; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 1.6em 0; font-size: 15px; }
  th, td { border: 1px solid rgba(243,242,242,0.14); padding: 10px 12px; text-align: left; }
  th {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #9b9797;
    font-weight: 400;
  }
  td { color: #bab6b6; }
  img { max-width: 100%; height: auto; }
  figure { margin: 1.8em 0; }
  figcaption {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #9b9797;
    margin-top: 10px;
  }
  ::selection { background: #ec3013; color: #f3f2f2; }
  .mce-content-body [data-mce-selected='inline-boundary'] { background: rgba(236,48,19,0.25); }
`;

const PLUGINS = [
  'advlist',
  'anchor',
  'autolink',
  'charmap',
  'code',
  'codesample',
  'fullscreen',
  'image',
  'importcss',
  'insertdatetime',
  'link',
  'lists',
  'media',
  'nonbreaking',
  'pagebreak',
  'preview',
  'quickbars',
  'searchreplace',
  'table',
  'visualblocks',
  'visualchars',
  'wordcount',
];

const TOOLBAR = [
  'undo redo | blocks | bold italic underline strikethrough | removeformat',
  'alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | blockquote hr',
  'link unlink anchor | image media table codesample charmap | pasteastext searchreplace visualblocks code preview fullscreen',
];

export function RichTextEditorSkeleton({ height = 480 }: { height?: number }) {
  return (
    <div
      className="flex items-center justify-center border-2 border-hairline bg-ink"
      style={{ height }}
      aria-hidden="true"
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Loading editor…</span>
    </div>
  );
}

export function RichTextEditor({ value, onChange, onImagePick, height = 480 }: RichTextEditorProps) {
  // Kept in a ref so `setup` (which TinyMCE only reads once) always sees the
  // current handler rather than the one captured at first render.
  const pickRef = useRef(onImagePick);
  pickRef.current = onImagePick;

  const handleChange = useCallback(
    (html: string) => {
      onChange(html);
    },
    [onChange],
  );

  return (
    <div className="he-rte border-2 border-hairline">
      <TinyEditor
        licenseKey="gpl"
        value={value}
        onEditorChange={handleChange}
        init={{
          height,
          menubar: 'edit insert view format table tools',
          plugins: PLUGINS,
          toolbar: TOOLBAR,
          toolbar_mode: 'sliding',
          skin: 'oxide-dark',
          content_css: ['dark'],
          content_style: CONTENT_STYLE,
          branding: false,
          promotion: false,
          statusbar: true,
          elementpath: false,
          resize: true,
          browser_spellcheck: true,
          contextmenu: 'link image table',
          block_formats:
            'Paragraph=p; Heading 1=h1; Heading 2=h2; Heading 3=h3; Heading 4=h4; Preformatted=pre; Blockquote=blockquote',
          link_default_protocol: 'https',
          link_context_toolbar: true,
          image_caption: true,
          image_advtab: true,
          image_dimensions: true,
          // Images belong in the media library, not inlined as base64 blobs.
          paste_data_images: false,
          paste_as_text: false,
          quickbars_insert_toolbar: false,
          quickbars_selection_toolbar: 'bold italic underline | quicklink blockquote',
          table_default_attributes: {},
          table_header_type: 'sectionCells',
          codesample_languages: [
            { text: 'HTML/XML', value: 'markup' },
            { text: 'JavaScript', value: 'javascript' },
            { text: 'TypeScript', value: 'typescript' },
            { text: 'CSS', value: 'css' },
            { text: 'JSON', value: 'json' },
            { text: 'Bash', value: 'bash' },
            { text: 'SQL', value: 'sql' },
            { text: 'Python', value: 'python' },
          ],
          file_picker_types: 'image media file',
          file_picker_callback: onImagePick
            ? (callback, _value, meta) => {
                pickRef.current?.(
                  (pick) => callback(pick.url, { alt: pick.alt ?? '', title: pick.title ?? '' }),
                  { filetype: meta.filetype },
                );
              }
            : undefined,
          setup: (editor: TinyMCEEditor) => {
            // TinyMCE 6+ has no paste plugin; expose the option as a toggle so
            // authors can strip formatting from pasted Word/Docs content.
            editor.ui.registry.addToggleButton('pasteastext', {
              icon: 'paste-text',
              tooltip: 'Paste as plain text',
              onAction: (api) => {
                const next = !api.isActive();
                editor.options.set('paste_as_text', next);
                api.setActive(next);
              },
              onSetup: (api) => {
                api.setActive(editor.options.get('paste_as_text') === true);
                return () => {};
              },
            });
          },
        }}
      />
    </div>
  );
}

export default RichTextEditor;
