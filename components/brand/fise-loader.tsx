"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utilities/cn";

type FiseLoaderVariant = "mark" | "inline" | "page";

interface FiseLoaderProps {
  variant?: FiseLoaderVariant;
  className?: string;
  size?: "sm" | "md" | "lg";
  text?: string;
}

/**
 * FISE Holdings Trust Bank loader component.
 * Provides consistent loading feedback with FISE branding.
 *
 * - mark: Small inline logo with subtle pulse (for buttons/cards)
 * - inline: Logo with loading text (for form submissions)
 * - page: Full-page centered loader with background
 */
export function FiseLoader({
  variant = "inline",
  className,
  size = "md",
  text = "Loading...",
}: FiseLoaderProps) {
  const prefersReducedMotion = React.useMemo(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    []
  );

  const sizeClasses = {
    sm: "h-5 w-5",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  // Animation classes - subtle professional banking feel
  const spinClass = prefersReducedMotion ? "" : "animate-spin-slow";
  const pulseClass = prefersReducedMotion ? "" : "animate-pulse-subtle";

  if (variant === "page") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-4 p-8",
          className
        )}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={text}
      >
        <div
          className={cn(
            "relative flex items-center justify-center",
            sizeClasses.lg
          )}
        >
          <Image
            src="/brand/fise-mark.svg"
            alt=""
            width={48}
            height={48}
            className={cn("h-full w-full", pulseClass)}
            aria-hidden="true"
          />
          {!prefersReducedMotion && (
            <div
              className={cn(
                "absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary",
                spinClass
              )}
              aria-hidden="true"
            />
          )}
        </div>
        <div className="flex flex-col items-center gap-1">
          <Image
            src="/brand/fise-wordmark.svg"
            alt="FISE Holdings Trust Bank"
            width={120}
            height={28}
            className="h-7 w-auto opacity-60"
            aria-hidden="true"
          />
          {prefersReducedMotion ? (
            <span className={cn("text-text-tertiary font-medium", textSizeClasses.lg)}>
              {text}
            </span>
          ) : (
            <span
              className={cn(
                "text-text-tertiary font-medium animate-pulse-subtle",
                textSizeClasses.lg
              )}
            >
              {text}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div
        className={cn(
          "flex items-center gap-3",
          className
        )}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={text}
      >
        <div
          className={cn(
            "relative flex items-center justify-center",
            sizeClasses[size]
          )}
        >
          <Image
            src="/brand/fise-mark.svg"
            alt=""
            width={size === "sm" ? 20 : size === "md" ? 32 : 48}
            height={size === "sm" ? 20 : size === "md" ? 32 : 48}
            className={cn("h-full w-full", size === "sm" ? "" : pulseClass)}
            aria-hidden="true"
          />
          {!prefersReducedMotion && size !== "sm" && (
            <div
              className={cn(
                "absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary",
                spinClass
              )}
              aria-hidden="true"
            />
          )}
        </div>
        {text && (
          <span className={cn("text-text-secondary font-medium", textSizeClasses[size])}>
            {text}
          </span>
        )}
      </div>
    );
  }

  // mark variant - for buttons and small spaces
  return (
    <div
      className={cn("relative flex items-center justify-center", sizeClasses[size])}
      role="status"
      aria-hidden="true"
    >
      <Image
        src="/brand/fise-mark.svg"
        alt=""
        width={size === "sm" ? 20 : size === "md" ? 32 : 48}
        height={size === "sm" ? 20 : size === "md" ? 32 : 48}
        className={cn("h-full w-full", !prefersReducedMotion && pulseClass)}
      />
      {!prefersReducedMotion && (
        <div
          className={cn(
            "absolute inset-0 rounded-full border-2 border-primary/20",
            spinClass
          )}
        />
      )}
    </div>
  );
}

/**
 * Skeleton wrapper for consistency with FISE branding.
 */
export function FiseSkeleton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("animate-pulse bg-surface-hover rounded-md", className)}>
      {children}
    </div>
  );
}

/**
 * Page loader wrapper - use for full-page loading states.
 */
export function PageLoader({
  className,
  text = "Loading...",
}: {
  className?: string;
  text?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[400px] w-full items-center justify-center",
        className
      )}
    >
      <FiseLoader variant="page" text={text} />
    </div>
  );
}