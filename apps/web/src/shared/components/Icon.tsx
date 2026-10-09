import type { SVGProps } from 'react';

/**
 * Small inline SVG icon set (no icon font, no external requests — CSP friendly). Icons are decorative by default;
 * meaning is always carried by adjacent text. An icon is one path or several; the navigation icons (home, sun,
 * calendar, clock, flower, bell) follow the myvedicstar-default theme's icon set (assets/icons/*.svg).
 */
const paths = {
  check: 'M20 6 9 17l-5-5',
  // Activity icons for Find a Good Time (keyed by the backend's icon keys, see features/good-time/activityIcons.ts).
  briefcase: ['M3 8h18v12H3z', 'M8 8V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3', 'M3 13h18'],
  plane: 'M21 15v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V8l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5.5Z',
  car: ['M5 17h14v-5l-2-5H7l-2 5Z', 'M3 12h18', 'M7 17v2M17 17v2', 'M7.5 14h.01M16.5 14h.01'],
  document: ['M6 3h9l4 4v14H6z', 'M14 3v5h5', 'M9 13h6M9 17h4'],
  lamp: ['M4 14c2 3 5 4 8 4s6-1 8-4H4Z', 'M12 14c-2-2-2-4 0-7 2 3 2 5 0 7Z', 'M9 21h6'],
  rings: ['M9 16a5 5 0 1 0 0-.01', 'M15 16a5 5 0 1 0 0-.01', 'M10 6l2-3 2 3'],
  more: ['M5 12h.01M12 12h.01M19 12h.01'],
  alert: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  locate:
    'M12 2v3m0 14v3M2 12h3m14 0h3m-4 0a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-4 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  search: 'm21 21-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z',
  info: 'M12 16v-4m0-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  home: 'm3 11 9-8 9 8v10h-6v-6H9v6H3Z',
  sun: [
    'M8 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0',
    'M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41',
  ],
  calendar: [
    'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
    'M16 3v4M8 3v4M3 10h18',
    'M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01',
  ],
  flower: [
    'M10 12a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
    'M12 10C7 7 8 3 12 3s5 4 0 7ZM14 12c3-5 7-4 7 0s-4 5-7 0ZM12 14c5 3 4 7 0 7s-5-4 0-7ZM10 12c-3 5-7 4-7 0s4-5 7 0Z',
  ],
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  sparkle: 'm12 3 1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3Z',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3Z',
  globe:
    'M12 21a9 9 0 1 0 0-18m0 18a9 9 0 1 1 0-18m0 18c2.5-2.5 3.5-6 3.5-9S14.5 5.5 12 3m0 18c-2.5-2.5-3.5-6-3.5-9S9.5 5.5 12 3M3.5 9h17m-17 6h17',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Zm0 16a2 2 0 0 1 2-2h13',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
  user: ['M8 8a4 4 0 1 0 8 0 4 4 0 1 0-8 0', 'M4 21c1-5 4-7 8-7s7 2 8 7'],
  settings: [
    'M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z',
  ],
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  chevronDown: 'm6 9 6 6 6-6',
  trash: 'M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3',
} as const satisfies Record<string, string | readonly string[]>;

export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 20,
  label,
  ...rest
}: { name: IconName; size?: number; label?: string } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  const d: string | readonly string[] = paths[name];
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
      focusable="false"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      {...rest}
    >
      {typeof d === 'string' ? <path d={d} /> : d.map((segment) => <path key={segment} d={segment} />)}
    </svg>
  );
}
