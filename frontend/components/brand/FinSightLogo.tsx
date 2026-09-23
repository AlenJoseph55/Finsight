"use client";

import React from "react";
import Image from "next/image";

export interface FinSightLogoProps {
  variant?: "full" | "mark";
  theme?: "light" | "dark";
  height?: number;
  className?: string;
  priority?: boolean;
  alt?: string;
}

// Exact aspect ratios from processed high-resolution source image
const FULL_LOGO_ASPECT_RATIO = 811 / 230; // ~3.526
const MARK_ASPECT_RATIO = 236 / 230; // ~1.026

export const FinSightLogo: React.FC<FinSightLogoProps> = ({
  variant = "full",
  theme = "light",
  height = 32,
  className = "",
  priority = true,
  alt = "FinSight",
}) => {
  const isMark = variant === "mark";
  const isDark = theme === "dark";

  const src = isMark
    ? isDark
      ? "/logo-mark-white.png"
      : "/logo-mark.png"
    : isDark
    ? "/logo-white.png"
    : "/logo.png";

  const width = Math.round(
    height * (isMark ? MARK_ASPECT_RATIO : FULL_LOGO_ASPECT_RATIO)
  );

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={`object-contain select-none shrink-0 ${className}`}
    />
  );
};

export default FinSightLogo;
