"use client";

import React from "react";

/**
 * Recreates Card 1 from Screen 3 of the reference UI:
 * Isometric crypto hardware server / vault with a mint green screen.
 */
export const CryptoHubIllustration: React.FC<{ className?: string }> = ({
  className = "w-28 h-28",
}) => {
  return (
    <svg
      viewBox="0 0 140 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer shadow / contour */}
      <path
        d="M60 20 L115 48 L115 105 L60 128 L15 95 L15 45 Z"
        stroke="#09090b"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Top Face */}
      <path
        d="M60 20 L115 48 L72 70 L15 45 Z"
        fill="#ffffff"
        stroke="#09090b"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Right Face */}
      <path
        d="M115 48 L115 105 L72 128 L72 70 Z"
        fill="#f4f4f5"
        stroke="#09090b"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Left Face */}
      <path
        d="M15 45 L72 70 L72 128 L15 95 Z"
        fill="#ffffff"
        stroke="#09090b"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Internal Server Vault Inset on Left Face */}
      <path
        d="M26 55 L62 73 L62 112 L26 90 Z"
        fill="#ffffff"
        stroke="#09090b"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* Mint Green Screen Screen Display (Matching Reference Image) */}
      <path
        d="M34 68 L54 78 L54 100 L34 88 Z"
        fill="#74f89d"
        stroke="#09090b"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Key / Slot inside mint screen */}
      <path
        d="M44 80 L44 91"
        stroke="#09090b"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="44" cy="79" r="2.5" fill="#09090b" />

      {/* Vents / Status Grids on Right Face */}
      <line x1="82" y1="80" x2="105" y2="68" stroke="#09090b" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="82" y1="88" x2="105" y2="76" stroke="#09090b" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="82" y1="96" x2="105" y2="84" stroke="#09090b" strokeWidth="1.2" strokeLinecap="round" />

      {/* LED indicators */}
      <circle cx="100" cy="98" r="1.5" fill="#74f89d" />
      <circle cx="100" cy="103" r="1.5" fill="#09090b" />
    </svg>
  );
};

/**
 * Recreates Card 2 from Screen 3 of the reference UI:
 * Isometric satellite dish antenna with mint green beacon.
 */
export const SatelliteIllustration: React.FC<{ className?: string }> = ({
  className = "w-28 h-28",
}) => {
  return (
    <svg
      viewBox="0 0 140 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Base Platform - Isometric Box */}
      <path
        d="M70 95 L115 110 L70 128 L25 110 Z"
        fill="#ffffff"
        stroke="#09090b"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M25 110 L70 128 L70 135 L25 117 Z"
        fill="#f4f4f5"
        stroke="#09090b"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M70 128 L115 110 L115 117 L70 135 Z"
        fill="#e4e4e7"
        stroke="#09090b"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Pivot Mount Column */}
      <path
        d="M64 80 L76 80 L76 98 L64 98 Z"
        fill="#09090b"
        stroke="#09090b"
        strokeWidth="1.2"
      />
      <ellipse cx="70" cy="80" rx="9" ry="4" fill="#ffffff" stroke="#09090b" strokeWidth="1.5" />

      {/* Tilted Satellite Dish (Elliptical contour) */}
      <g transform="rotate(-25 75 55)">
        {/* Outer dish */}
        <ellipse
          cx="75"
          cy="55"
          rx="32"
          ry="20"
          fill="#ffffff"
          stroke="#09090b"
          strokeWidth="1.5"
        />
        {/* Inner concentric contour */}
        <ellipse
          cx="75"
          cy="55"
          rx="22"
          ry="13"
          fill="#f4f4f5"
          stroke="#09090b"
          strokeWidth="1.2"
          strokeDasharray="2 2"
        />
        {/* Center feed horn arm */}
        <line x1="75" y1="55" x2="88" y2="28" stroke="#09090b" strokeWidth="2" strokeLinecap="round" />
        {/* Mint green beacon on antenna tip */}
        <circle cx="88" cy="28" r="4.5" fill="#74f89d" stroke="#09090b" strokeWidth="1.5" />
      </g>

      {/* Signal dot grid on base */}
      <circle cx="48" cy="111" r="1.2" fill="#09090b" />
      <circle cx="56" cy="114" r="1.2" fill="#09090b" />
      <circle cx="64" cy="117" r="1.2" fill="#09090b" />
    </svg>
  );
};

/**
 * Recreates Card 3 from Screen 3 of the reference UI:
 * Layered 3D isometric stack of slabs with vibrant mint green top block.
 */
export const LayeredCubesIllustration: React.FC<{ className?: string }> = ({
  className = "w-28 h-28",
}) => {
  return (
    <svg
      viewBox="0 0 140 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Bottom Slab */}
      <path
        d="M70 85 L118 102 L70 120 L22 102 Z"
        fill="#ffffff"
        stroke="#09090b"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M22 102 L70 120 L70 128 L22 110 Z"
        fill="#f4f4f5"
        stroke="#09090b"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M70 120 L118 102 L118 110 L70 128 Z"
        fill="#e4e4e7"
        stroke="#09090b"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Dots on bottom slab front */}
      <circle cx="42" cy="108" r="1.2" fill="#09090b" />
      <circle cx="52" cy="112" r="1.2" fill="#09090b" />

      {/* Middle Slab */}
      <path
        d="M70 65 L118 82 L70 100 L22 82 Z"
        fill="#ffffff"
        stroke="#09090b"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M22 82 L70 100 L70 108 L22 90 Z"
        fill="#f4f4f5"
        stroke="#09090b"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M70 100 L118 82 L118 90 L70 108 Z"
        fill="#e4e4e7"
        stroke="#09090b"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Dots on middle slab */}
      <circle cx="42" cy="88" r="1.2" fill="#09090b" />
      <circle cx="52" cy="92" r="1.2" fill="#09090b" />

      {/* Top Vibrant Mint Green Block (Matching Reference Image) */}
      <path
        d="M70 38 L118 55 L70 73 L22 55 Z"
        fill="#74f89d"
        stroke="#09090b"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M22 55 L70 73 L70 82 L22 64 Z"
        fill="#09090b"
        stroke="#09090b"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M70 73 L118 55 L118 64 L70 82 Z"
        fill="#18181b"
        stroke="#09090b"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      {/* Inset emblem on top face */}
      <path
        d="M62 48 L76 53 L70 61 L56 56 Z"
        fill="#ffffff"
        stroke="#09090b"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
};

