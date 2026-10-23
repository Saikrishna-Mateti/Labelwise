import { useColorScheme } from 'react-native';

const light = {
  bg: '#ffffff',
  card: '#f2f2f6',
  text: '#111111',
  muted: '#55555c',
  border: '#d1d1d6',
  primary: '#0b6e4f',
  onPrimary: '#ffffff',
  link: '#0a58ca',
  pro: '#0b6e4f',
  con: '#b4423c',
  star: '#c98a00',
  skeleton: '#e4e4ea',
  warningBg: '#fff4d6',
};

export type Theme = typeof light;

const dark: Theme = {
  bg: '#000000',
  card: '#1c1c1e',
  text: '#f5f5f7',
  muted: '#aeaeb2',
  border: '#3a3a3c',
  primary: '#4cc38a',
  onPrimary: '#002114',
  link: '#6ea8fe',
  pro: '#4cc38a',
  con: '#f08a80',
  star: '#ffc93c',
  skeleton: '#2c2c2e',
  warningBg: '#3d3000',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Band colours always appear next to the band's letter or number, never alone. */
export const NUTRISCORE_COLORS: Record<string, { bg: string; fg: string }> = {
  // Official Nutri-Score hues, softened to match the app; the letter always carries the grade.
  A: { bg: '#3f8f5f', fg: '#ffffff' },
  B: { bg: '#a3c26e', fg: '#1f2a10' },
  C: { bg: '#e8c868', fg: '#3a2e05' },
  D: { bg: '#e6a466', fg: '#3a2105' },
  E: { bg: '#d9726d', fg: '#ffffff' },
};

export const NOVA_COLORS: Record<number, { bg: string; fg: string }> = {
  1: { bg: '#3f8f5f', fg: '#ffffff' },
  2: { bg: '#e8c868', fg: '#3a2e05' },
  3: { bg: '#e6a466', fg: '#3a2105' },
  4: { bg: '#d9726d', fg: '#ffffff' },
};

/** Overall band colours (dark green, light green, orange, red), always shown with the band word. */
export const OVERALL_COLORS: Record<'excellent' | 'good' | 'poor' | 'bad', string> = {
  excellent: '#3f9a6e',
  good: '#8db35a',
  poor: '#e0954a',
  bad: '#dc6460',
};

/** A see-through version of a #rrggbb colour, for tinted card backgrounds in light and dark mode. */
export const tint = (hex: string, opacity: number) =>
  hex +
  Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');

/** Accent per nutrient card and rating tile; decoration only, the words carry the meaning. */
export const ACCENT = {
  saturatedFat: '#d9726d',
  energy: '#dca54c',
  sugars: '#9479c4',
  protein: '#4f9e77',
  inr: '#5b8fd6',
  nutriscore: '#d9726d',
  nova: '#9479c4',
};

type Band = keyof typeof OVERALL_COLORS;

/** Soft header/pill background and readable text per band (text ≥ 4.5:1 on its soft colour). */
const BAND_SHADES: Record<'light' | 'dark', Record<Band, { soft: string; text: string }>> = {
  light: {
    excellent: { soft: '#edf6f0', text: '#2e6f50' },
    good: { soft: '#f2f7ea', text: '#4a6a24' },
    poor: { soft: '#fbf3ea', text: '#95551c' },
    bad: { soft: '#fbefee', text: '#a8403c' },
  },
  dark: {
    excellent: { soft: '#13231a', text: '#7cc49d' },
    good: { soft: '#1d2414', text: '#b4cf8c' },
    poor: { soft: '#2b2014', text: '#e6b07a' },
    bad: { soft: '#2e1a1a', text: '#eb9b96' },
  },
};

export function useBandShades(band: Band | undefined) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return band ? { dot: OVERALL_COLORS[band], ...BAND_SHADES[scheme][band] } : undefined;
}
