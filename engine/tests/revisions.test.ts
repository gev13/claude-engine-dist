import { describe, expect, it } from 'vitest';
import { snapshotFields, toSnapshot } from '@/server/content/revisions';

describe('revision snapshots', () => {
  it('keeps only the content columns for a page', () => {
    const row = {
      id: 'uuid-1',
      slug: 'about',
      path: '/about',
      title: 'About us',
      summary: 'Who we are.',
      blocks: [{ id: 'b1', type: 'cta' }],
      // These describe the row's place in the database, not its content.
      viewCount: 42,
      createdAt: new Date(),
      updatedAt: new Date(),
      authorId: 'uuid-2',
    };
    const snap = toSnapshot('page', row);

    expect(snap.title).toBe('About us');
    expect(snap.blocks).toEqual([{ id: 'b1', type: 'cta' }]);
    expect(snap).not.toHaveProperty('id');
    expect(snap).not.toHaveProperty('viewCount');
    expect(snap).not.toHaveProperty('updatedAt');
    expect(snap).not.toHaveProperty('authorId');
  });

  it('keeps only the content columns for a post', () => {
    const snap = toSnapshot('post', {
      id: 'uuid-1',
      slug: 'a-post',
      title: 'A post',
      body: 'text',
      viewCount: 99,
      publishedAt: new Date(),
    });
    expect(snap.title).toBe('A post');
    expect(snap).not.toHaveProperty('viewCount');
    expect(snap).not.toHaveProperty('publishedAt');
  });

  it('records a field that is present but null, and omits one that is absent', () => {
    const snap = toSnapshot('page', { title: 'T', navLabel: null });
    expect(snap).toHaveProperty('navLabel', null);
    expect(snap).not.toHaveProperty('summary');
  });

  /* A snapshot is JSON in a column. Restoring by spreading it would let a
     tampered row name any column on the table, so restore is built from this
     allowlist instead. */
  it('never lets a snapshot name a column outside the allowlist', () => {
    const snap = toSnapshot('page', {
      title: 'T',
      isSystem: true,
      authorId: 'someone-else',
      id: 'another-row',
    });
    expect(Object.keys(snap)).toEqual(['title']);

    for (const field of ['id', 'isSystem', 'authorId', 'createdAt', 'viewCount']) {
      expect(snapshotFields('page')).not.toContain(field);
      expect(snapshotFields('post')).not.toContain(field);
    }
  });

  it('produces equal snapshots for equal content, so a no-op save records nothing', () => {
    const a = toSnapshot('page', { title: 'T', blocks: [{ id: 'x' }], slug: 's' });
    const b = toSnapshot('page', { slug: 's', blocks: [{ id: 'x' }], title: 'T' });
    // Field order follows the allowlist, not the input, so this is stable.
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('no-op detection', () => {
  /* Postgres stores jsonb with its own key order, so a snapshot read back from
     the database never matches the key order of a freshly built object.
     Comparing them raw made every unchanged save look like a change. */
  it('is stable against the key order the database returns', () => {
    const fresh = toSnapshot('page', { title: 'T', slug: 's', summary: 'x' });
    // What jsonb hands back: same data, different key order.
    const fromDb = { summary: 'x', title: 'T', slug: 's' };

    expect(JSON.stringify(fresh)).not.toBe(JSON.stringify(fromDb));
    expect(JSON.stringify(toSnapshot('page', fromDb))).toBe(JSON.stringify(fresh));
  });
});
