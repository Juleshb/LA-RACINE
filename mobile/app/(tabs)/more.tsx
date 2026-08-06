import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { AppIcon, type AppIconName } from '@/src/components/AppIcon';
import { BrandLogo } from '@/src/components/BrandLogo';
import { Button, Card, Screen, Subtitle } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { useTranslation } from '@/src/context/LanguageContext';
import { useTheme } from '@/src/context/ThemeContext';
import { type LanguageCode } from '@/src/i18n';
import { spacing, type ThemePreference } from '@/src/theme';

export default function MoreScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { colors, accent, preference, setPreference, isDark } = useTheme();
  const { t, language, setLanguage, languages } = useTranslation();

  const links: {
    href: string;
    label: string;
    hint: string;
    icon: AppIconName;
    softKey: 'purpleSoft' | 'tealSoft' | 'yellowSoft';
    colorKey: 'purple' | 'teal' | 'yellow';
  }[] = [
    {
      href: '/e-library',
      label: t('nav.elibrary'),
      hint: t('more.elibraryHint'),
      icon: 'library',
      softKey: 'purpleSoft',
      colorKey: 'purple',
    },
    {
      href: '/ai-tutor',
      label: t('nav.aiTutor'),
      hint: t('more.aiHint'),
      icon: 'ai',
      softKey: 'tealSoft',
      colorKey: 'teal',
    },
    {
      href: '/profile',
      label: t('profile.myProfile'),
      hint: t('more.profileHint'),
      icon: 'smile',
      softKey: 'yellowSoft',
      colorKey: 'yellow',
    },
  ];

  const themeOptions: { value: ThemePreference; label: string; icon: AppIconName }[] = [
    { value: 'light', label: t('appearance.day'), icon: 'star' },
    { value: 'dark', label: t('appearance.night'), icon: 'sleep' },
    { value: 'system', label: t('appearance.auto'), icon: 'magic' },
  ];

  return (
    <Screen>
      <View style={styles.content}>
        <Card style={styles.profileCard}>
          <BrandLogo size="md" />
          <View style={{ flex: 1, gap: 4 }}>
            <Subtitle>
              {user?.firstName} {user?.lastName}
            </Subtitle>
            <Text style={[styles.email, { color: colors.textMuted }]}>{user?.email}</Text>
            <View style={styles.schoolTag}>
              <AppIcon name="star" size={14} color={colors.brand} />
              <Text style={[styles.schoolTagText, { color: colors.brand }]}>
                {t('more.studentBadge')}
              </Text>
            </View>
          </View>
        </Card>

        <Card style={styles.themeCard}>
          <View style={styles.themeHead}>
            <AppIcon name="sparkles" size={22} color={colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.themeTitle, { color: colors.ink }]}>{t('language')}</Text>
              <Text style={[styles.themeHint, { color: colors.textMuted }]}>
                {t('profile.languageHint')}
              </Text>
            </View>
          </View>
          <View style={styles.langGrid}>
            {languages.map((lang) => {
              const selected = language === lang.code;
              return (
                <Pressable
                  key={lang.code}
                  onPress={() => setLanguage(lang.code as LanguageCode)}
                  style={[
                    styles.langChip,
                    {
                      backgroundColor: selected ? colors.brand : colors.brandSoft,
                      borderColor: selected ? colors.brand : colors.brandBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.langChipText,
                      { color: selected ? '#fff' : colors.brandDark },
                    ]}
                    numberOfLines={1}
                  >
                    {lang.nativeLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card style={styles.themeCard}>
          <View style={styles.themeHead}>
            <AppIcon name={isDark ? 'sleep' : 'star'} size={22} color={colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.themeTitle, { color: colors.ink }]}>{t('appearance.title')}</Text>
              <Text style={[styles.themeHint, { color: colors.textMuted }]}>
                {t('appearance.hint')}
              </Text>
            </View>
          </View>
          <View style={styles.themeRow}>
            {themeOptions.map((opt) => {
              const selected = preference === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setPreference(opt.value)}
                  style={[
                    styles.themeChip,
                    {
                      backgroundColor: selected ? colors.brand : colors.brandSoft,
                      borderColor: selected ? colors.brand : colors.brandBorder,
                    },
                  ]}
                >
                  <AppIcon
                    name={opt.icon}
                    size={16}
                    color={selected ? '#fff' : colors.brandDark}
                  />
                  <Text
                    style={[
                      styles.themeChipText,
                      { color: selected ? '#fff' : colors.brandDark },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {links.map((item) => (
          <Link key={item.href} href={item.href as any} asChild>
            <Pressable>
              <Card
                style={StyleSheet.flatten([
                  styles.linkCard,
                  { backgroundColor: accent[item.softKey] },
                ])}
              >
                <View
                  style={StyleSheet.flatten([
                    styles.iconWrap,
                    { backgroundColor: colors.surface },
                  ])}
                >
                  <AppIcon name={item.icon} size={26} color={accent[item.colorKey]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.linkTitle, { color: colors.text }]}>{item.label}</Text>
                  <Text style={[styles.linkHint, { color: colors.textMuted }]}>{item.hint}</Text>
                </View>
                <AppIcon name="chevron" size={20} color={colors.brand} />
              </Card>
            </Pressable>
          </Link>
        ))}

        <Button
          title={t('common.signOut')}
          icon="logout"
          variant="danger"
          onPress={async () => {
            await logout();
            router.replace('/login');
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.sm + 4,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  email: {
    fontSize: 14,
    fontWeight: '600',
  },
  schoolTag: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  schoolTagText: {
    fontSize: 12,
    fontWeight: '800',
  },
  themeCard: {
    gap: spacing.md,
  },
  themeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  themeTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  themeHint: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  themeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  themeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 2,
  },
  themeChipText: {
    fontSize: 14,
    fontWeight: '800',
  },
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  langChip: {
    width: '48%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 2,
  },
  langChipText: {
    fontSize: 13,
    fontWeight: '800',
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 76,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  linkHint: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
});
