/**
 * Haven Check brand palette — mirrors `web-portal/app/globals.css`
 * (navy scale + pink accent from logo)
 */
export const colors = {
  background: '#EFF4FB',
  surface: '#FFFFFF',
  white: '#FFFFFF',
  foreground: '#0C1C38',
  navy50: '#EFF4FB',
  navy100: '#DEE8F4',
  navy200: '#B9CCE8',
  navy300: '#8FA8D4',
  navy600: '#1A427F',
  navy700: '#163669',
  navy800: '#122A54',
  navy900: '#0C1C38',
  accent50: '#FFF8FA',
  accent100: '#FCEFF2',
  accent400: '#F5B7C1',
  /** Secondary body / meta text */
  textSecondary: '#163669',
  /** Muted labels, placeholders */
  textMuted: '#8FA8D4',
  border: '#DEE8F4',
  borderStrong: '#B9CCE8',
  /** Primary actions (replaces legacy iOS blue in app UI) */
  primary: '#1A427F',
  primaryPressed: '#163669',
  onPrimary: '#FFFFFF',
  /** Selected list row / light highlight */
  selection: '#E8EEF6',
} as const;

export type AppColors = typeof colors;
