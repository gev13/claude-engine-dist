/**
 * A file out of a multipart body, whatever class it arrived as.
 *
 * `value instanceof File` asks whether the parser used *this* realm's File
 * class, which is not the question. A body parsed by a different copy of the
 * fetch machinery hands back a perfectly good file that fails the check, and
 * the upload is then refused as if nothing had been attached. Anything that
 * reads like a file — a size, a stream, bytes — is treated as one.
 */
export function uploadedFile(value: unknown): File | null {
  if (value === null || typeof value !== 'object') return null;
  if (typeof File !== 'undefined' && value instanceof File) return value;
  const v = value as Partial<File>;
  if (typeof v.size !== 'number' || typeof v.stream !== 'function' || typeof v.arrayBuffer !== 'function') return null;
  return value as File;
}

/** Every file in a form, in order. */
export function uploadedFiles(form: FormData): File[] {
  return [...form.values()].map(uploadedFile).filter((f): f is File => f !== null);
}

/**
 * What a multipart body actually carried, for an error message and the log:
 * each field's name and whether it came as a file or as text. Never values.
 */
export function describeUpload(form: FormData, request: Request): string {
  const fields = [...form.entries()].map(([name, value]) => `${name} (${uploadedFile(value) ? 'file' : typeof value === 'string' ? 'text' : 'unknown'})`);
  const length = request.headers.get('content-length');
  return `${fields.length ? fields.join(', ') : 'no fields'}${length ? `; ${length} bytes` : ''}`;
}
