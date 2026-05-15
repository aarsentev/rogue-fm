"use client";

import { useId } from "react";

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  return [
    parseInt(m.slice(0, 2), 16),
    parseInt(m.slice(2, 4), 16),
    parseInt(m.slice(4, 6), 16),
  ];
}

function clamp(n: number) {
  return Math.max(0, Math.min(255, n));
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.round(clamp(n)).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mix(hex: string, amount: number, target: "white" | "black"): string {
  const [r, g, b] = hexToRgb(hex);
  const t = target === "white" ? 255 : 0;
  return rgbToHex(
    r + (t - r) * amount,
    g + (t - g) * amount,
    b + (t - b) * amount,
  );
}

type Props = {
  freq: string;
  name: string;
  color: string;
  size?: number;
  rounded?: number;
  className?: string;
};

export function Cover({
  freq,
  name,
  color,
  size = 200,
  rounded = 12,
  className,
}: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const lighter = mix(color, 0.35, "white");
  const darker = mix(color, 0.55, "black");

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={`${name} ${freq} FM cover art`}
      style={{ borderRadius: rounded, display: "block" }}
    >
      <defs>
        <linearGradient id={`grad-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={lighter} />
          <stop offset="0.55" stopColor={color} />
          <stop offset="1" stopColor={darker} />
        </linearGradient>
        <radialGradient
          id={`glow-${uid}`}
          cx="0.3"
          cy="0.25"
          r="0.8"
          fx="0.25"
          fy="0.2"
        >
          <stop offset="0" stopColor="white" stopOpacity="0.18" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`clip-${uid}`}>
          <rect width="200" height="200" rx={rounded} ry={rounded} />
        </clipPath>
      </defs>
      <g clipPath={`url(#clip-${uid})`}>
        <rect width="200" height="200" fill={`url(#grad-${uid})`} />
        <rect width="200" height="200" fill={`url(#glow-${uid})`} />
        <text
          x="100"
          y="118"
          fontSize="62"
          fontWeight="700"
          textAnchor="middle"
          fill="white"
          opacity="0.94"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="-2"
        >
          {freq}
        </text>
        <text
          x="100"
          y="160"
          fontSize="10"
          fontWeight="600"
          textAnchor="middle"
          fill="white"
          opacity="0.55"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="3"
        >
          {name.toUpperCase()}
        </text>
      </g>
    </svg>
  );
}
