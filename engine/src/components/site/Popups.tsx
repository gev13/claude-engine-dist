import { BlockRenderer } from '@/components/blocks/Renderer';
import type { AnyBlock } from '@/lib/blocks';
import type { Popup } from '@/lib/popups';
import { PopupShell } from './PopupShell';

/**
 * Every enabled popup, rendered on the server into a closed <dialog>, which
 * the browser neither shows nor reads out until it opens. Only the settings
 * go to the client component; the content stays server-rendered blocks.
 */
export function Popups({ popups }: { popups: Popup[] }) {
  const live = popups.filter((p) => p.enabled && p.blocks.length > 0);
  if (live.length === 0) return null;
  return (
    <>
      {live.map(({ blocks, ...settings }) => (
        <PopupShell key={settings.id} popup={settings}>
          <BlockRenderer blocks={blocks as unknown as AnyBlock[]} />
        </PopupShell>
      ))}
    </>
  );
}
