import type { SVGProps } from "react";

const PATHS = {
  camera: (
    <>
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H7l1.6-2.2h6.8L17 6h1.5A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="12.8" r="3.8" />
    </>
  ),
  images: (
    <>
      <rect x="3" y="6" width="14" height="14" rx="2.5" />
      <path d="M7 3h11.5A2.5 2.5 0 0 1 21 5.5V17" />
      <path d="m3.5 17 4-4 3.5 3.5 2.5-2.5 3.5 3.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  retry: (
    <>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v5h-5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.6v.2" />
    </>
  ),
  flash: <path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  back: <path d="M15 5.5 8.5 12l6.5 6.5" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  alert: (
    <>
      <path d="M12 3.5 2.8 19.5h18.4z" />
      <path d="M12 10v4.5M12 17.2v.2" />
    </>
  ),
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  play: <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" />,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

export function Crown({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m2.5 8 5 4.2L12 4.5l4.5 7.7 5-4.2-2.2 11H4.7z" fill="#ffd45e" stroke="#7a4a00" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="12" cy="4.2" r="1.4" fill="#fff1b8" />
      <circle cx="2.6" cy="7.8" r="1.2" fill="#fff1b8" />
      <circle cx="21.4" cy="7.8" r="1.2" fill="#fff1b8" />
    </svg>
  );
}

/** Beer mat with a pint and a percent sign. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill="#f7a928" />
      <circle cx="32" cy="32" r="26" fill="none" stroke="#3a2008" strokeWidth="1.6" strokeDasharray="2.4 3.2" />
      <g transform="translate(-2.6 1)">
        <path d="M20.5 21h23l-2.6 25.2a3 3 0 0 1-3 2.8H26.1a3 3 0 0 1-3-2.8z" fill="#1a0e05" />
        <path
          d="M43.5 25.5h2.2a4 4 0 0 1 4 4v6.5a4 4 0 0 1-4 4h-3.1"
          fill="none"
          stroke="#1a0e05"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <g fill="#fff6e6">
          <circle cx="23.5" cy="19.5" r="4.4" />
          <circle cx="30" cy="17.2" r="5.2" />
          <circle cx="36.8" cy="18.2" r="4.8" />
          <circle cx="41.6" cy="20.6" r="3.6" />
          <rect x="20" y="19" width="24" height="4.2" rx="1.6" />
          <path d="M24.2 22.5h3.6v3.6a1.8 1.8 0 0 1-3.6 0z" />
        </g>
        <g fill="none" stroke="#f7a928" strokeWidth="2.4" strokeLinecap="round">
          <circle cx="28" cy="31.5" r="2.7" />
          <circle cx="36" cy="41" r="2.7" />
          <path d="M37.2 28.6 26.8 43.9" />
        </g>
      </g>
    </svg>
  );
}
