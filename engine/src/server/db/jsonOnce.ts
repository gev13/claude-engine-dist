/**
 * 3.19 — JSON is decoded once, by drizzle. postgres.js decodes json/jsonb
 * itself and drizzle's jsonb column then runs `JSON.parse` on any string it
 * is handed, so a stored string that happens to be valid JSON — a year
 * "2026", a postcode "75008", "true" — came back as a number or a boolean
 * and failed its setting's schema. drizzle already makes the *serializers*
 * for these types transparent; this does the same for the parsers. Only
 * drizzle columns read JSON here (no raw queries or relational queries do).
 */
export function decodeJsonOnce<T extends { options: { parsers: Record<string, unknown> } }>(client: T): T {
  const asText = (value: string) => value;
  client.options.parsers['114'] = asText; // json
  client.options.parsers['3802'] = asText; // jsonb
  return client;
}
