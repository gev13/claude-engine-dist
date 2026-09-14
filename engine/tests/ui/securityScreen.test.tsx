// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/* ═══════════════════════════════════════════════════════════════════════════
   The Security screen, without a browser or a login (package 5)
   ═══════════════════════════════════════════════════════════════════════════ */

const hour = 3_600_000;

const loaded = {
  settings: {
    maxFailures: 5,
    lockMinutes: 15,
    manualUnlockAfter: 3,
    autoBlockAfter: 5,
    autoBlockMinutes: 60,
    alertOnLockout: true,
  },
  blocks: [
    {
      ip: '203.0.113.9',
      reason: 'Too many refused requests (sign-in attempts)',
      expiresAt: new Date(Date.now() + hour).toISOString(),
      automatic: true,
      hits: 42,
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
    {
      ip: '198.51.100.4',
      reason: 'Blocked by an administrator',
      expiresAt: null,
      automatic: false,
      hits: 0,
      lastSeenAt: null,
      createdAt: new Date().toISOString(),
    },
  ],
  locked: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'sam@example.com',
      username: 'sam',
      role: 'editor',
      isActive: true,
      failedLoginCount: 7,
      // Stored far in the future when a lock waits for an administrator.
      lockedUntil: '9999-12-31T00:00:00.000Z',
      lastLoginAt: new Date(Date.now() - hour).toISOString(),
    },
  ],
  recent: [
    {
      id: 'e1',
      action: 'auth.login.failed',
      actorEmail: 'sam@example.com',
      summary: 'Failed sign-in attempt',
      ip: '203.0.113.9',
      createdAt: new Date().toISOString(),
    },
  ],
};

vi.mock('swr', () => ({ default: () => ({ data: loaded, isLoading: false, mutate: vi.fn() }) }));
vi.mock('@/lib/admin/client', () => ({ api: vi.fn(), fetcher: vi.fn() }));

const { SecurityScreen } = await import('../../src/app/admin/(panel)/security/SecurityScreen');

afterEach(cleanup);

const buttons = (root: HTMLElement) => [...root.querySelectorAll('button')].map((b) => b.textContent?.trim() ?? '');

describe('the security screen', () => {
  it('is honest about what it cannot do', () => {
    const { container } = render(<SecurityScreen canWrite />);
    expect(container.textContent).toContain('cannot absorb a large flood of traffic');
  });

  it('lists blocked addresses with how they got there', () => {
    const { container } = render(<SecurityScreen canWrite />);
    const text = container.textContent ?? '';
    expect(text).toContain('203.0.113.9');
    expect(text).toContain('automatic');
    expect(text).toContain('42 turned away');
    expect(text).toContain('198.51.100.4');
    expect(text).toContain('until removed');
  });

  it('shows a lock that waits for an administrator as exactly that', () => {
    const { container } = render(<SecurityScreen canWrite />);
    const text = container.textContent ?? '';
    expect(text).toContain('sam@example.com');
    expect(text).toContain('7 failed');
    // Not the year 9999.
    expect(text).toContain('until released');
    expect(text).not.toContain('9999');
  });

  it('carries the stored thresholds into the form', () => {
    const { container } = render(<SecurityScreen canWrite />);
    expect(container.querySelector<HTMLInputElement>('#sec-failures')?.value).toBe('5');
    expect(container.querySelector<HTMLInputElement>('#sec-lock')?.value).toBe('15');
    expect(container.querySelector<HTMLInputElement>('#sec-manual')?.value).toBe('3');
    expect(container.querySelector<HTMLInputElement>('#sec-auto')?.value).toBe('5');
    expect(container.querySelector<HTMLInputElement>('#sec-autolen')?.value).toBe('60');
  });

  it('lets an administrator act, and a reader only look', () => {
    const writer = render(<SecurityScreen canWrite />);
    expect(buttons(writer.container)).toContain('Block');
    expect(buttons(writer.container)).toContain('Unlock');
    expect(buttons(writer.container)).toContain('Remove');
    writer.unmount();

    const reader = render(<SecurityScreen canWrite={false} />);
    expect(buttons(reader.container)).not.toContain('Block');
    expect(buttons(reader.container)).not.toContain('Unlock');
    expect(buttons(reader.container)).not.toContain('Remove');
    expect([...reader.container.querySelectorAll<HTMLInputElement>('input')].every((input) => input.disabled)).toBe(true);
  });
});
