import { ShieldCheck, Wallet, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Secure account management",
    body: "Own and manage your accounts with authenticated, auditable controls.",
  },
  {
    icon: Zap,
    title: "Fast digital transfers",
    body: "Move funds between accounts and beneficiaries with clear confirmation.",
  },
  {
    icon: Wallet,
    title: "Integrated asset wallet",
    body: "Keep banking balances and digital assets together in one platform.",
  },
] as const;

export function AuthFeatureList() {
  return (
    <ul className="mt-8 flex flex-col gap-4">
      {FEATURES.map((feature) => (
        <li key={feature.title} className="flex gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-elevated/80 text-primary shadow-sm">
            <feature.icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-text-primary">{feature.title}</p>
            <p className="mt-0.5 text-body-sm text-text-secondary">{feature.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
