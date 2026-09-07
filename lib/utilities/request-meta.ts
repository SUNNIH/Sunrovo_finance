import type { RequestMeta } from "@/lib/auth/session";

export function getRequestMeta(request: Request): RequestMeta {
  const forwarded = request.headers.get("x-forwarded-for");
  const ipAddress = forwarded ? forwarded.split(",")[0]?.trim() || null : null;
  const userAgent = request.headers.get("user-agent");
  return { ipAddress, userAgent };
}
