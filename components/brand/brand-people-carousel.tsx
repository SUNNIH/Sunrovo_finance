"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utilities/cn";

export interface CarouselImageItem {
  id: string;
  src: string;
  desktopPosition: string;
  mobilePosition: string;
}

export const BRAND_PEOPLE_CAROUSEL_IMAGES: readonly CarouselImageItem[] = [
  {
    id: "people-png",
    src: "/images/auth/signup-people.png",
    desktopPosition: "object-[15%_center]",
    mobilePosition: "object-top",
  },
  {
    id: "people1-webp",
    src: "/images/auth/signup-people1.webp",
    desktopPosition: "object-left",
    mobilePosition: "object-top",
  },
] as const;

export interface BrandPeopleCarouselProps {
  /**
   * Presentation variant:
   * - "hero": Integrated into homepage hero (people left, content readable, smooth fade; mobile faces visible)
   * - "auth": Shared auth visual (people left on desktop, dedicated image card above form on mobile/tablet)
   */
  variant?: "hero" | "auth";
  /**
   * Viewport targeting:
   * - "all": Renders both desktop and mobile viewports
   * - "desktop": Only renders desktop layer (hidden on mobile, lg:block)
   * - "mobile": Only renders mobile/tablet layer (lg:hidden)
   */
  mode?: "all" | "desktop" | "mobile";
  className?: string;
}

/**
 * Shared human visual carousel for FISE Holdings Trust Bank.
 * Used consistently across the Homepage Hero and Auth pages.
 *
 * - Smoothly cross-fades between 2 brand images on a 5.5s cycle with 1.5s ease-in-out transition.
 * - Respects `prefers-reduced-motion` with static first-frame rendering.
 * - Hero variant: People anchored left, smooth fade across hero, high content readability, faces visible on mobile/tablet.
 * - Auth variant: Desktop left-anchored background with smooth blend into forms; mobile/tablet banner above auth content.
 */
export function BrandPeopleCarousel({
  variant = "auth",
  mode = "all",
  className,
}: BrandPeopleCarouselProps) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  React.useEffect(() => {
    if (prefersReducedMotion) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev === 0 ? 1 : 0));
    }, 5500);

    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  const showDesktop = mode === "all" || mode === "desktop";
  const showMobile = mode === "all" || mode === "mobile";

  return (
    <>
      {/* ── Desktop Viewport ── */}
      {showDesktop && (
        <div
          className={cn(
            "pointer-events-none z-0 overflow-hidden hidden lg:block",
            variant === "hero" ? "absolute inset-0" : "fixed inset-0",
            className
          )}
          aria-hidden="true"
        >
          {BRAND_PEOPLE_CAROUSEL_IMAGES.map((img, index) => {
            const isCurrent = index === activeIndex;
            return (
              <div
                key={`desktop-${variant}-${img.id}`}
                className={cn(
                  "absolute inset-0 transition-opacity duration-[1500ms] ease-in-out motion-reduce:transition-none",
                  isCurrent ? "opacity-100 z-10" : "opacity-0 z-0"
                )}
              >
                <Image
                  src={img.src}
                  alt=""
                  fill
                  sizes="100vw"
                  priority={index === 0}
                  className={cn("object-cover", img.desktopPosition)}
                />
              </div>
            );
          })}

          {/* Atmospheric Wash */}
          <div className="absolute inset-0 z-20 bg-[#071328]/15" />
          <div className="absolute inset-0 z-20 bg-primary/5 mix-blend-overlay" />

          {/* Gradient Overlays tailored to variant */}
          {variant === "hero" ? (
            <>
              {/* Horizontal fade: People visible on left, softening under text, smooth fade into surface on right */}
              <div className="absolute inset-0 z-20 bg-gradient-to-r from-surface/50 via-surface/80 via-45% to-surface to-80%" />
              {/* Vertical blend for header & bottom border */}
              <div className="absolute inset-0 z-20 bg-gradient-to-b from-surface/40 via-transparent via-15% to-surface" />
            </>
          ) : (
            /* Auth Horizontal fade: People visible on left, fading into form background on right */
            <div className="absolute inset-0 z-20 bg-gradient-to-r from-transparent via-background/50 via-55% to-background to-85%" />
          )}
        </div>
      )}

      {/* ── Mobile / Tablet Viewport ── */}
      {showMobile && (
        variant === "hero" ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 h-[480px] sm:h-[560px] md:h-[620px] z-0 overflow-hidden lg:hidden",
              className
            )}
            aria-hidden="true"
          >
            {BRAND_PEOPLE_CAROUSEL_IMAGES.map((img, index) => {
              const isCurrent = index === activeIndex;
              return (
                <div
                  key={`mobile-hero-${img.id}`}
                  className={cn(
                    "absolute inset-0 transition-opacity duration-[1500ms] ease-in-out motion-reduce:transition-none",
                    isCurrent ? "opacity-100 z-10" : "opacity-0 z-0"
                  )}
                >
                  <Image
                    src={img.src}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    priority={index === 0}
                    className={cn("object-cover", img.mobilePosition || "object-top")}
                  />
                </div>
              );
            })}

            {/* Atmospheric wash */}
            <div className="absolute inset-0 z-20 bg-[#071328]/15" />
            <div className="absolute inset-0 z-20 bg-primary/5 mix-blend-overlay" />

            {/* Downward fade: Faces visible at top, fading smoothly into surface */}
            <div className="absolute inset-0 z-20 bg-gradient-to-b from-surface/50 via-surface/80 via-55% to-surface" />
          </div>
        ) : (
          <div
            className={cn(
              "relative w-full h-[240px] sm:h-[290px] md:h-[330px] overflow-hidden rounded-2xl border border-border/60 shadow-md lg:hidden mb-5 sm:mb-6",
              className
            )}
          >
            {BRAND_PEOPLE_CAROUSEL_IMAGES.map((img, index) => {
              const isCurrent = index === activeIndex;
              return (
                <div
                  key={`mobile-auth-${img.id}`}
                  className={cn(
                    "absolute inset-0 transition-opacity duration-[1500ms] ease-in-out motion-reduce:transition-none",
                    isCurrent ? "opacity-100 z-10" : "opacity-0 z-0"
                  )}
                >
                  <Image
                    src={img.src}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    priority={index === 0}
                    className={cn("object-cover", img.mobilePosition)}
                  />
                </div>
              );
            })}

            {/* Atmospheric wash */}
            <div className="absolute inset-0 z-20 bg-[#071328]/15" />
            <div className="absolute inset-0 z-20 bg-primary/5 mix-blend-overlay" />

            {/* Downward fade */}
            <div className="absolute inset-0 z-20 bg-gradient-to-b from-slate-950/25 via-transparent via-40% to-background" />

            {/* Minimal branding caption */}
            <div className="absolute inset-0 z-30 flex flex-col justify-end p-4 sm:p-6">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-950/60 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/95 backdrop-blur-md w-fit mb-1.5 shadow-xs">
                FISE Holdings Trust Bank
              </span>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white drop-shadow-md">
                Banking built around you.
              </h2>
              <p className="text-xs sm:text-sm font-medium text-blue-100/95 drop-shadow-sm">
                Secure. Simple. Personal.
              </p>
            </div>
          </div>
        )
      )}
    </>
  );
}
