export class ApiRequestError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
  }
}

interface ApiEnvelope<T> {
  data?: T;
  error?: { code: string; message: string; requestId: string };
}

/** Reads the (non-HTTP-only, by design) CSRF cookie so it can be echoed back in a header. */
export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)plt_csrf=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function request<T>(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  url: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const csrfToken = getCsrfToken();
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...extraHeaders,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;

  if (!response.ok || payload.error) {
    throw new ApiRequestError(
      payload.error?.code ?? "UNKNOWN_ERROR",
      payload.error?.message ?? "Something went wrong. Please try again.",
      response.status
    );
  }

  return payload.data as T;
}

/** POSTs JSON to a PLT API route and unwraps the { data } / { error } envelope. */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  return request<T>("POST", url, body);
}

export async function patchJson<T>(url: string, body: unknown): Promise<T> {
  return request<T>("PATCH", url, body);
}

export async function putJson<T>(url: string, body: unknown): Promise<T> {
  return request<T>("PUT", url, body);
}

export async function deleteJson<T>(url: string): Promise<T> {
  return request<T>("DELETE", url);
}

/** For financial-mutation endpoints that require an Idempotency-Key header. */
export async function postJsonIdempotent<T>(url: string, body: unknown, idempotencyKey: string): Promise<T> {
  return request<T>("POST", url, body, { "Idempotency-Key": idempotencyKey });
}
