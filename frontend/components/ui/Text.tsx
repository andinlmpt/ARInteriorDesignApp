import React from 'react';
import { Text, TextProps } from 'react-native';
import { useTheme, ThemeColors } from '@/contexts/ThemeContext';
import { typography } from './theme';

type Variant = 'h1' | 'h2' | 'h3' | 'subtitle' | 'body' | 'caption' | 'label';

interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: keyof ThemeColors;
  weight?: '400' | '500' | '600' | '700';
}

const variantMap: Record<Variant, { fontSize: number; fontWeight: '400' | '500' | '600' | '700' | '800'; lineHeight?: number; letterSpacing?: number }> = {
  h1: { 
    fontSize: typography.heading1.fontSize, 
    fontWeight: '800',
    lineHeight: typography.heading1.lineHeight,
    letterSpacing: typography.heading1.letterSpacing,
  },
  h2: { 
    fontSize: typography.heading2.fontSize, 
    fontWeight: '700',
    lineHeight: typography.heading2.lineHeight,
    letterSpacing: typography.heading2.letterSpacing,
  },
  h3: { 
    fontSize: typography.heading3.fontSize, 
    fontWeight: '700',
    lineHeight: typography.heading3.lineHeight,
    letterSpacing: typography.heading3.letterSpacing,
  },
  subtitle: { 
    fontSize: typography.subtitle.fontSize, 
    fontWeight: '600',
    lineHeight: typography.subtitle.lineHeight,
  },
  body: { 
    fontSize: typography.body.fontSize, 
    fontWeight: '400',
    lineHeight: typography.body.lineHeight,
  },
  caption: { 
    fontSize: typography.caption.fontSize, 
    fontWeight: '500',
    lineHeight: typography.caption.lineHeight,
  },
  label: { 
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

