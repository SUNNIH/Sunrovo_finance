import Image from "next/image";
import { cn } from "@/lib/utilities/cn";

type FiseLogoVariant = "mark" | "wordmark";

interface FiseLogoProps {
  variant?: FiseLogoVariant;
  className?: string;
  alt?: string;
}

const LOGO_ASSETS: Record<FiseLogoVariant, { src: string; width: number; height: number }> = {
  mark: { src: "/brand/fise-mark.svg", width: 64, height: 64 },
  wordmark: { src: "/brand/fise-wordmark.svg", width: 260, height: 56 },
};

/** The shared Sunrovo Finance logo, with accessible alternative text. */
export function FiseLogo({
  variant = "wordmark",
  className,
  alt = "Sunrovo Finance",
}: FiseLogoProps) {
  const asset = LOGO_ASSETS[variant];

  return (
    <Image
      src={asset.src}
      alt={alt}
      width={asset.width}
      height={asset.height}
      className={cn("shrink-0", className)}
    />
  );
}
