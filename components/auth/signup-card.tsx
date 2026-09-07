import { Diamond, Fingerprint, Lock, Shield } from "lucide-react";
import { cn } from "@/lib/utilities/cn";

const TRUST_ITEMS = [
  { icon: Lock, label: "Secure authentication" },
  { icon: Fingerprint, label: "MFA supported" },
  { icon: Shield, label: "Protected financial environment" },
] as const;

interface SignupCardProps {
  children: React.ReactNode;
  className?: string;
  eyebrow?: string;
  title: string;
  description: string;
  titleAs?: "h1" | "h2";
}

export function SignupCard({
  children,
  className,
  eyebrow = "New customer",
  title,
  description,
  titleAs = "h1",
}: SignupCardProps) {
  const TitleTag = titleAs;

  return (
    <div className={cn("flex w-full flex-col gap-4", className)}>
      <div
        className={cn(
          "rounded-xl border border-border bg-surface-elevated/85 p-5 shadow-lg",
          "backdrop-blur-md sm:p-8",
          "animate-fade-in-up [animation-delay:80ms]"
        )}
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Diamond className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-text-primary">
              PLATINUM TRUST BANK
            </p>
            <p className="text-xs text-text-secondary">Secure digital banking</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
          <TitleTag className="mt-1 text-page-title-mobile text-text-primary sm:text-page-title">
            {title}
          </TitleTag>
          <p className="mt-2 text-sm text-text-secondary">{description}</p>
        </div>

        {children}
      </div>

      <ul className="flex flex-col gap-2">
        {TRUST_ITEMS.map((item) => (
          <li
            key={item.label}
            className="flex items-center gap-2 rounded-lg border border-border/80 bg-surface-elevated/60 px-3 py-2.5 text-body-sm text-text-secondary backdrop-blur-sm"
          >
            <item.icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
