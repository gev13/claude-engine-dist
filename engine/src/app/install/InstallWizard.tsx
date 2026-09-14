'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { AdminButton, Alert, Field, Input, Select, Spinner } from '@/components/admin/ui';
import { api, fetcher } from '@/lib/admin/client';
import { cn } from '@/lib/utils';

type State = {
  installed: boolean;
  databaseReachable: boolean;
  schemaReady: boolean;
  userCount: number;
};

const STEPS = ['Database', 'Administrator', 'Site'] as const;

export function InstallWizard() {
  const { data, isLoading, mutate } = useSWR<State>('/api/install', fetcher, {
    refreshInterval: (d) => (d && !d.schemaReady ? 4000 : 0),
  });

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  const [admin, setAdmin] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirm: '',
  });
  const [site, setSite] = useState({
    name: '',
    tagline: '',
    timeZone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
  });

  /* The database step now configures rather than only reports: with no .env at
     all, this is where one gets written. */
  const [dbMode, setDbMode] = useState<'parts' | 'url'>('parts');
  const [dbUrl, setDbUrl] = useState('');
  const [dbParts, setDbParts] = useState({
    host: 'localhost',
    port: '5432',
    name: 'engine',
    user: 'postgres',
    password: '',
    ssl: false,
  });
  const [siteUrl, setSiteUrl] = useState('');
  const [restartNeeded, setRestartNeeded] = useState(false);

  const ready = data?.schemaReady === true;
  const reachable = data?.databaseReachable === true;

  /**
   * Configure the database.
   *
   * Two different jobs behind one button. When the database is already
   * reachable only the schema is missing, so nothing is written and the wizard
   * carries straight on. When it is not reachable, the details are proved,
   * .env is written, the schema is applied — and the process has to be
   * restarted before it can use any of it.
   */
  async function configure() {
    setProblem('');
    setBusy(true);
    try {
      const body = reachable
        ? {}
        : {
            database:
              dbMode === 'url'
                ? { mode: 'url', url: dbUrl }
                : {
                    mode: 'parts',
                    host: dbParts.host,
                    port: Number(dbParts.port),
                    name: dbParts.name,
                    user: dbParts.user,
                    password: dbParts.password,
                    ssl: dbParts.ssl,
                  },
            ...(siteUrl ? { siteUrl } : {}),
          };

      const result = await api<{ restartRequired: boolean }>('/api/install/env', {
        method: 'POST',
        json: body,
      });

      setRestartNeeded(result.restartRequired);
      void mutate();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'The database could not be configured.');
    } finally {
      setBusy(false);
    }
  }

  async function install() {
    setProblem('');

    if (admin.password !== admin.confirm) {
      setProblem('The two passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const result = await api<{ redirectTo: string }>('/api/install', {
        method: 'POST',
        json: {
          admin: {
            firstName: admin.firstName,
            lastName: admin.lastName,
            username: admin.username,
            email: admin.email,
            password: admin.password,
          },
          site: { name: site.name, tagline: site.tagline, timeZone: site.timeZone },
        },
      });
      // A full navigation, not a router push: the session cookies were just set
      // and everything downstream should be rendered with them.
      window.location.href = result.redirectTo;
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'The installation could not be completed.');
      setBusy(false);
      void mutate();
    }
  }

  if (isLoading) {
    return (
      <div className="py-10">
        <Spinner label="Checking the installation" />
      </div>
    );
  }

  if (data?.installed) {
    return (
      <Alert tone="info">
        This site is already installed. <Link href="/admin" className="underline">Go to the admin panel</Link>.
      </Alert>
    );
  }

  return (
    <>
      <ol className="mb-8 flex list-none gap-1 p-0">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1">
            <div
              className={cn(
                'border-b-2 pb-2 font-mono text-[10px] uppercase tracking-[0.12em]',
                i === step ? 'border-flare text-bone' : i < step ? 'border-flare/40 text-smoke' : 'border-hairline text-smoke',
              )}
            >
              {i + 1}. {label}
            </div>
          </li>
        ))}
      </ol>

      {problem && (
        <div className="mb-5">
          <Alert tone="error">{problem}</Alert>
        </div>
      )}

      {step === 0 && (
        <div className="space-y-5">
          {restartNeeded ? (
            <>
              <Alert tone="info">Saved. The connection works and the schema has been applied.</Alert>
              <p className="m-0 text-[15px] leading-relaxed text-ash">
                <strong className="text-bone">Now restart the site.</strong> The settings were written to{' '}
                <code className="font-mono text-flare-soft">.env</code>, and this process read its environment when it
                started — it cannot pick them up on its own. Under pm2 that is{' '}
                <code className="font-mono text-flare-soft">pm2 restart engine</code>; under systemd,{' '}
                <code className="font-mono text-flare-soft">systemctl restart</code> your service. Then reload this page
                and carry on.
              </p>
            </>
          ) : ready ? (
            <>
              <div className="border-2 border-hairline bg-surface p-4">
                <Row label="Database reachable" ok />
                <Row label="Schema applied" ok />
              </div>
              <AdminButton type="button" onClick={() => setStep(1)}>
                Continue
              </AdminButton>
            </>
          ) : reachable ? (
            <>
              <p className="m-0 text-[15px] leading-relaxed text-ash">
                The database answers, but it has no tables yet. This creates them — the schema, the triggers and the
                search index. Nothing is written to your configuration and no restart is needed.
              </p>

              <div className="border-2 border-hairline bg-surface p-4">
                <Row label="Database reachable" ok />
                <Row label="Schema applied" ok={false} />
              </div>

              <AdminButton type="button" onClick={() => void configure()} disabled={busy}>
                {busy ? 'Applying…' : 'Apply the schema'}
              </AdminButton>
            </>
          ) : (
            <>
              <p className="m-0 text-[15px] leading-relaxed text-ash">
                Where is the database? These details are tested before anything is saved, then written to{' '}
                <code className="font-mono text-flare-soft">.env</code> along with freshly generated session secrets.
                The database itself must already exist — this creates the tables inside it, not the database.
              </p>

              <Field label="Connection details">
                <Select value={dbMode} onChange={(e) => setDbMode(e.target.value as 'parts' | 'url')}>
                  <option value="parts">Enter them separately</option>
                  <option value="url">Paste a connection string</option>
                </Select>
              </Field>

              {dbMode === 'url' ? (
                <Field label="Connection string" hint="postgresql://user:password@host:5432/database">
                  <Input
                    value={dbUrl}
                    onChange={(e) => setDbUrl(e.target.value)}
                    placeholder="postgresql://user:password@host:5432/database"
                  />
                </Field>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Host">
                    <Input value={dbParts.host} onChange={(e) => setDbParts({ ...dbParts, host: e.target.value })} />
                  </Field>
                  <Field label="Port">
                    <Input
                      inputMode="numeric"
                      value={dbParts.port}
                      onChange={(e) => setDbParts({ ...dbParts, port: e.target.value })}
                    />
                  </Field>
                  <Field label="Database name">
                    <Input value={dbParts.name} onChange={(e) => setDbParts({ ...dbParts, name: e.target.value })} />
                  </Field>
                  <Field label="User">
                    <Input value={dbParts.user} onChange={(e) => setDbParts({ ...dbParts, user: e.target.value })} />
                  </Field>
                  <Field label="Password">
                    <Input
                      type="password"
                      value={dbParts.password}
                      onChange={(e) => setDbParts({ ...dbParts, password: e.target.value })}
                    />
                  </Field>
                  <Field label="SSL">
                    <label className="flex h-full items-center gap-2 text-[14px] text-ash">
                      <input
                        type="checkbox"
                        checked={dbParts.ssl}
                        onChange={(e) => setDbParts({ ...dbParts, ssl: e.target.checked })}
                      />
                      Require an encrypted connection
                    </label>
                  </Field>
                </div>
              )}

              <Field label="Site address" hint="optional — the real origin, e.g. https://example.com">
                <Input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://example.com" />
              </Field>

              <AdminButton
                type="button"
                onClick={() => void configure()}
                disabled={busy || (dbMode === 'url' ? !dbUrl : !dbParts.host || !dbParts.name || !dbParts.user)}
              >
                {busy ? 'Testing…' : 'Test and save'}
              </AdminButton>
            </>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <p className="m-0 text-[15px] leading-relaxed text-ash">
            Your own account. This is the only administrator that will exist, and it is created from what you type
            here — nothing is seeded with a known password.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name">
              <Input value={admin.firstName} onChange={(e) => setAdmin({ ...admin, firstName: e.target.value })} />
            </Field>
            <Field label="Last name">
              <Input value={admin.lastName} onChange={(e) => setAdmin({ ...admin, lastName: e.target.value })} />
            </Field>
            <Field label="Username" hint="letters, digits, dot, dash, underscore">
              <Input value={admin.username} onChange={(e) => setAdmin({ ...admin, username: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input type="email" value={admin.email} onChange={(e) => setAdmin({ ...admin, email: e.target.value })} />
            </Field>
            <Field label="Password" hint="at least 12 characters, three character classes">
              <Input
                type="password"
                value={admin.password}
                onChange={(e) => setAdmin({ ...admin, password: e.target.value })}
              />
            </Field>
            <Field label="Confirm password">
              <Input
                type="password"
                value={admin.confirm}
                onChange={(e) => setAdmin({ ...admin, confirm: e.target.value })}
              />
            </Field>
          </div>

          <div className="flex gap-2">
            <AdminButton type="button" variant="ghost" onClick={() => setStep(0)}>
              Back
            </AdminButton>
            <AdminButton
              type="button"
              onClick={() => setStep(2)}
              disabled={!admin.firstName || !admin.username || !admin.email || admin.password.length < 12}
            >
              Continue
            </AdminButton>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <p className="m-0 text-[15px] leading-relaxed text-ash">
            All of this is editable later in Settings.
          </p>

          <div className="grid gap-4">
            <Field label="Site name">
              <Input value={site.name} onChange={(e) => setSite({ ...site, name: e.target.value })} />
            </Field>
            <Field label="Tagline" hint="the default homepage title">
              <Input value={site.tagline} onChange={(e) => setSite({ ...site, tagline: e.target.value })} />
            </Field>
            <Field label="Time zone" hint="used when rendering dates">
              <Select value={site.timeZone} onChange={(e) => setSite({ ...site, timeZone: e.target.value })}>
                {[site.timeZone, 'UTC', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'Asia/Yerevan']
                  .filter((tz, i, all) => all.indexOf(tz) === i)
                  .map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>

          <div className="flex gap-2">
            <AdminButton type="button" variant="ghost" onClick={() => setStep(1)} disabled={busy}>
              Back
            </AdminButton>
            <AdminButton type="button" onClick={() => void install()} disabled={busy || !site.name}>
              {busy ? 'Installing…' : 'Install'}
            </AdminButton>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between border-b-2 border-hairline py-2 last:border-b-0">
      <span className="text-[14px] text-ash">{label}</span>
      <span className={cn('font-mono text-[11px] uppercase tracking-[0.12em]', ok ? 'text-flare-soft' : 'text-amber-400')}>
        {ok ? 'ready' : 'waiting'}
      </span>
    </div>
  );
}
