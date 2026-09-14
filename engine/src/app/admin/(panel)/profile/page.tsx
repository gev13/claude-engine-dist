import type { Metadata } from 'next';
import { ProfileScreen } from './ProfileScreen';

export const metadata: Metadata = { title: 'Profile' };
export const dynamic = 'force-dynamic';

export default function ProfilePage() {
  return <ProfileScreen />;
}
