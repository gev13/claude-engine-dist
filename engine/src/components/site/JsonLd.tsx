/**
 * Emits one JSON-LD @graph per page. Serialised with a `<` escape so the blob
 * can never terminate the script element early.
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
