import { DefaultTheme, type Theme } from '@react-navigation/native';
import { colors } from './colors';

/** React Navigation theme aligned with web portal chrome (navy + light surfaces) */
export const havenNavigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.foreground,
    border: colors.border,
    notification: colors.accent400,
  },
};
