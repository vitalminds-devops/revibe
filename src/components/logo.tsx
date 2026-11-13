import { useId } from "react";

/** ReVibe mark: a report with a check and an AI sparkle. Same drawing as app/icon.svg (the favicon). */
export function Logo({ size = 35 }: { size?: number }) {
  const gradient = useId();
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className="brand-logo"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b70e6" />
          <stop offset="1" stopColor="#5d41bf" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gradient})`} />
      <rect x="13" y="14" width="30" height="37" rx="6" fill="#fff" />
      <path
        d="M20 23h14M20 30h9"
        stroke="#cbbdf4"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M20 40.5l5 5 10-10"
        fill="none"
        stroke="#6a4fcf"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M47 7c1 6.5 3.5 9 10 10-6.5 1-9 3.5-10 10-1-6.5-3.5-9-10-10 6.5-1 9-3.5 10-10z"
        fill="#fff"
        stroke="#6a4fcf"
        strokeWidth="2.5"
        strokeLinejoin="round"
        paintOrder="stroke"
      />
    </svg>
  );
}
