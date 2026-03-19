// Theme B: Atacama Desert Night — primary theme
// All color, typography, spacing, and radius tokens from nightquest-style-guide.md

export const colors = {
  background: {
    base: '#050508',
    primary: '#080B18',
    surface: '#110D0A',
    elevated: '#1A1310',
  },
  accent: {
    primary: '#D4780A',
    primaryHover: '#B86508',
    secondary: '#C2622D',
    tertiary: '#E07B6A',
  },
  celestial: {
    ai: '#A78BFA',
    glow: '#FDE68A',
    field: '#E8DCC8',
  },
  text: {
    primary: '#F5F0E8',
    secondary: '#A89880',
    disabled: '#3D2E22',
    inverse: '#1A0C00',
  },
  status: {
    good: '#86EFAC',
    moderate: '#FDE68A',
    poor: '#F87171',
  },
  border: {
    default: '#2A1F18',
  },
} as const;

export const typography = {
  fontFamily: {
    display: 'SpaceGrotesk_700Bold',
    displayMedium: 'SpaceGrotesk_500Medium',
    body: 'DMSans_400Regular',
    bodyMedium: 'DMSans_500Medium',
    bodySemiBold: 'DMSans_600SemiBold',
    mono: 'JetBrainsMono_500Medium',
  },
  scale: {
    heading: {
      xlarge: { fontSize: 44, fontWeight: '700' as const, lineHeight: 44, letterSpacing: -0.88 },
      large:  { fontSize: 28, fontWeight: '700' as const, lineHeight: 34, letterSpacing: -0.56 },
      medium: { fontSize: 24, fontWeight: '700' as const, lineHeight: 29, letterSpacing: -0.48 },
      small:  { fontSize: 18, fontWeight: '700' as const, lineHeight: 23, letterSpacing: -0.18 },
    },
    body: {
      large:  { fontSize: 16, fontWeight: '400' as const, lineHeight: 26 },
      medium: { fontSize: 15, fontWeight: '400' as const, lineHeight: 24 },
      small:  { fontSize: 14, fontWeight: '400' as const, lineHeight: 21 },
    },
    label: {
      large:  { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
      medium: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18 },
      small:  { fontSize: 12, fontWeight: '500' as const, lineHeight: 17 },
    },
    caption: {
      regular: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
      small:   { fontSize: 11, fontWeight: '600' as const, lineHeight: 14, letterSpacing: 0.66, textTransform: 'uppercase' as const },
    },
    mono: {
      large: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
      small: { fontSize: 12, fontWeight: '500' as const, lineHeight: 17 },
    },
  },
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  '2xl': 14,
  '3xl': 16,
  '4xl': 20,
  '5xl': 24,
  '6xl': 32,
  '7xl': 40,
} as const;

export const borderRadius = {
  none: 0,
  xs: 3,
  sm: 4,
  md: 8,
  lg: 10,
  xl: 12,
  '2xl': 14,
  '3xl': 16,
  '4xl': 18,
  full: 100,
} as const;

export const shadows = {
  card: {
    hover: '0 4px 12px rgba(0,0,0,0.3)',
  },
  glow: {
    primary: {
      shadowColor: '#D4780A',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 4,
    },
    moon: {
      shadowColor: '#FDE68A',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 4,
    },
  },
} as const;

export const breakpoints = {
  mobile: 375,
  tablet: 768,
  web: 1280,
} as const;

export const layout = {
  mobile: {
    screenPadding: 16,
    headerHeight: 56,
    tabBarHeight: 80,
    chatButtonSize: 52,
  },
  tablet: {
    screenPadding: 24,
    headerHeight: 64,
    tabBarHeight: 90,
    chatButtonSize: 60,
  },
  web: {
    screenPadding: 32,
    headerHeight: 64,
    chatPanelWidth: 320,
    maxContentWidth: 1280,
  },
} as const;

// Single export for ergonomic usage: import { theme } from '@/constants/theme'
const theme = { colors, typography, spacing, borderRadius, shadows, breakpoints, layout } as const;
export default theme;
