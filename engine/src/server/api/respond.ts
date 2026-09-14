import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { ForbiddenError } from '@/server/auth/rbac';

export type ApiError = { error: string; details?: unknown };

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { status: 200, ...init });
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json<ApiError>({ error: message, details }, { status: 400 });
}

export function unauthorized(message = 'Authentication required.') {
  return NextResponse.json<ApiError>({ error: message }, { status: 401 });
}

export function forbidden(message = 'You do not have permission to do that.') {
  return NextResponse.json<ApiError>({ error: message }, { status: 403 });
}

export function notFound(message = 'Not found.') {
  return NextResponse.json<ApiError>({ error: message }, { status: 404 });
}

export function conflict(message: string) {
  return NextResponse.json<ApiError>({ error: message }, { status: 409 });
}

export function tooMany(retryAfter: number, message = 'Too many requests. Try again shortly.') {
  return NextResponse.json<ApiError>({ error: message }, {
    status: 429,
    headers: { 'Retry-After': String(Math.max(1, retryAfter)) },
  });
}

export function serverError(message = 'Something went wrong.') {
  return NextResponse.json<ApiError>({ error: message }, { status: 500 });
}

/** Parse and validate a JSON body. Returns a 400 response on failure. */
export async function readJson<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: badRequest('Request body must be valid JSON.') };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return { ok: false, response: badRequest('Some fields need attention.', details) };
  }

  return { ok: true, data: result.data };
}

/** Wrap a handler so thrown errors become correct responses, never stack traces. */
export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((error: unknown) => {
    if (error instanceof ForbiddenError) return forbidden();
    if (error instanceof ZodError) return badRequest('Some fields need attention.');
    console.error('[api] unhandled error', error);
    return serverError();
  });
}
