import { requireUser } from "@/lib/auth/session";
import { ConversionClient } from "./conversion-client";

/**
 * Phase 5: Cryptocurrency Conversion Page
 * 
 * Server component that enforces authentication and renders the conversion UI.
 */
export default async function ConvertPage() {
  const user = await requireUser();

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Convert Crypto</h1>
        <p className="text-muted-foreground">
          Instantly convert between supported cryptocurrencies
        </p>
      </div>

      <ConversionClient userId={user.id} />
    </div>
  );
}
