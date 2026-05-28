export const colors = {
  bg: '#000000',
  surface: '#141414',
  surfaceAlt: '#1E1E1E',
  border: '#2C2C2C',
  borderStrong: '#3A3A3A',
  text: '#F0F0F0',
  textMuted: '#888888',
  textInverse: '#000000',

  primary: '#0A84FF',
  primaryDark: '#0060C0',
  primaryTint: '#0A2540',

  connected: '#30D158',
  connecting: '#FF9F0A',
  disconnected: '#FF453A',

  danger: '#FF453A',
  faderFill: '#0A84FF',
  faderTrack: '#2A2A2A',
} as const;

export const typography = {
  mono: 'Menlo',
  sans: 'System',
} as const;

export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 20,
} as const;

export const spacing = (n: number) => n * 4;
