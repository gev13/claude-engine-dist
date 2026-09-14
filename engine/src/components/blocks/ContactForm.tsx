import { getServices } from '@/server/content/services';
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
 */
export async function ContactFormBlock(p: Props) {
  const services = await getServices();
  return <ContactFormClient {...p} serviceOptions={services.map((s) => s.shortTitle)} />;
}
