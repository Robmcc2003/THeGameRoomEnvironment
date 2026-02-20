import Colors from '../../constants/Colors';
import { useColorScheme } from '../useColorScheme';

export type AppTheme = {
  scheme: 'light' | 'dark';
  colors: {
    background: string;
    card: string;
    text: string;
    tint: string;
    tabIconDefault: string;
    tabIconSelected: string;
    borderStrong: string;
    borderSubtle: string;
    mutedText: string;
    overlay: string;
    success: string;
    warning: string;
    danger: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    pill: number;
  };
  borderWidth: {
    hairline: number;
    regular: number;
  };
  shadow: {
    card: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
  };
};

// shared design tokens following current colour scheme
export function useAppTheme(): AppTheme {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const palette = Colors[scheme];

  const borderStrong = '#000000';
  const borderSubtle = scheme === 'dark' ? '#2A2D2F' : '#E6E6E6';

  return {
    scheme,
    colors: {
      background: palette.background,
      card: palette.card,
      text: palette.text,
      tint: palette.tint,
      tabIconDefault: palette.tabIconDefault,
      tabIconSelected: palette.tabIconSelected,
      borderStrong,
      borderSubtle,
      mutedText: scheme === 'dark' ? 'rgba(255,255,255,0.72)' : '#666666',
      overlay: 'rgba(0, 0, 0, 0.55)',
      success: '#28A745',
      warning: '#FFC107',
      danger: '#DC143C',
    },
    spacing: {
      xs: 8,
      sm: 12,
      md: 16,
      lg: 20,
      xl: 24,
    },
    radius: {
      sm: 10,
      md: 12,
      lg: 16,
      pill: 999,
    },
    borderWidth: {
      hairline: 1,
      regular: 2,
    },
    shadow: {
      card: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: scheme === 'dark' ? 0.25 : 0.12,
        shadowRadius: 6,
        elevation: 4,
      },
    },
  };
}

