import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { radius, spacing } from '../theme';

type Option = { value: string; label: string };

export function ChoiceGroup({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Option[];
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            disabled={disabled}
            onPress={() => onChange(opt.value)}
            style={StyleSheet.flatten([
              styles.option,
              {
                borderColor: active ? colors.brand : colors.brandBorder,
                backgroundColor: active ? colors.brandSoft : colors.surface,
              },
              disabled && { opacity: 0.6 },
            ])}
          >
            <View
              style={StyleSheet.flatten([
                styles.radio,
                {
                  borderColor: active ? colors.brand : colors.textMuted,
                  backgroundColor: active ? colors.brand : 'transparent',
                },
              ])}
            />
            <Text
              style={StyleSheet.flatten([
                styles.label,
                { color: active ? colors.brandDark : colors.text },
                active && { fontWeight: '700' },
              ])}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  label: {
    flex: 1,
    fontSize: 15,
  },
});
