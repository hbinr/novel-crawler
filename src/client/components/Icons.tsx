// 内联 SVG 图标 — 24×24 viewBox，stroke 风格，1.5 描边
// 用组件而不是 <img> 避免额外请求；currentColor 让 CSS 控制颜色
import { type SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 16, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...rest,
  };
}

export const IconDashboard = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);

export const IconBook = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H18a1 1 0 0 1 1 1v15.5l-7-3-7 3V4.5Z" />
    <path d="M8 7h7" />
    <path d="M8 11h5" />
  </svg>
);

export const IconTask = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M8 3v4" />
    <path d="M16 3v4" />
    <path d="M3 10h18" />
    <path d="M8 14l2 2 4-4" />
  </svg>
);

export const IconLog = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 9l2 2 4-4" />
    <path d="M7 15h6" />
    <path d="M15 15h2" />
  </svg>
);

export const IconSettings = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.13.32.21.66.21 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </svg>
);

export const IconActivity = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

export const IconPlus = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
);

export const IconPlay = (p: IconProps) => (
  <svg {...base(p)}>
    <polygon points="6 4 20 12 6 20 6 4" fill="currentColor" />
  </svg>
);

export const IconRefresh = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 4v5h-5" />
  </svg>
);

export const IconTrash = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
);

export const IconChevronDown = (p: IconProps) => (
  <svg {...base(p)}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const IconCircleDot = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
  </svg>
);

export const IconEmpty = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
    <path d="M9 14h6" />
  </svg>
);

export const IconChevronLeft = (p: IconProps) => (
  <svg {...base(p)}>
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

export const IconChevronRight = (p: IconProps) => (
  <svg {...base(p)}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export const IconSearch = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

export const IconSparkle = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z" fill="currentColor" />
  </svg>
);

export const IconBolt = (p: IconProps) => (
  <svg {...base(p)}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" stroke="none" />
  </svg>
);

export const IconCheck = (p: IconProps) => (
  <svg {...base(p)}>
    <polyline points="4 12 10 18 20 6" />
  </svg>
);

export const IconList = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8 6h13" />
    <path d="M8 12h13" />
    <path d="M8 18h13" />
    <circle cx="4" cy="6" r="1" fill="currentColor" />
    <circle cx="4" cy="12" r="1" fill="currentColor" />
    <circle cx="4" cy="18" r="1" fill="currentColor" />
  </svg>
);

export const IconLayers = (p: IconProps) => (
  <svg {...base(p)}>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

export const IconTarget = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
  </svg>
);

export const IconEye = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const IconBell = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

export const IconLogout = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export const IconFolder = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
  </svg>
);

export const IconFile = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
  </svg>
);

export const IconSun = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m4.93 19.07 1.41-1.41" />
    <path d="m17.66 6.34 1.41-1.41" />
  </svg>
);

export const IconMoon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

export const IconMonitor = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8" />
    <path d="M12 16v4" />
  </svg>
);
