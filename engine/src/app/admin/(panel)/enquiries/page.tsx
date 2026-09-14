import type { Metadata } from 'next';
import { EnquiriesScreen } from './EnquiriesScreen';

export const metadata: Metadata = { title: 'Contact enquiries' };
export const dynamic = 'force-dynamic';

export default function EnquiriesPage() {
  return <EnquiriesScreen />;
}
