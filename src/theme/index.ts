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
  con: '#b3261e',
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
  con: '#ff7a6e',
  star: '#ffc93c',
  skeleton: '#2c2c2e',
  warningBg: '#3d3000',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Band colours always appear next to the band's letter or number, never alone. */
export const NUTRISCORE_COLORS: Record<string, { bg: string; fg: string }> = {
  A: { bg: '#038141', fg: '#ffffff' },
  B: { bg: '#85bb2f', fg: '#111111' },
  C: { bg: '#fecb02', fg: '#111111' },
  D: { bg: '#ee8100', fg: '#111111' },
  E: { bg: '#e63e11', fg: '#ffffff' },
};

export const NOVA_COLORS: Record<number, { bg: string; fg: string }> = {
  1: { bg: '#038141', fg: '#ffffff' },
  2: { bg: '#fecb02', fg: '#111111' },
  3: { bg: '#ee8100', fg: '#111111' },
  4: { bg: '#e63e11', fg: '#ffffff' },
};

/** Overall band colours (dark green, light green, orange, red), always shown with the band word. */
export const OVERALL_COLORS: Record<'excellent' | 'good' | 'poor' | 'bad', string> = {
  excellent: '#038141',
  good: '#85bb2f',
  poor: '#ee8100',
  bad: '#e63e11',
};
