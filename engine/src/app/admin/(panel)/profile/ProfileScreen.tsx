'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import { AdminButton, Alert, Badge, Field, Input, Panel, Spinner } from '@/components/admin/ui';
import { ToastProvider, useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import { errorMessage } from '../_shared';

type Profile = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: 'admin' | 'manager' | 'editor' | 'author' | 'reviewer';
  totpEnabledAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

type Details = { firstName: string; lastName: string; username: string; email: string; phone: string };

const emptyDetails: Details = { firstName: '', lastName: '', username: '', email: '', phone: '' };

/** How long the "you have been signed out" notice stays up before the redirect. */
const SIGN_OUT_DELAY_MS = 3000;

export function ProfileScreen() {
  return (
    <ToastProvider>
      <ProfileScreenInner />
    </ToastProvider>
  );
}

function ProfileScreenInner() {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR<Profile>('/api/admin/profile', fetcher);

  const [details, setDetails] = useState<Details>(emptyDetails);
  const [savingDetails, setSavingDetails] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [signedOut, setSignedOut] = useState(false);

  // Seed the form once the profile arrives, and again if it is refetched.
  useEffect(() => {
    if (!data) return;
    setDetails({
      firstName: data.firstName,
      lastName: data.lastName,
      username: data.username,
      email: data.email,
      phone: data.phone ?? '',
    });
  }, [data]);

  async function saveDetails(event: React.FormEvent) {
    event.preventDefault();
    setSavingDetails(true);
    try {
      await api('/api/admin/profile', {
        method: 'PATCH',
        json: {
          firstName: details.firstName.trim(),
          lastName: details.lastName.trim(),
          username: details.username.trim(),
          email: details.email.trim(),
          phone: details.phone.trim() || null,
        },
      });
      toast('Your details were saved.', 'success');
      await mutate();
    } catch (error) {
      toast(errorMessage(error, 'Could not save your details.'), 'error');
    } finally {
      setSavingDetails(false);
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      toast('The new password and its confirmation do not match.', 'error');
      return;
    }

    setSavingPassword(true);
    try {
      await api('/api/admin/profile/password', { json: { currentPassword, newPassword } });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSignedOut(true);
      toast('Password changed. Every session has been signed out — sign in again.', 'success');
      // The change revokes every refresh token, this device's included.
      setTimeout(() => window.location.assign('/admin/login'), SIGN_OUT_DELAY_MS);
    } catch (error) {
      toast(errorMessage(error, 'Could not change your password.'), 'error');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <>
      <PageHeader title="Profile" description="Your own account: contact details, password and two-factor status." />

      {isLoading && <Spinner label="Loading your profile" />}

      {data && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Personal details">
            <form onSubmit={saveDetails} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" htmlFor="profile-first">
                  <Input
                    id="profile-first"
                    value={details.firstName}
                    onChange={(event) => setDetails({ ...details, firstName: event.target.value })}
                    maxLength={100}
                  />
                </Field>
                <Field label="Last name" htmlFor="profile-last">
                  <Input
                    id="profile-last"
                    value={details.lastName}
                    onChange={(event) => setDetails({ ...details, lastName: event.target.value })}
                    maxLength={100}
                  />
                </Field>
              </div>
              <Field label="Username" htmlFor="profile-username" hint="letters, numbers, . - _">
                <Input
                  id="profile-username"
                  value={details.username}
                  onChange={(event) => setDetails({ ...details, username: event.target.value })}
                  required
                  minLength={3}
                  maxLength={64}
                />
              </Field>
              <Field label="Email" htmlFor="profile-email">
                <Input
                  id="profile-email"
                  type="email"
                  value={details.email}
                  onChange={(event) => setDetails({ ...details, email: event.target.value })}
                  required
                  maxLength={255}
                />
              </Field>
              <Field label="Phone" htmlFor="profile-phone" hint="optional">
                <Input
                  id="profile-phone"
                  value={details.phone}
                  onChange={(event) => setDetails({ ...details, phone: event.target.value })}
                  maxLength={40}
                />
              </Field>

              <div className="flex items-center gap-3 pt-1">
                <AdminButton type="submit" disabled={savingDetails}>
                  {savingDetails ? 'Saving…' : 'Save details'}
                </AdminButton>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Role: {data.role}</span>
              </div>
            </form>
          </Panel>

          <div className="space-y-6">
            <Panel title="Change password">
              <form onSubmit={changePassword} className="space-y-4">
                <Field label="Current password" htmlFor="profile-current">
                  <Input
                    id="profile-current"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    required
                    maxLength={200}
                  />
                </Field>
                <Field label="New password" hint="at least 12 characters" htmlFor="profile-new">
                  <Input
                    id="profile-new"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                    minLength={12}
                    maxLength={200}
                  />
                </Field>
                <Field label="Confirm new password" htmlFor="profile-confirm">
                  <Input
                    id="profile-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    minLength={12}
                    maxLength={200}
                  />
                </Field>

                <p className="m-0 text-[13px] text-smoke">
                  Use at least 12 characters and three of lowercase, uppercase, numbers and symbols. Changing your
                  password signs out every session, on every device.
                </p>

                {signedOut && (
                  <Alert tone="success">
                    Password changed. All your sessions have been signed out — taking you to the sign-in page.
                  </Alert>
                )}

                <AdminButton type="submit" disabled={savingPassword || signedOut}>
                  {savingPassword ? 'Changing…' : 'Change password'}
                </AdminButton>
              </form>
            </Panel>

            <Panel title="Two-factor authentication">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone={data.totpEnabledAt ? 'live' : 'draft'}>
                  {data.totpEnabledAt ? 'enabled' : 'not enabled'}
                </Badge>
                {data.totpEnabledAt ? (
                  <p className="m-0 text-[14px] text-ash">
                    Enabled on {new Date(data.totpEnabledAt).toLocaleDateString('en-GB')}. An administrator can reset it
                    if you lose your authenticator.
                  </p>
                ) : (
                  <p className="m-0 text-[14px] text-ash">
                    Your account is protected by a password alone.{' '}
                    <Link href="/admin/two-factor?setup=1" className="text-flare-soft underline underline-offset-2">
                      Set up an authenticator app
                    </Link>
                    .
                  </p>
                )}
              </div>
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
