import type { Metadata } from "next";
import { AuthBackground } from "@/components/auth/auth-background";
import { AuthFeatureList } from "@/components/auth/auth-feature-list";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create Account" };

export default function RegisterPage() {
  return (
    <div data-auth-split className="relative w-full animate-fade-in">
      <AuthBackground />

      <div className="relative grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <section className="animate-fade-in-up max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Platinum Trust Bank
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl lg:text-5xl">
            Banking built for the next generation
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-text-secondary sm:text-base">
            Manage accounts, transfers, wallets and digital assets securely in one platform.
          </p>
          <AuthFeatureList />
        </section>

        <div className="mx-auto w-full max-w-md lg:ml-auto lg:mr-0">
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
