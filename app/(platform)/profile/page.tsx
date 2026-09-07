import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await getCurrentUser();

  const fields = [
    { label: "Full name", value: user?.profile?.fullName ?? "—" },
    { label: "Email", value: user?.email ?? "—" },
    { label: "Country", value: user?.profile?.country ?? "—" },
    { label: "Preferred currency", value: user?.profile?.preferredFiatCurrency ?? "—" },
    { label: "Account type", value: user?.profile?.accountType ?? "—" },
    { label: "Phone number", value: user?.profile?.phoneNumber ?? "—" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-page-title-mobile text-text-primary sm:text-page-title">Profile</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Editing, avatar upload, and preferences land in a later phase.
          </p>
        </div>
        <Badge variant={user?.profile?.kycStatus === "VERIFIED" ? "success" : "neutral"}>
          Identity: {user?.profile?.kycStatus ?? "NOT_STARTED"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label}>
              <p className="text-body-sm text-text-secondary">{field.label}</p>
              <p className="mt-0.5 text-sm font-medium text-text-primary">{field.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
