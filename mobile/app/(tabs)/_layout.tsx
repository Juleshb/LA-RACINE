import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppIcon, type AppIconName } from '@/src/components/AppIcon';
import { BrandMarkHeader } from '@/src/components/BrandLogo';
import { LoadingBlock, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { useTranslation } from '@/src/context/LanguageContext';
import { useTheme } from '@/src/context/ThemeContext';
import { radius } from '@/src/theme';

function headerFor(title: string) {
  return () => <BrandMarkHeader title={title} />;
}

function TabIcon({ name, focused }: { name: AppIconName; focused: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.tabIcon,
        focused && { backgroundColor: colors.brandSoft },
      ]}
    >
      <AppIcon name={name} size={22} color={focused ? colors.brand : colors.textMuted} />
    </View>
  );
}

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (loading) {
    return (
      <Screen>
        <LoadingBlock label={t('common.loading')} />
      </Screen>
    );
  }

  if (!user) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerShadowVisible: false,
        headerTintColor: colors.brandDark,
        headerTitleStyle: { fontWeight: '800', color: colors.ink },
        tabBarActiveTintColor: colors.brandDark,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontWeight: '800', fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.brandBorder,
          borderTopWidth: 2,
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.home'),
          headerTitle: headerFor(t('nav.home')),
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="homework"
        options={{
          title: t('nav.homework'),
          headerTitle: headerFor(t('nav.myHomework')),
          tabBarIcon: ({ focused }) => <TabIcon name="homework" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: t('nav.live'),
          headerTitle: headerFor(t('nav.liveClasses')),
          tabBarIcon: ({ focused }) => <TabIcon name="live" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: t('nav.elearning'),
          headerTitle: headerFor(t('nav.myLearning')),
          tabBarIcon: ({ focused }) => <TabIcon name="learn" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t('common.more'),
          headerTitle: headerFor(t('common.more')),
          tabBarIcon: ({ focused }) => <TabIcon name="more" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
