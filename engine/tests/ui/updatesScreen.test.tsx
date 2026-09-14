// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/* ═══════════════════════════════════════════════════════════════════════════
   The Updates screen, without a browser or a login (package 6, tested in 7)
   ───────────────────────────────────────────────────────────────────────────
   Applying an update runs git, npm and a build on the server. Most of what
   follows is about the things standing in front of that button: a deployment
   where it is switched off says so instead of offering it, a reader never sees
   it, and an administrator has to type the words.

   The rest is about a run that went wrong — which step, why, and where the
   backup is. A failed update is exactly when somebody needs those three facts
   and exactly when they are least able to go looking.
   ═══════════════════════════════════════════════════════════════════════════ */

const store = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('swr', () => ({ default: () => ({ data: store.current, isLoading: false, mutate: vi.fn() }) }));
vi.mock('@/lib/admin/client', () => ({ api: vi.fn(), fetcher: vi.fn() }));

const { UpdatesScreen } = await import('../../src/app/admin/(panel)/updates/UpdatesScreen');

type Over = Record<string, unknown>;

function waiting(over: Over = {}, stateOver: Over = {}) {
  store.current = {
    version: '0.1.0',
    state: {
      autoCheck: true,
      checkedAt: '2026-09-14T10:00:00.000Z',
      latestVersion: '0.2.0',
      latestDate: '2026-09-20',
      latestSummary: 'Sliders, forms and backups.',
      latestUrl: 'https://github.com/gev13/claude-engine-dist/blob/main/CHANGELOG.md',
      requiresMigration: false,
      pending: [{ version: '0.2.0', date: '2026-09-20', summary: 'Sliders, forms and backups.' }],
      ...stateOver,
    },
    available: true,
    canApply: true,
    run: { status: 'idle', log: [] },
    ...over,
  };
}

afterEach(cleanup);

const buttonNamed = (root: HTMLElement, text: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);

const labels = (root: HTMLElement) => [...root.querySelectorAll('button')].map((b) => b.textContent?.trim());

describe('the updates screen', () => {
  it('says what this site runs and what is waiting for it', () => {
    waiting();
    const { container } = render(<UpdatesScreen canWrite />);
    const text = container.textContent ?? '';
    expect(text).toContain('0.1.0');
    expect(text).toContain('0.2.0 available');
    expect(text).toContain('What is waiting (1)');
    expect(text).toContain('Sliders, forms and backups.');
    expect(text).toContain('Last checked');
  });

  it('says it is up to date rather than leaving the question open', () => {
    waiting({ available: false }, { latestVersion: '0.1.0', pending: [] });
    const { container } = render(<UpdatesScreen canWrite />);
    expect(container.textContent).toContain('up to date');
    expect(container.textContent).not.toContain('What is waiting');
  });

  it('warns when a release touches the database, and says a backup comes first', () => {
    waiting({}, { requiresMigration: true });
    const { container } = render(<UpdatesScreen canWrite />);
    expect(container.textContent).toContain('One of these changes the database');
    expect(container.textContent).toContain('A backup is taken before anything is applied');
  });

  it('offers no button at all where updating is switched off, and says why', () => {
    waiting({ canApply: false });
    const { container } = render(<UpdatesScreen canWrite />);
    const text = container.textContent ?? '';
    expect(text).toContain('Updating from the panel is switched off on this deployment');
    expect(text).toContain('ENGINE_UPDATE_ENABLED=true');
    // The point of the message: no control that would fail if pressed.
    expect(labels(container)).not.toContain('Update to 0.2.0');
  });

  it('will not apply until the words are typed', () => {
    waiting();
    const { container } = render(<UpdatesScreen canWrite />);

    expect(container.textContent).toContain('Type update this site to update to 0.2.0.');
    expect(buttonNamed(container, 'Update to 0.2.0')?.disabled).toBe(true);

    const field = container.querySelector<HTMLInputElement>('input[aria-label="Confirmation"]')!;
    fireEvent.change(field, { target: { value: 'update' } });
    expect(buttonNamed(container, 'Update to 0.2.0')?.disabled).toBe(true);

    fireEvent.change(field, { target: { value: 'update this site' } });
    expect(buttonNamed(container, 'Update to 0.2.0')?.disabled).toBe(false);
  });

  it('gives a reader nothing that changes anything', () => {
    waiting();
    const { container } = render(<UpdatesScreen canWrite={false} />);

    expect(labels(container)).not.toContain('Check now');
    expect(labels(container)).not.toContain('Update to 0.2.0');
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.disabled).toBe(true);
    // Still told what the site runs — reading is not the thing being withheld.
    expect(container.textContent).toContain('0.2.0 available');
  });

  it('follows a run that is going, and warns that the site restarts at the end', () => {
    waiting({
      run: {
        status: 'running',
        target: '0.2.0',
        step: 'build',
        log: [
          { step: 'checks', ok: true, detail: 'ready' },
          { step: 'backup', ok: true, detail: 'engine-0.1.0.tar.gz' },
        ],
      },
    });
    const { container } = render(<UpdatesScreen canWrite />);
    const text = container.textContent ?? '';
    expect(text).toContain('Updating to 0.2.0 — build…');
    expect(text).toContain('✓ checks — ready');
    expect(text).toContain('That is the update finishing, not failing');
    // Nothing to press while it runs.
    expect(labels(container)).not.toContain('Update to 0.2.0');
  });

  it('names the step, the reason and the backup when a run fails', () => {
    waiting({
      run: {
        status: 'failed',
        target: '0.2.0',
        step: 'build',
        error: 'next build exited with code 1',
        backup: 'engine-0.1.0-2026-09-14T10-00-00-000Z.tar.gz',
        log: [
          { step: 'backup', ok: true, detail: 'taken' },
          { step: 'build', ok: false, detail: 'exited 1' },
        ],
      },
    });
    const { container } = render(<UpdatesScreen canWrite />);
    const text = container.textContent ?? '';
    expect(text).toContain('The update to 0.2.0 stopped at build.');
    expect(text).toContain('next build exited with code 1');
    expect(text).toContain('engine-0.1.0-2026-09-14T10-00-00-000Z.tar.gz');
    expect(text).toContain('under Backups');
    expect(text).toContain('✕ build — exited 1');
    expect(labels(container)).toContain('Clear this record');
  });

  it('does not let a reader clear the record of a failed run', () => {
    waiting({ run: { status: 'failed', target: '0.2.0', step: 'build', error: 'nope', log: [] } });
    const { container } = render(<UpdatesScreen canWrite={false} />);
    expect(container.textContent).toContain('stopped at build');
    expect(labels(container)).not.toContain('Clear this record');
  });

  it('says a check reads one file and runs nothing', () => {
    waiting();
    const { container } = render(<UpdatesScreen canWrite />);
    expect(container.textContent).toContain('Nothing is downloaded or run by checking');
  });

  it('shows why a check failed rather than looking as though it never ran', () => {
    waiting({ available: false }, { error: 'The release feed could not be read.', pending: [] });
    const { container } = render(<UpdatesScreen canWrite />);
    expect(container.textContent).toContain('The release feed could not be read.');
  });
});
