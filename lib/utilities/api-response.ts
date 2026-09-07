import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Consistent API responses (API design memory): success payloads are
 * `{ data }`, failures are always `{ error: { code, message, requestId } }`
 * — never a raw DB/provider error leaked to the client.
 */
export function apiSuccess<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function apiError(code: string, message: string, status: number) {
  return NextResponse.json(
    { error: { code, message, requestId: `req_${randomUUID()}` } },
    { status }
  );
}
