import { Image, StyleSheet, Text, View, type ImageStyle, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { school, spacing } from '../theme';

const logo = require('../../assets/images/logo.png');

const SIZES = {
  sm: 36,
  md: 56,
  lg: 96,
  xl: 128,
} as const;

type LogoSize = keyof typeof SIZES;

export function BrandLogo({
  size = 'md',
  showName = false,
  showMotto = false,
  centered = false,
  style,
}: {
  size?: LogoSize;
  showName?: boolean;
  showMotto?: boolean;
  centered?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const dim = SIZES[size];
  return (
    <View style={[styles.wrap, centered && styles.centered, style]}>
      {showMotto ? (
        <Text style={[styles.motto, { color: colors.textMuted }]}>{school.motto}</Text>
      ) : null}
      <Image source={logo} style={{ width: dim, height: dim } as ImageStyle} resizeMode="contain" />
      {showName ? (
        <View style={centered ? styles.nameBlockCenter : styles.nameBlock}>
          <Text style={[styles.name, { color: colors.brandDark }]}>{school.name}</Text>
          <Text style={[styles.tag, { color: colors.textMuted }]}>{school.tagline}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function BrandMarkHeader({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <Image source={logo} style={styles.headerLogo} resizeMode="contain" />
      <View style={styles.headerText}>
        <Text style={[styles.headerKicker, { color: colors.brand }]}>{school.shortName}</Text>
        <Text style={[styles.headerTitle, { color: colors.brandDark }]}>{title}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  centered: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  motto: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  nameBlock: {
    gap: 2,
  },
  nameBlockCenter: {
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
  },
  tag: {
    fontSize: 12,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 12,
  },
  headerText: {
    gap: 1,
  },
  headerKicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
});
