import type { Metadata } from 'next';
import { MediaLibrary } from './MediaLibrary';

export const metadata: Metadata = { title: 'Media' };
export const dynamic = 'force-dynamic';

export default function MediaPage() {
  return <MediaLibrary />;
}
