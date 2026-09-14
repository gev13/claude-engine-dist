// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/* ═══════════════════════════════════════════════════════════════════════════
   The Email screen, without a browser or a login (package 5)
   ───────────────────────────────────────────────────────────────────────────
   The data layer is mocked, so this is about what the screen shows and what
   it refuses to show: the stored password must never appear in the markup,
   and a reader without write permission must not get editable fields.
   ═══════════════════════════════════════════════════════════════════════════ */

const loaded = {
  mail: {
    enabled: true,
    host: 'smtp.example.com',
    port: 2525,
    secure: false,
    user: 'mailer@example.com',
    fromName: 'Studio North',
    fromEmail: 'hello@example.com',
    replyTo: 'replies@example.com',
    notifyEmails: ['alerts@example.com', 'second@example.com'],
    events: { enquiry: true, formSubmission: false, newsletter: false, security: true, engineUpdate: true },
    passwordSet: true,
  },
  problem: null,
};

vi.mock('swr', () => ({
  default: () => ({ data: loaded, isLoading: false, mutate: vi.fn() }),
}));

vi.mock('@/lib/admin/client', () => ({
  api: vi.fn(),
  fetcher: vi.fn(),
}));

const { EmailScreen } = await import('../../src/app/admin/(panel)/email/EmailScreen');

afterEach(cleanup);

const field = (root: HTMLElement, id: string) => root.querySelector<HTMLInputElement>(`#${id}`);

describe('the email screen', () => {
  it('shows what is stored, and never the password', () => {
    const { container } = render(<EmailScreen canWrite />);

    expect(field(container, 'mail-host')?.value).toBe('smtp.example.com');
    expect(field(container, 'mail-port')?.value).toBe('2525');
    expect(field(container, 'mail-user')?.value).toBe('mailer@example.com');
    expect(field(container, 'mail-fromemail')?.value).toBe('hello@example.com');
    // Several addresses come back as one editable line.
    expect(field(container, 'mail-notify')?.value).toBe('alerts@example.com, second@example.com');

    const password = field(container, 'mail-password');
    expect(password?.value).toBe('');
    expect(password?.getAttribute('type')).toBe('password');
    expect(container.innerHTML).not.toContain('mailer-password');
    expect(container.textContent).toContain('a password is stored');
  });

  it('offers to forget a stored password, and only when one is held', () => {
    const { container, unmount } = render(<EmailScreen canWrite />);
    expect(container.textContent).toContain('Forget the stored password');
    unmount();

    loaded.mail.passwordSet = false;
    const second = render(<EmailScreen canWrite />);
    expect(second.container.textContent).not.toContain('Forget the stored password');
    loaded.mail.passwordSet = true;
  });

  it('reflects which notifications are switched on', () => {
    const { container } = render(<EmailScreen canWrite />);
    const boxes = [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    // Sending on; forget-password off; then enquiry on, form submissions off,
    // newsletter off, security on, engine updates on.
    expect(boxes.map((box) => box.checked)).toEqual([true, false, true, false, false, true, true]);
  });

  it('gives a reader nothing to type in', () => {
    const { container } = render(<EmailScreen canWrite={false} />);

    const inputs = [...container.querySelectorAll<HTMLInputElement>('input, select')];
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs.every((input) => input.disabled)).toBe(true);

    // No save button — the word "Save" still appears in the instructions, so
    // the buttons are what to look at, not the text.
    const buttons = [...container.querySelectorAll('button')];
    expect(buttons.some((button) => button.textContent?.trim() === 'Save')).toBe(false);
    expect(buttons.filter((button) => button.textContent?.includes('Send a test message')).every((button) => button.disabled)).toBe(true);
  });
});
