import { requireAdmin } from "@/lib/auth/session";
import { ensureCsrfCookie } from "@/lib/auth/csrf";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  await ensureCsrfCookie();
  return <main className="min-h-screen bg-background px-4 py-6 sm:px-6"><div className="mx-auto max-w-[1400px]">{children}</div></main>;
}
