import type { Metadata } from "next";
import { MfaForm } from "./mfa-form";

export const metadata: Metadata = { title: "Two-Factor Verification" };

export default function MfaPage() {
  return <MfaForm />;
}
