'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import {
  AdminButton,
  Badge,
  EmptyState,
  Field,
  Input,
  Panel,
  Select,
  Spinner,
  Table,
  Td,
  Th,
} from '@/components/admin/ui';
import { ToastProvider, useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import { ROLE_CHOICES, type Role } from '@/lib/roles';
import { ConfirmDelete, Pagination, errorMessage, useDebounced } from '../_shared';

type UserRow = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  totpEnabledAt: string | null;
  lastLoginAt: string | null;
  lockedUntil: string | null;
  createdAt: string;
};

type ListResponse = { items: UserRow[]; total: number; page: number; perPage: number };

type FormState = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  role: Role;
  isActive: boolean;
  password: string;
};

const PER_PAGE = 20;

const emptyForm: FormState = {
  firstName: '',
  lastName: '',
  username: '',
  email: '',
  phone: '',
  role: 'editor',
  isActive: true,
  password: '',
};

function toForm(row: UserRow): FormState {
  return {
    firstName: row.firstName,
    lastName: row.lastName,
    username: row.username,
    email: row.email,
    phone: row.phone ?? '',
    role: row.role,
    isActive: row.isActive,
    password: '',
  };
}

function humanDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function UsersScreen({ currentUserId }: { currentUserId: string }) {
  return (
    <ToastProvider>
      <UsersScreenInner currentUserId={currentUserId} />
    </ToastProvider>
  );
}

