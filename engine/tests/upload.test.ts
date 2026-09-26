import { describe, expect, it } from 'vitest';
import { describeUpload, uploadedFile, uploadedFiles } from '@/server/api/upload';

/* 3.4.1 — an upload is a file because it reads like one, not because the
   parser used this realm's File class. */

/** A file from another copy of the fetch machinery: every method, a different class. */
class ForeignFile {
  constructor(private bytes: Uint8Array<ArrayBuffer>, public name: string) {}
  get size() { return this.bytes.length; }
  type = 'application/gzip';
  stream() { return new Blob([this.bytes]).stream(); }
  arrayBuffer() { return new Blob([this.bytes]).arrayBuffer(); }
}

describe('uploaded files', () => {
  it('takes a File', () => {
    const f = new File(['x'], 'a.tar.gz');
    expect(uploadedFile(f)).toBe(f);
  });

  it('takes a file of another class that reads like one', () => {
    const f = new ForeignFile(new Uint8Array([1, 2, 3]), 'a.tar.gz');
    expect(uploadedFile(f)).toBe(f);
  });

  it('refuses text and nothing', () => {
    expect(uploadedFile('a.tar.gz')).toBeNull();
    expect(uploadedFile(null)).toBeNull();
    expect(uploadedFile({ size: 3 })).toBeNull();
  });

  it('lists every file in a form', () => {
    const form = new FormData();
    form.set('mode', 'inspect');
    form.append('a', new File(['1'], 'a.png'));
    form.append('b', new File(['2'], 'b.png'));
    expect(uploadedFiles(form).map((f) => f.name)).toEqual(['a.png', 'b.png']);
  });

  it('describes what arrived, names and kinds only', () => {
    const form = new FormData();
    form.set('file', 'secret-looking text');
    form.set('mode', 'inspect');
    const request = new Request('http://x/', { method: 'POST', headers: { 'content-length': '512' } });
    const said = describeUpload(form, request);
    expect(said).toBe('file (text), mode (text); 512 bytes');
    expect(said).not.toContain('secret');
  });
});
