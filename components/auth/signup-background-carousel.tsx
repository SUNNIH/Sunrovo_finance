"use client";

import * as React from "react";
import {
  BrandPeopleCarousel,
  type BrandPeopleCarouselProps,
  type CarouselImageItem,
  BRAND_PEOPLE_CAROUSEL_IMAGES,
} from "@/components/brand/brand-people-carousel";

export type { CarouselImageItem, BrandPeopleCarouselProps };
export const SIGNUP_CAROUSEL_IMAGES = BRAND_PEOPLE_CAROUSEL_IMAGES;

export interface SignupBackgroundCarouselProps {
  variant?: "desktop" | "mobile" | "all";
  className?: string;
}

/**
 * @deprecated Use BrandPeopleCarousel from "@/components/brand/brand-people-carousel" instead.
 */
export function SignupBackgroundCarousel({
  variant = "all",
  className,
}: SignupBackgroundCarouselProps) {
  return (
    <BrandPeopleCarousel
      variant="auth"
      mode={variant}
      className={className}
    />
  );
}

export { BrandPeopleCarousel };
