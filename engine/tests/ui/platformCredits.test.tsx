// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
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
