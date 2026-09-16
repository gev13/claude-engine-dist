// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CookieNotice } from '@/components/site/CookieNotice';
import { CONSENT_KEY, cookieNoticeSchema } from '@/lib/cookies';

/* ═══════════════════════════════════════════════════════════════════════════
   The cookie notice
   ───────────────────────────────────────────────────────────────────────────
   The rule everybody breaks is the first one: **nothing is stored until
   somebody answers**. A banner that writes a key in order to ask whether it
   may write keys is the joke about these things, and it is avoidable — the
   banner shows when the key is absent, so an unanswered visit writes nothing.

   The rest follows from that: an answer closes it for good, either answer is
   recorded, and blocked storage degrades to asking again rather than to a
   crash.
   ═══════════════════════════════════════════════════════════════════════════ */

const notice = (over: Record<string, unknown> = {}) =>
  cookieNoticeSchema.parse({ enabled: true, ...over });

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.consent;
  window.location.hash = '';
});

afterEach(cleanup);

const button = (root: HTMLElement, text: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);

describe('before anybody answers', () => {
  it('stores nothing at all', async () => {
    const { container } = render(<CookieNotice notice={notice()} />);
    await waitFor(() => expect(container.textContent).toContain('Accept'));
    expect(localStorage.length).toBe(0);
    expect(localStorage.getItem(CONSENT_KEY)).toBeNull();
  });

  it('shows the wording the editor wrote, not the engine’s', async () => {
    const { container } = render(
      <CookieNotice notice={notice({ title: 'Про куки', body: 'Мы используем только необходимые.' })} />,
    );
    await waitFor(() => expect(container.textContent).toContain('Про куки'));
    expect(container.textContent).toContain('Мы используем только необходимые.');
  });
});

describe('answering', () => {
  it('records an acceptance and closes for good', async () => {
    const { container } = render(<CookieNotice notice={notice()} />);
    await waitFor(() => expect(button(container, 'Accept')).toBeTruthy());

    fireEvent.click(button(container, 'Accept')!);

    expect(localStorage.getItem(CONSENT_KEY)).toBe('accepted');
    expect(container.textContent).not.toContain('Accept');
    // The stamp is the hook anything a site owner adds reads before it runs.
    expect(document.documentElement.dataset.consent).toBe('accepted');
  });

  it('records a rejection just as deliberately', async () => {
    const { container } = render(<CookieNotice notice={notice()} />);
    await waitFor(() => expect(button(container, 'Reject')).toBeTruthy());

    fireEvent.click(button(container, 'Reject')!);

    expect(localStorage.getItem(CONSENT_KEY)).toBe('rejected');
    expect(document.documentElement.dataset.consent).toBe('rejected');
  });

  it('never asks again once it has been answered', async () => {
    localStorage.setItem(CONSENT_KEY, 'rejected');
    const { container } = render(<CookieNotice notice={notice()} />);
    await waitFor(() => expect(document.documentElement.dataset.consent).toBe('rejected'));
    expect(container.textContent).toBe('');
  });

  /* A site that genuinely sets nothing optional may offer one button, and
     then a "Reject" that changed nothing would be dishonest. */
  it('offers one button when the editor said so', async () => {
    const { container } = render(<CookieNotice notice={notice({ showReject: false })} />);
    await waitFor(() => expect(button(container, 'Accept')).toBeTruthy());
    expect(button(container, 'Reject')).toBeUndefined();
  });
});

describe('what it refuses to do', () => {
  it('renders nothing at all while it is switched off', async () => {
    const { container } = render(<CookieNotice notice={notice({ enabled: false })} />);
    await waitFor(() => expect(container.textContent).toBe(''));
    expect(localStorage.length).toBe(0);
    expect(document.documentElement.dataset.consent).toBeUndefined();
  });

  it('leaves the policy link out rather than linking nowhere', async () => {
    const { container } = render(<CookieNotice notice={notice({ policyHref: '' })} />);
    await waitFor(() => expect(container.textContent).toContain('Accept'));
    expect(container.querySelector('a')).toBeNull();

    cleanup();
    const withLink = render(<CookieNotice notice={notice({ policyHref: '/privacy' })} />);
    await waitFor(() => expect(withLink.container.querySelector('a')).toBeTruthy());
    expect(withLink.container.querySelector('a')!.getAttribute('href')).toBe('/privacy');
  });

  /* A private window, or site data blocked entirely. Asking again next time
     is a worse experience and the only honest one; crashing a page over a
     banner is not a trade anybody would make. */
  it('survives a browser that refuses to store anything', async () => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('denied');
    };
    try {
      const { container } = render(<CookieNotice notice={notice()} />);
      await waitFor(() => expect(button(container, 'Accept')).toBeTruthy());
      expect(() => fireEvent.click(button(container, 'Accept')!)).not.toThrow();
      // It still closed, and the page still knows the answer for this visit.
      expect(container.textContent).not.toContain('Accept');
      expect(document.documentElement.dataset.consent).toBe('accepted');
    } finally {
      Storage.prototype.setItem = real;
    }
  });

  /* Only the centred variant dims the page and demands an answer; a bar is an
     announcement and must not trap anybody. */
  it('is a dialog only when it is centred', async () => {
    const bar = render(<CookieNotice notice={notice({ position: 'bottom-bar' })} />);
    await waitFor(() => expect(bar.container.querySelector('section')).toBeTruthy());
    expect(bar.container.querySelector('section')!.getAttribute('role')).toBe('region');
    expect(bar.container.querySelector('.he-cookie__scrim')).toBeNull();

    cleanup();
    const centre = render(<CookieNotice notice={notice({ position: 'centre' })} />);
    await waitFor(() => expect(centre.container.querySelector('section')).toBeTruthy());
    expect(centre.container.querySelector('section')!.getAttribute('role')).toBe('dialog');
    expect(centre.container.querySelector('.he-cookie__scrim')).toBeTruthy();
  });
});
