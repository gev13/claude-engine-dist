// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLATFORM_CREATOR, PLATFORM_NAME } from '@/lib/credits';
import { ENGINE_VERSION } from '@/lib/version';

/* 3.0 — Settings names the platform and who made it, read-only: the
   credits are the platform's, so there is nothing to type into. */

// One object for every render: the screen copies `data` into state in an effect keyed on it.
const loaded = vi.hoisted(() => ({ items: [] }));
vi.mock('swr', () => ({ default: () => ({ data: loaded, isLoading: false, mutate: vi.fn() }) }));
vi.mock('@/lib/admin/client', () => ({ api: vi.fn(), fetcher: vi.fn(), ApiError: class ApiError extends Error {} }));

const { SettingsScreen } = await import('../../src/app/(system)/admin/(panel)/settings/SettingsScreen');

afterEach(cleanup);

describe('the Platform panel', () => {
  it('names the platform, its creator and the version', () => {
    const { container } = render(<SettingsScreen />);
    const panel = [...container.querySelectorAll('section')].find((s) => s.textContent?.includes('Created by'))!;
    expect(panel).toBeTruthy();
    expect(panel.textContent).toContain(PLATFORM_NAME);
    expect(panel.textContent).toContain(PLATFORM_CREATOR);
    expect(panel.textContent).toContain(ENGINE_VERSION);
  });

  it('offers nothing to edit', () => {
    const { container } = render(<SettingsScreen />);
    const panel = [...container.querySelectorAll('section')].find((s) => s.textContent?.includes('Created by'))!;
    expect(panel.querySelectorAll('input, textarea, select, button')).toHaveLength(0);
  });
});

describe('3.32 — the tags are the site’s choice, and security.txt', () => {
  it('offers the platform tags as a switch that starts off', () => {
    const { container } = render(<SettingsScreen />);
    const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.includes('Name the platform in each page’s source'))!;
    expect(label).toBeTruthy();
    expect(label.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked).toBe(false);
  });

  it('says nothing is served until filled in, then previews the file', async () => {
    const { container, getByTestId } = render(<SettingsScreen />);
    expect(getByTestId('security-txt-status').textContent).toContain('Nothing is served until there is a contact');
    fireEvent.change(container.querySelector('#setting-securitytxt\\.contact')!, { target: { value: 'security@example.com' } });
    fireEvent.change(container.querySelector('#setting-securitytxt\\.expires')!, { target: { value: '2000-01-01' } });
    await waitFor(() => expect(getByTestId('security-txt-status').textContent).toContain('has passed'));
    const ahead = new Date(Date.now() + 200 * 86_400_000).toISOString().slice(0, 10);
    fireEvent.change(container.querySelector('#setting-securitytxt\\.expires')!, { target: { value: ahead } });
    await waitFor(() => expect(getByTestId('security-txt-status').querySelector('pre')!.textContent).toContain('Contact: mailto:security@example.com'));
  });
});
