"use client";

import { useId } from "react";

type Props = {
  size?: number;
  className?: string;
};

/** The Circle brand mark — open ring + orbital node (AI-model logo). */
export function CircleLogo({ size = 36, className = "" }: Props) {
  const uid = useId().replace(/:/g, "");
  const gradId = `circleBrand-${uid}`;
  const sheenId = `circleSheen-${uid}`;
  const glowId = `circleGlow-${uid}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label="The Circle"
      className={`shrink-0 ${className}`}
    >
      <defs>
        <linearGradient
          id={gradId}
          x1="18"
          y1="14"
          x2="112"
          y2="118"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#5CE1FF" />
          <stop offset="42%" stopColor="#6B8CFF" />
          <stop offset="78%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#FF7A3D" />
        </linearGradient>
        <linearGradient
          id={sheenId}
          x1="36"
          y1="20"
          x2="96"
          y2="100"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.75" />
          <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <filter id={glowId} x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle
        cx="64"
        cy="64"
        r="46"
        fill={`url(#${gradId})`}
        opacity="0.14"
        filter={`url(#${glowId})`}
      />
      <path
        d="M96.16 91.99 A42 42 0 1 1 96.16 36.01"
        stroke={`url(#${gradId})`}
        strokeWidth="17.5"
        strokeLinecap="round"
        filter={`url(#${glowId})`}
      />
      <path
        d="M96.16 91.99 A42 42 0 1 1 96.16 36.01"
        stroke={`url(#${sheenId})`}
        strokeWidth="7"
        strokeLinecap="round"
        opacity="0.9"
      />
      <circle
        cx="108.5"
        cy="64"
        r="9.25"
        fill={`url(#${gradId})`}
        filter={`url(#${glowId})`}
      />
      <circle cx="105.8" cy="61.2" r="3.1" fill="#FFFFFF" opacity="0.55" />
    </svg>
  );
}
