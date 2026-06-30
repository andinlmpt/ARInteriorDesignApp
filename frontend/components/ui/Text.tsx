import React from 'react';
import { Text, TextProps } from 'react-native';
import { useTheme, ThemeColors } from '@/contexts/ThemeContext';
import { typography } from './theme';

type Variant = 'h1' | 'h2' | 'h3' | 'subtitle' | 'body' | 'small' | 'caption' | 'label';

interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: keyof ThemeColors;
  weight?: '400' | '500' | '600' | '700';
}

const variantMap: Record<Variant, { fontFamily?: string; fontSize: number; fontWeight: '400' | '500' | '600' | '700' | '800'; lineHeight?: number; letterSpacing?: number }> = {
  h1: { 
    fontFamily: typography.heading1.fontFamily,
    fontSize: typography.heading1.fontSize, 
    fontWeight: '800',
    lineHeight: typography.heading1.lineHeight,
    letterSpacing: typography.heading1.letterSpacing,
  },
  h2: { 
    fontFamily: typography.heading2.fontFamily,
    fontSize: typography.heading2.fontSize, 
    fontWeight: '700',
    lineHeight: typography.heading2.lineHeight,
    letterSpacing: typography.heading2.letterSpacing,
  },
  h3: { 
    fontFamily: typography.heading3.fontFamily,
    fontSize: typography.heading3.fontSize, 
    fontWeight: '700',
    lineHeight: typography.heading3.lineHeight,
    letterSpacing: typography.heading3.letterSpacing,
  },
  subtitle: { 
    fontFamily: typography.subtitle.fontFamily,
    fontSize: typography.subtitle.fontSize, 
    fontWeight: '600',
    lineHeight: typography.subtitle.lineHeight,
  },
  body: { 
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize, 
    fontWeight: '400',
    lineHeight: typography.body.lineHeight,
  },
  small: { 
    fontFamily: typography.small.fontFamily,
    fontSize: typography.small.fontSize, 
    fontWeight: '400',
    lineHeight: typography.small.lineHeight,
  },
  caption: { 
    fontFamily: typography.caption.fontFamily,
    fontSize: typography.caption.fontSize, 
    fontWeight: '500',
    lineHeight: typography.caption.lineHeight,
  },
  label: { 
    fontFamily: typography.label.fontFamily,
    fontSize: typography.label.fontSize, 
    fontWeight: '600',
    lineHeight: typography.label.lineHeight,
  },
};

export const AppText: React.FC<AppTextProps> = ({
  variant = 'body',
  color = 'textPrimary',
  weight,
  style,
  children,
  ...rest
}) => {
  const { colors } = useTheme();
  const variantStyle = variantMap[variant];

  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: variantStyle.fontFamily,
          fontSize: variantStyle.fontSize,
          fontWeight: weight ?? variantStyle.fontWeight,
          color: colors[color],
          lineHeight: variantStyle.lineHeight,
          letterSpacing: variantStyle.letterSpacing,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
};

export default AppText;