function UsersScreenInner({ currentUserId }: { currentUserId: string }) {
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  /** null = form closed, 'new' = create, otherwise the id being edited. */
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const query = useDebounced(search.trim());

  // A new query always restarts at the first page.
  useEffect(() => {
    setPage(1);
  }, [query]);

  const params = new URLSearchParams({ page: String(page), perPage: String(PER_PAGE) });
  if (query) params.set('q', query);

  const { data, isLoading, mutate } = useSWR<ListResponse>(`/api/admin/users?${params.toString()}`, fetcher);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const editingRow = editing && editing !== 'new' ? items.find((item) => item.id === editing) ?? null : null;

  function openCreate() {
    setEditing('new');
    setForm(emptyForm);
    setConfirmReset(false);
  }

  function openEdit(row: UserRow) {
    setEditing(row.id);
    setForm(toForm(row));
    setConfirmReset(false);
  }

  function closeForm() {
    setEditing(null);
    setForm(emptyForm);
    setConfirmReset(false);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();

    // The row being edited comes from the current page of results; if a filter
    // or refresh dropped it, saving would silently do nothing.
    if (editing !== 'new' && !editingRow) {
      toast('That account is no longer in the list. Reopen it to edit.', 'error');
      return;
    }

    setSaving(true);

    try {
      if (editing === 'new') {
        await api('/api/admin/users', {
          json: {
            email: form.email.trim(),
            username: form.username.trim(),
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            phone: form.phone.trim() || null,
            role: form.role,
            isActive: form.isActive,
            password: form.password,
          },
        });
        toast(`Created account for ${form.email.trim()}.`, 'success');
      } else if (editingRow) {
        // Only changed fields are sent: the server revokes every session of a
        // user whose role, active state or password is touched, so resending
        // unchanged values would sign people out for nothing.
        const patch: Record<string, unknown> = {};
        if (form.firstName.trim() !== editingRow.firstName) patch.firstName = form.firstName.trim();
        if (form.lastName.trim() !== editingRow.lastName) patch.lastName = form.lastName.trim();
        if (form.username.trim() !== editingRow.username) patch.username = form.username.trim();
        if (form.email.trim() !== editingRow.email) patch.email = form.email.trim();
        if (form.phone.trim() !== (editingRow.phone ?? '')) patch.phone = form.phone.trim() || null;
        if (form.role !== editingRow.role) patch.role = form.role;
        if (form.isActive !== editingRow.isActive) patch.isActive = form.isActive;
        if (form.password) patch.password = form.password;

        if (Object.keys(patch).length === 0) {
          toast('Nothing has changed.', 'info');
          setSaving(false);
          return;
        }

        await api(`/api/admin/users/${editingRow.id}`, { method: 'PATCH', json: patch });
        toast(
          patch.password || patch.role !== undefined || patch.isActive !== undefined
            ? `Updated ${editingRow.email} — their sessions were signed out.`
            : `Updated ${editingRow.email}.`,
          'success',
        );
      }

      await mutate();
      closeForm();
    } catch (error) {
      toast(errorMessage(error, 'Could not save the account.'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function resetTwoFactor(row: UserRow) {
    setSaving(true);
    try {
      await api(`/api/admin/users/${row.id}`, { method: 'PATCH', json: { resetTwoFactor: true } });
      toast(`Two-factor cleared for ${row.email}. They will enrol again at their next sign-in.`, 'success');
      setConfirmReset(false);
      await mutate();
    } catch (error) {
      toast(errorMessage(error, 'Could not reset two-factor.'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: UserRow) {
    try {
      await api(`/api/admin/users/${row.id}`, { method: 'DELETE' });
      toast(`Deleted ${row.email}.`, 'success');
      if (editing === row.id) closeForm();
      await mutate();
    } catch (error) {
      // The server's guard rails (last admin, self-delete) arrive here.
      toast(errorMessage(error, 'Could not delete the account.'), 'error');
    }
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="Who can sign in to the panel, and what each of them may do. Administrators see everything; editors are limited to content."
        actions={<AdminButton onClick={openCreate}>New user</AdminButton>}
      />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <Field label="Search" htmlFor="user-search" className="w-[280px]">
          <Input
            id="user-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, username or email…"
          />
        </Field>
        <p className="m-0 pb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">
          {total} account{total === 1 ? '' : 's'}
        </p>
      </div>

      {editing && (
        <div className="mb-6">
          <Panel
            title={editing === 'new' ? 'New user' : `Edit ${editingRow?.email ?? 'user'}`}
            actions={
              <AdminButton variant="ghost" onClick={closeForm}>
                Cancel
              </AdminButton>
            }
          >
            <form onSubmit={save} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" htmlFor="user-first">
                  <Input
                    id="user-first"
                    value={form.firstName}
                    onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                    maxLength={100}
                  />
                </Field>
                <Field label="Last name" htmlFor="user-last">
                  <Input
                    id="user-last"
                    value={form.lastName}
                    onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                    maxLength={100}
                  />
                </Field>
                <Field label="Username" htmlFor="user-username" hint="letters, numbers, . - _">
                  <Input
                    id="user-username"
                    value={form.username}
                    onChange={(event) => setForm({ ...form, username: event.target.value })}
                    required
                    minLength={3}
                    maxLength={64}
                  />
                </Field>
                <Field label="Email" htmlFor="user-email">
                  <Input
                    id="user-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    required
                    maxLength={255}
                  />
                </Field>
                <Field label="Phone" htmlFor="user-phone" hint="optional">
                  <Input
                    id="user-phone"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    maxLength={40}
                  />
                </Field>
                <Field
                  label="Role"
                  htmlFor="user-role"
                  hint={ROLE_CHOICES.find((r) => r.value === form.role)?.hint}
                >
                  <Select
                    id="user-role"
                    value={form.role}
                    onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
                  >
                    {ROLE_CHOICES.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field
                label={editing === 'new' ? 'Password' : 'New password'}
                hint={editing === 'new' ? 'at least 12 characters' : 'leave blank to keep the current one'}
                htmlFor="user-password"
              >
                <Input
                  id="user-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  required={editing === 'new'}
                  minLength={editing === 'new' ? 12 : undefined}
                  maxLength={200}
                />
              </Field>
              <p className="m-0 text-[13px] text-smoke">
                Policy: at least 12 characters, using three of lowercase, uppercase, numbers and symbols, and never
                containing the username or email. Setting a password signs the account out everywhere.
              </p>

              <label className="flex items-center gap-2.5 text-[14px] text-ash">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                  className="h-4 w-4 accent-flare"
                />
                Account is active and may sign in
              </label>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <AdminButton type="submit" disabled={saving}>
                  {saving ? 'Saving…' : editing === 'new' ? 'Create user' : 'Save changes'}
                </AdminButton>

                {editingRow &&
                  (confirmReset ? (
                    <>
                      <AdminButton
                        type="button"
                        variant="danger"
                        onClick={() => void resetTwoFactor(editingRow)}
                        disabled={saving}
                      >
                        Confirm reset
                      </AdminButton>
                      <AdminButton type="button" variant="ghost" onClick={() => setConfirmReset(false)}>
                        Cancel
                      </AdminButton>
                    </>
                  ) : (
                    <AdminButton type="button" variant="secondary" onClick={() => setConfirmReset(true)} disabled={saving}>
                      Reset two-factor
                    </AdminButton>
                  ))}
              </div>

              {editingRow && (
                <p className="m-0 text-[13px] text-smoke">
                  Resetting two-factor clears the authenticator and recovery codes for an account that has lost its
                  device. The user enrols again the next time they sign in.
                </p>
              )}
            </form>
          </Panel>
        </div>
      )}

      {isLoading && <Spinner label="Loading users" />}

      {!isLoading && items.length === 0 && (
        <EmptyState
          title="No accounts match"
          body="Clear the search, or create the first account."
          action={<AdminButton onClick={openCreate}>New user</AdminButton>}
        />
      )}

      {items.length > 0 && (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Username</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th>Two-factor</Th>
              <Th>Last login</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const name = [row.firstName, row.lastName].filter(Boolean).join(' ') || '—';
              const isSelf = row.id === currentUserId;
              return (
                <tr key={row.id}>
                  <Td>
                    <span className="text-bone">{name}</span>
                    {isSelf && <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">you</span>}
                  </Td>
                  <Td>{row.username}</Td>
                  <Td>{row.email}</Td>
                  <Td>
                    <Badge tone={row.role === 'admin' || row.role === 'manager' ? 'alert' : 'neutral'}>
                      {row.role}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={row.isActive ? 'live' : 'archived'}>{row.isActive ? 'active' : 'disabled'}</Badge>
                  </Td>
                  <Td>
                    <Badge tone={row.totpEnabledAt ? 'live' : 'draft'}>{row.totpEnabledAt ? 'on' : 'not set up'}</Badge>
                  </Td>
                  <Td>{humanDate(row.lastLoginAt)}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <AdminButton variant="ghost" onClick={() => openEdit(row)}>
                        Edit
                      </AdminButton>
                      <ConfirmDelete
                        onConfirm={() => remove(row)}
                        warning={isSelf ? 'You cannot delete your own account.' : undefined}
                      />
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <Pagination page={page} perPage={PER_PAGE} total={total} onPage={setPage} />
    </>
  );
}
