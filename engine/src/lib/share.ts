/* ═══════════════════════════════════════════════════════════════════════════
   Share links (P3-A6)
   ───────────────────────────────────────────────────────────────────────────
   Plain links to each network's own share page — no third-party script and
   nothing sent anywhere until a visitor clicks. Pure, so it can be tested.
   ═══════════════════════════════════════════════════════════════════════════ */

export const SHARE_NETWORKS = ['x', 'linkedin', 'facebook', 'pinterest', 'whatsapp', 'reddit', 'telegram', 'email', 'copy', 'native'] as const;
export type ShareNetwork = (typeof SHARE_NETWORKS)[number];

export const SHARE_LABELS: Record<ShareNetwork, string> = {
  x: 'X',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  pinterest: 'Pinterest',
  whatsapp: 'WhatsApp',
  reddit: 'Reddit',
  telegram: 'Telegram',
  email: 'Email',
  copy: 'Copy link',
  native: 'More',
};

/** Brand colours, used only when the block asks for them. */
export const SHARE_BRAND: Partial<Record<ShareNetwork, string>> = {
  x: '#e7e9ea',
  linkedin: '#0a66c2',
  facebook: '#1877f2',
  pinterest: '#e60023',
  whatsapp: '#25d366',
  reddit: '#ff4500',
  telegram: '#229ed9',
};

/** The link that opens a network's share page, or null for the two that are buttons. */
export function shareHref(network: ShareNetwork, url: string, text = ''): string | null {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  switch (network) {
    case 'x':
      return `https://x.com/intent/tweet?url=${u}${text ? `&text=${t}` : ''}`;
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case 'pinterest':
      return `https://www.pinterest.com/pin/create/button/?url=${u}${text ? `&description=${t}` : ''}`;
    case 'whatsapp':
      return `https://wa.me/?text=${encodeURIComponent(text ? `${text} ${url}` : url)}`;
    case 'reddit':
      return `https://www.reddit.com/submit?url=${u}${text ? `&title=${t}` : ''}`;
    case 'telegram':
      return `https://t.me/share/url?url=${u}${text ? `&text=${t}` : ''}`;
    case 'email':
      return `mailto:?subject=${t}&body=${u}`;
    default:
      return null;
  }
}
