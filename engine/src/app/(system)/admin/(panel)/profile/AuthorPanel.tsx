'use client';

import { useEffect, useState } from 'react';
import { MediaPicker } from '@/components/admin/MediaPicker';
import { AdminButton, Field, Input, Panel, Select, Textarea } from '@/components/admin/ui';
import { useToast } from '@/components/admin/useToast';
import { api } from '@/lib/admin/client';
import { SOCIAL_LABELS, SOCIAL_NETWORKS, type SocialNetwork, isSafeHref } from '@/lib/navigation';
import { errorMessage } from '../_shared';

type Link = { network: SocialNetwork; href: string };
export type AuthorFields = { bio: string; avatarUrl: string | null; links: Link[] };

/**
 * The author box under a post (2.18): a picture, a few sentences and links.
 * Public once Appearance → Blog shows the box, so the panel says so.
 */
export function AuthorPanel({ value, onSaved }: { value: AuthorFields; onSaved: () => void }) {
  const { toast } = useToast();
  const [bio, setBio] = useState(value.bio);
  const [avatarUrl, setAvatarUrl] = useState(value.avatarUrl);
  const [links, setLinks] = useState<Link[]>(value.links);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBio(value.bio);
    setAvatarUrl(value.avatarUrl);
    setLinks(value.links);
  }, [value]);

  async function save() {
    const bad = links.find((link) => !isSafeHref(link.href));
    if (bad) return toast(`The ${SOCIAL_LABELS[bad.network]} link needs a full https:// address.`, 'error');
    setSaving(true);
    try {
      await api('/api/admin/profile', { method: 'PATCH', json: { bio, avatarUrl, links } });
      toast('Saved.', 'success');
      onSaved();
    } catch (error) {
      toast(errorMessage(error, 'That could not be saved.'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="As an author">
      <div className="flex flex-col gap-4">
        <p className="m-0 text-[13px] text-smoke">Shown under your posts when the author box is switched on in Appearance → Blog — so everything here is public.</p>
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full border-2 border-hairline object-cover" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-hairline text-[10px] text-smoke">None</span>
          )}
          <AdminButton type="button" variant="secondary" onClick={() => setPicking(true)}>
            Choose a picture
          </AdminButton>
          {avatarUrl && (
            <AdminButton type="button" variant="ghost" onClick={() => setAvatarUrl(null)}>
              Remove
            </AdminButton>
          )}
        </div>
        <Field label="About you" htmlFor="author-bio" hint="a few sentences">
          <Textarea id="author-bio" rows={4} maxLength={1000} value={bio} onChange={(e) => setBio(e.target.value)} />
        </Field>
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Links</div>
          <div className="space-y-2">
            {links.map((link, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[160px_1fr_auto]">
                <Select value={link.network} onChange={(e) => setLinks(links.map((l, j) => (j === i ? { ...l, network: e.target.value as SocialNetwork } : l)))}>
                  {SOCIAL_NETWORKS.map((network) => (
                    <option key={network} value={network}>
                      {SOCIAL_LABELS[network]}
                    </option>
                  ))}
                </Select>
                <Input value={link.href} placeholder="https://" spellCheck={false} onChange={(e) => setLinks(links.map((l, j) => (j === i ? { ...l, href: e.target.value.trim() } : l)))} />
                <AdminButton type="button" variant="ghost" onClick={() => setLinks(links.filter((_, j) => j !== i))} aria-label={`Remove ${SOCIAL_LABELS[link.network]}`}>
                  ×
                </AdminButton>
              </div>
            ))}
          </div>
          {links.length < 8 && (
            <AdminButton type="button" variant="ghost" className="mt-2" onClick={() => setLinks([...links, { network: 'linkedin', href: '' }])}>
              + Add a link
            </AdminButton>
          )}
        </div>
        <div>
          <AdminButton type="button" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save'}
          </AdminButton>
        </div>
      </div>
      <MediaPicker
        open={picking}
        accept="image"
        onClose={() => setPicking(false)}
        onSelect={(media) => {
          setAvatarUrl(media.url);
          setPicking(false);
        }}
      />
    </Panel>
  );
}
