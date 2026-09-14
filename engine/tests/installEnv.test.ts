import { beforeEach, describe, expect, it } from 'vitest';
import {
  allowAttempt,
  buildDatabaseUrl,
  checkDatabaseUrl,
  describeDbError,
  generateSecret,
  resetAttempts,
  setEnvValue,
} from '@/server/install/env';

const PARTS = { host: 'localhost', port: 5432, name: 'engine', user: 'postgres', password: 'postgres', ssl: false };

describe('setEnvValue', () => {
  it('replaces a line that is already there', () => {
    const out = setEnvValue('A=1\nDATABASE_URL=old\nB=2\n', 'DATABASE_URL', 'new');
    expect(out).toBe('A=1\nDATABASE_URL="new"\nB=2\n');
  });

  it('replaces a line written with export and odd spacing', () => {
    const out = setEnvValue('  export DATABASE_URL   = old\n', 'DATABASE_URL', 'new');
    expect(out).toBe('DATABASE_URL="new"\n');
  });

  it('appends when the key is absent, without doubling the final newline', () => {
    expect(setEnvValue('A=1\n', 'SETTINGS_SECRET', 'x')).toBe('A=1\nSETTINGS_SECRET="x"\n');
    expect(setEnvValue('A=1\n\n\n', 'SETTINGS_SECRET', 'x')).toBe('A=1\nSETTINGS_SECRET="x"\n');
    expect(setEnvValue('', 'SETTINGS_SECRET', 'x')).toBe('\nSETTINGS_SECRET="x"\n');
  });

  it('quotes the value, so a # in a password is not read as a comment', () => {
    const url = 'postgresql://u:p#ss@host:5432/db';
    const out = setEnvValue('DATABASE_URL=\n', 'DATABASE_URL', url);
    expect(out).toBe(`DATABASE_URL="${url}"\n`);
  });

  it('escapes quotes and backslashes', () => {
    expect(setEnvValue('', 'SETTINGS_SECRET', 'a"b\\c')).toBe('\nSETTINGS_SECRET="a\\"b\\\\c"\n');
  });

  it('refuses a value carrying a line break, which would forge another setting', () => {
    expect(() => setEnvValue('', 'SETTINGS_SECRET', 'x"\nAUTH_REQUIRE_2FA="false')).toThrow(/line break/i);
  });

  it('only ever touches the key it was given', () => {
    const before = 'AUTH_REQUIRE_2FA=true\nMEDIA_STORAGE_DIR=./storage/media\n';
    expect(setEnvValue(before, 'DATABASE_URL', 'x')).toContain('MEDIA_STORAGE_DIR=./storage/media');
    expect(setEnvValue(before, 'DATABASE_URL', 'x')).toContain('AUTH_REQUIRE_2FA=true');
  });
});

describe('buildDatabaseUrl', () => {
  it('builds a plain connection string', () => {
    expect(buildDatabaseUrl(PARTS)).toBe('postgresql://postgres:postgres@localhost:5432/engine');
  });

  it('asks for SSL when told to', () => {
    expect(buildDatabaseUrl({ ...PARTS, ssl: true })).toMatch(/\?sslmode=require$/);
  });

  it('encodes a password containing @ and /, so the host cannot be moved', () => {
    const url = buildDatabaseUrl({ ...PARTS, password: 'p@ss/word' });
    expect(url).toBe('postgresql://postgres:p%40ss%2Fword@localhost:5432/engine');
    // And it still parses back to the host the form showed.
    expect(new URL(url).hostname).toBe('localhost');
    expect(decodeURIComponent(new URL(url).password)).toBe('p@ss/word');
  });

  it('refuses a host that carries its own separators', () => {
    for (const host of ['evil.com/x', 'a@b', 'host name', 'h?q', 'h#f']) {
      expect(() => buildDatabaseUrl({ ...PARTS, host })).toThrow(/host name is not valid/i);
    }
  });

  it('refuses a port outside the range', () => {
    for (const port of [0, -1, 65_536, 1.5]) {
      expect(() => buildDatabaseUrl({ ...PARTS, port })).toThrow(/port is not valid/i);
    }
  });
});

describe('checkDatabaseUrl', () => {
  it('accepts both spellings of the scheme', () => {
    expect(checkDatabaseUrl(' postgresql://a@b/c ')).toBe('postgresql://a@b/c');
    expect(checkDatabaseUrl('postgres://a@b/c')).toBe('postgres://a@b/c');
  });

  it('refuses anything that is not Postgres', () => {
    for (const url of ['http://example.com', 'file:///etc/passwd', 'mysql://a@b/c', 'javascript:1']) {
      expect(() => checkDatabaseUrl(url)).toThrow(/postgresql:\/\//);
    }
  });
});

describe('describeDbError', () => {
  it('sends the operator somewhere useful for each common failure', () => {
    expect(describeDbError({ code: 'ECONNREFUSED' })).toMatch(/nothing is listening/i);
    expect(describeDbError({ code: 'ENOTFOUND' })).toMatch(/does not resolve/i);
    expect(describeDbError({ code: '28P01' })).toMatch(/refused those credentials/i);
    expect(describeDbError({ code: '3D000' })).toMatch(/does not exist/i);
    expect(describeDbError({ code: '42501' })).toMatch(/cannot create tables/i);
  });

  it("falls back to the driver's own words rather than swallowing them", () => {
    expect(describeDbError(new Error('boom'))).toContain('boom');
  });
});

describe('allowAttempt', () => {
  beforeEach(() => resetAttempts());

  it('stops one address after twenty tries, so this is not a port scanner', () => {
    const allowed = Array.from({ length: 25 }, () => allowAttempt('1.2.3.4'));
    expect(allowed.filter(Boolean)).toHaveLength(20);
    expect(allowed.slice(20).every((v) => v === false)).toBe(true);
  });

  it('counts each address separately', () => {
    for (let i = 0; i < 20; i += 1) allowAttempt('1.2.3.4');
    expect(allowAttempt('1.2.3.4')).toBe(false);
    expect(allowAttempt('5.6.7.8')).toBe(true);
  });

  it('forgives once the window has passed', () => {
    const start = Date.now();
    for (let i = 0; i < 20; i += 1) allowAttempt('1.2.3.4', start);
    expect(allowAttempt('1.2.3.4', start)).toBe(false);
    expect(allowAttempt('1.2.3.4', start + 15 * 60 * 1000 + 1)).toBe(true);
  });

  it('does not grow without bound when every request invents an address', () => {
    const now = Date.now();
    for (let i = 0; i < 500; i += 1) expect(allowAttempt(`10.0.0.${i}`, now)).toBe(true);
    expect(allowAttempt('10.1.1.1', now)).toBe(false);
  });
});

describe('generateSecret', () => {
  it('clears the 32-character floor env.ts enforces, and differs every time', () => {
    const a = generateSecret();
    const b = generateSecret();
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(a).not.toBe(b);
  });
});
