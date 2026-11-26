import { getServices } from '@/server/content/services';
import { getTheme } from '@/server/content/theme';
import { fieldsReachContact } from '@/lib/fieldsCss';
import { ContactFormClient } from './ContactFormBlock';
import type { z } from 'zod';
import type { blockSchemas } from '@/lib/blocks';

type Props = z.output<(typeof blockSchemas)['contactForm']>;

/**
 * Server wrapper for the contact form.
 *
 * The "what are you interested in?" checkboxes are the service catalogue, which
 * is read from the database — so the fetch happens here and the client
 * component receives a plain list of labels.
 *
 * 3.37 — and whether the theme's placeholder or text-box options are set, in
 * which case the fields carry `he-cf__input` for them (lib/fieldsCss.ts).
 */
export async function ContactFormBlock(p: Props) {
  const [services, theme] = await Promise.all([getServices(), getTheme()]);
  return <ContactFormClient {...p} serviceOptions={services.map((s) => s.shortTitle)} {...(fieldsReachContact(theme.fields) ? { themedFields: true } : {})} />;
}
