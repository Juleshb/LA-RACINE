import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { AppIcon, type AppIconName } from './AppIcon';
import { useTheme } from '@/src/context/ThemeContext';
import { radius, spacing, type ThemeColors } from '../theme';

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md + 2,
      borderWidth: 2,
      borderColor: colors.brandBorder,
      shadowColor: colors.brandDark,
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.brandDark,
    },
    subtitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.brandDark,
    },
    muted: {
      fontSize: 15,
      color: colors.textMuted,
      lineHeight: 22,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.roseSoft,
      borderRadius: radius.md,
      padding: 12,
    },
    error: {
      flex: 1,
      color: colors.danger,
      fontSize: 14,
      fontWeight: '600',
    },
    empty: {
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
      backgroundColor: colors.surface,
      paddingVertical: spacing.lg,
    },
    emptyIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.brandSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.brandDark,
      textAlign: 'center',
    },
    emptyMessage: {
      fontSize: 15,
      color: colors.textMuted,
      lineHeight: 22,
      textAlign: 'center',
    },
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      gap: spacing.sm,
    },
    loadingLabel: {
      marginTop: 8,
      fontSize: 15,
      fontWeight: '700',
      color: colors.brandDark,
    },
    button: {
      borderRadius: radius.pill,
      paddingVertical: 16,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 56,
    },
    buttonInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    buttonPrimary: {
      backgroundColor: colors.brand,
      shadowColor: colors.brand,
      shadowOpacity: 0.35,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    buttonSecondary: {
      backgroundColor: colors.brandSoft,
      borderWidth: 2,
      borderColor: colors.brandBorder,
    },
    buttonDanger: {
      backgroundColor: colors.danger,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      fontSize: 17,
      fontWeight: '800',
    },
    buttonTextPrimary: {
      color: '#fff',
    },
    buttonTextSecondary: {
      color: colors.brandDark,
    },
    inputWrap: {
      gap: 8,
    },
    label: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.brandDark,
    },
    input: {
      backgroundColor: colors.inputBg,
      borderWidth: 2,
      borderColor: colors.brandBorder,
      borderRadius: radius.md,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 17,
      color: colors.text,
      minHeight: 54,
    },
    badge: {
      alignSelf: 'flex-start',
      borderRadius: radius.pill,
      paddingHorizontal: 12,
      paddingVertical: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    badgeText: {
      fontSize: 13,
      fontWeight: '800',
    },
  });
}

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={StyleSheet.flatten([styles.screen, style])}>{children}</View>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={StyleSheet.flatten([styles.card, style])}>{children}</View>;
}

export function Title({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <Text style={styles.muted}>{children}</Text>;
}

export function ErrorText({ children }: { children?: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (!children) return null;
  return (
    <View style={styles.errorBox}>
      <AppIcon name="sad" size={20} color={colors.danger} />
      <Text style={styles.error}>{children}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  message,
  icon = 'star',
  iconColor,
}: {
  title: string;
  message?: string;
  icon?: AppIconName;
  iconColor?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Card style={styles.empty}>
      <View style={styles.emptyIconWrap}>
        <AppIcon name={icon} size={36} color={iconColor || colors.brand} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
    </Card>
  );
}

export function LoadingBlock({ label = 'Just a moment…' }: { label?: string } = {}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.loading}>
      <AppIcon name="rocket" size={40} color={colors.brand} />
      <ActivityIndicator size="large" color={colors.brand} />
      <Text style={styles.loadingLabel}>{label}</Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  disabled,
  variant = 'primary',
  loading,
  icon,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  icon?: AppIconName;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const textColor = isPrimary || isDanger ? '#fff' : colors.brandDark;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) =>
        StyleSheet.flatten([
          styles.button,
          isPrimary && styles.buttonPrimary,
          variant === 'secondary' && styles.buttonSecondary,
          isDanger && styles.buttonDanger,
          (disabled || loading) && styles.buttonDisabled,
          pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 },
        ])
      }
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <AppIcon name={icon} size={20} color={textColor} /> : null}
          <Text
            style={StyleSheet.flatten([
              styles.buttonText,
              (isPrimary || isDanger) && styles.buttonTextPrimary,
              variant === 'secondary' && styles.buttonTextSecondary,
            ])}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label?: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { label, style, ...rest } = props;
  return (
    <View style={styles.inputWrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={StyleSheet.flatten([styles.input, style])}
        {...rest}
      />
    </View>
  );
}

export function Badge({
  label,
  tone = 'brand',
  icon,
}: {
  label: string;
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'teal';
  icon?: AppIconName;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const bg =
    tone === 'success'
      ? colors.limeSoft
      : tone === 'warning'
        ? colors.yellowSoft
        : tone === 'danger'
          ? colors.roseSoft
          : tone === 'teal'
            ? colors.tealSoft
            : colors.brandSoft;
  const fg =
    tone === 'success'
      ? colors.success
      : tone === 'warning'
        ? colors.warning
        : tone === 'danger'
          ? colors.danger
          : tone === 'teal'
            ? colors.teal
            : colors.brandDark;
  return (
    <View style={StyleSheet.flatten([styles.badge, { backgroundColor: bg }])}>
      {icon ? <AppIcon name={icon} size={14} color={fg} /> : null}
      <Text style={StyleSheet.flatten([styles.badgeText, { color: fg }])}>{label}</Text>
    </View>
  );
}
