import { useColorScheme } from '@/shared/lib'

// Categorical palette, validated against both app surfaces: slot 1 (blue) is CTR,
// event types take the next slots in a fixed order so a type keeps its color
const PALETTE = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
}

const CHROME = {
  light: {
    surface: '#ffffff',
    grid: '#e2e8f0',
    axis: '#cbd5e1',
    ink: '#64748b',
    volume: '#cbd5e1',
    muted: '#e2e8f0',
  },
  dark: {
    surface: '#0f172a',
    grid: '#1e293b',
    axis: '#334155',
    ink: '#94a3b8',
    volume: '#475569',
    muted: '#1e293b',
  },
}

export type ChartTheme = (typeof CHROME)['light'] & {
  ctr: string
  /** Color of an event type by its position in the full list of types. */
  tag: (index: number) => string
}

export function useChartTheme(): ChartTheme {
  const scheme = useColorScheme()
  const palette = PALETTE[scheme]
  // Past the palette a type folds into the chart ink rather than a generated hue
  return { ...CHROME[scheme], ctr: palette[0], tag: (i) => palette[i + 1] ?? CHROME[scheme].ink }
}
