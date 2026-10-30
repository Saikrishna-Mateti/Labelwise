// Design tokens from design/DESIGN.md (light and dark). Older names (card, muted, primary...) are
// aliases kept while the remaining screens move to the new names.

import { useColorScheme } from 'react-native';

const core = {
  light: {
    bg: '#F6F6F3',
    surface: '#FFFFFF',
    fill: '#EFEFEC',
    border: '#E2E2DE',
    text: '#1C1C1E',
    textSecondary: '#5E6166',
    textTertiary: '#6E7176',
    accent: '#0E6B4E',
    accentTint: '#E3F0EA',
    onAccent: '#FFFFFF',
    grabber: '#C9C9C4',
  },
  dark: {
    bg: '#1A1B1D',
    surface: '#25272A',
    fill: '#2E3034',
    border: '#3A3D41',
    text: '#ECECEA',
    textSecondary: '#A5A8AD',
    textTertiary: '#8E9196',
    accent: '#5DBB93',
    accentTint: '#1E3229',
    onAccent: '#0F1A15',
    grabber: '#4A4D52',
  },
};

export type Tier = 'great' | 'moderate' | 'occasional' | 'rare';
export interface TierColors {
  ring: string;
  tint: string;
  fg: string;
}

const TIERS: Record<'light' | 'dark', Record<Tier, TierColors>> = {
  light: {
    great: { ring: '#2E8A66', tint: '#E5F2E9', fg: '#1D6A41' },
    moderate: { ring: '#C28A12', tint: '#FAF0D7', fg: '#7A5600' },
    occasional: { ring: '#D06A2A', tint: '#FCE7D8', fg: '#9A4511' },
    rare: { ring: '#B8463F', tint: '#F8E2DF', fg: '#9C2F28' },
  },
  dark: {
    great: { ring: '#5DBF85', tint: '#1F3328', fg: '#7FD3A2' },
    moderate: { ring: '#E8B84A', tint: '#3A3020', fg: '#F0C565' },
    occasional: { ring: '#EE9459', tint: '#3D2A1E', fg: '#F4A472' },
    rare: { ring: '#E2766D', tint: '#3E2423', fg: '#F0948C' },
  },
};

function build(scheme: 'light' | 'dark') {
  const c = core[scheme];
  const tiers = TIERS[scheme];
  return {
    ...c,
    tiers,
    // Aliases for screens not yet redesigned.
    card: c.surface,
    muted: c.textSecondary,
    primary: c.accent,
    onPrimary: c.onAccent,
    link: c.accent,
    pro: tiers.great.fg,
    con: tiers.rare.fg,
    star: tiers.moderate.ring,
    skeleton: c.fill,
    warningBg: tiers.moderate.tint,
  };
}

const light = build('light');
const dark = build('dark');
export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Camera screens use a fixed dark overlay whatever the system appearance. */
export const CAMERA = {
  control: 'rgba(20,20,20,0.55)',
  controlBorder: 'rgba(255,255,255,0.18)',
  hint: 'rgba(20,20,20,0.6)',
  active: '#7FD3A2',
};

export const SPACE = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 40 };
export const RADIUS = { card: 16, button: 14, thumb: 10 };

/** Type styles (iOS text styles). Sizes scale with Dynamic Type through allowFontScaling. */
export const TYPE = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  headlineL: { fontSize: 20, lineHeight: 25, fontWeight: '600' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  subheadline: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 11, lineHeight: 13, fontWeight: '600' },
} as const;

/** A see-through version of a #rrggbb colour. */
export const tint = (hex: string, opacity: number) =>
  hex +
  Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');
