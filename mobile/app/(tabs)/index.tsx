import { useCallback, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, Redirect, useFocusEffect } from 'expo-router';
import { AppIcon, type AppIconName } from '@/src/components/AppIcon';
import { BrandLogo } from '@/src/components/BrandLogo';
import { Badge, Card, EmptyState, ErrorText, LoadingBlock, Muted, Screen, Subtitle } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { useTranslation } from '@/src/context/LanguageContext';
import { useTheme } from '@/src/context/ThemeContext';
import { api } from '@/src/lib/api';
import { formatDueDate, formatSessionWhen, labelOf, statusLabel, statusTone } from '@/src/lib/format';
import { brand, radius, school, spacing } from '@/src/theme';

const SHORTCUTS: {
  href: string;
  labelKey: string;
  icon: AppIconName;
  colorKey: 'magenta' | 'teal' | 'blue' | 'purple' | 'lime';
  softKey: 'magentaSoft' | 'tealSoft' | 'blueSoft' | 'purpleSoft' | 'limeSoft';
}[] = [
  { href: '/(tabs)/homework', labelKey: 'nav.homework', icon: 'homework', colorKey: 'magenta', softKey: 'magentaSoft' },
  { href: '/ai-tutor', labelKey: 'nav.ai', icon: 'ai', colorKey: 'teal', softKey: 'tealSoft' },
  { href: '/(tabs)/live', labelKey: 'nav.live', icon: 'live', colorKey: 'blue', softKey: 'blueSoft' },
  { href: '/e-library', labelKey: 'nav.elibrary', icon: 'library', colorKey: 'purple', softKey: 'purpleSoft' },
  { href: '/(tabs)/learn', labelKey: 'nav.elearning', icon: 'learn', colorKey: 'lime', softKey: 'limeSoft' },
];

function greetingKeyForHour() {
  const h = new Date().getHours();
  if (h < 12) return 'mobile.goodMorning';
  if (h < 17) return 'mobile.goodAfternoon';
  return 'mobile.goodEvening';
}

export default function HomeScreen() {
  const { user, loading: authLoading } = useAuth();
  const { colors, accent } = useTheme();
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [photo, setPhoto] = useState<{ uri: string; headers?: Record<string, string> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [dashboard, photoSource] = await Promise.all([
        api.getStudentDashboard(),
        api.getMyStudentPhotoSource().catch(() => null),
      ]);
      setData(dashboard);
      setPhoto(photoSource);
    } catch (err: any) {
      setError(err.message || 'Could not load your home');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!authLoading && !user) return <Redirect href="/login" />;

  if (loading && !data) {
    return (
      <Screen>
        <LoadingBlock label="Opening your adventure…" />
      </Screen>
    );
  }

  const student = data?.student;
  const firstName = student?.firstName || user?.firstName || 'friend';
  const upcomingHomework = data?.upcomingHomework || [];
  const onlineClasses = data?.onlineClasses || [];
  const liveOrSoon = onlineClasses.filter((s: any) => s.status === 'live' || s.status === 'starting_soon');
  const grades = data?.homeworkGrades;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.brand}
          />
        }
      >
        <View
          style={[
            styles.brandBar,
            { backgroundColor: colors.surface, borderColor: colors.brandBorder },
          ]}
        >
          <BrandLogo size="sm" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.brandName, { color: colors.brandDark }]}>{school.shortName}</Text>
            <Text style={[styles.motto, { color: colors.textMuted }]}>{t('mobile.readyToLearn')}</Text>
          </View>
          <AppIcon name="wave" size={28} color={colors.brand} />
        </View>

        <View style={styles.hero}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.wave}>
              {t(greetingKeyForHour())}, {firstName}!
            </Text>
            <Text style={styles.heroTitle}>{t('mobile.funLearningSpace')}</Text>
            {student?.class?.name ? (
              <View style={styles.classChip}>
                <AppIcon name="school" size={14} color="#fff" />
                <Text style={styles.classChipText}>{student.class.name}</Text>
              </View>
            ) : null}
          </View>
          {photo ? (
            <Image source={photo} style={styles.avatar} />
          ) : (
            <View style={StyleSheet.flatten([styles.avatar, styles.avatarFallback])}>
              <Text style={styles.avatarInitials}>
                {(student?.firstName?.[0] || user?.firstName?.[0] || 'S').toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <ErrorText>{error}</ErrorText>

        {!student ? (
          <EmptyState
            icon="link"
            title="Almost there!"
            message="Ask your teacher to link your student profile."
          />
        ) : null}

        <Text style={[styles.sectionLabel, { color: colors.brandDark }]}>{t('mobile.whatToDo')}</Text>
        <View style={styles.shortcuts}>
          {SHORTCUTS.map((item) => (
            <Link key={item.href} href={item.href as any} asChild>
              <Pressable
                style={StyleSheet.flatten([
                  styles.shortcut,
                  { backgroundColor: accent[item.softKey] },
                ])}
              >
                <View style={[styles.shortcutIcon, { backgroundColor: colors.surface }]}>
                  <AppIcon name={item.icon} size={28} color={accent[item.colorKey]} />
                </View>
                <Text style={StyleSheet.flatten([styles.shortcutLabel, { color: accent[item.colorKey] }])}>
                  {t(item.labelKey)}
                </Text>
              </Pressable>
            </Link>
          ))}
        </View>

        {grades ? (
          <Card
            style={StyleSheet.flatten([
              styles.statsCard,
              { borderColor: accent.yellow, backgroundColor: colors.yellowSoft },
            ])}
          >
            <View style={styles.statsHead}>
              <AppIcon name="trophy" size={24} color={accent.yellow} />
              <Subtitle>{t('mobile.myStars')}</Subtitle>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: colors.brandDark }]}>{grades.completed ?? 0}</Text>
                <Muted>{t('mobile.done')}</Muted>
              </View>
              <View style={[styles.statDivider, { backgroundColor: accent.yellow }]} />
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: colors.brandDark }]}>
                  {grades.averagePercent != null ? `${Math.round(grades.averagePercent)}%` : '—'}
                </Text>
                <Muted>{t('mobile.score')}</Muted>
              </View>
            </View>
          </Card>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionTitleRow}>
              <AppIcon name="homework" size={20} color={accent.magenta} />
              <Subtitle>{t('mobile.comingUp')}</Subtitle>
            </View>
            <Link href="/(tabs)/homework" asChild>
              <Pressable style={styles.linkRow}>
                <Text style={[styles.link, { color: colors.brand }]}>{t('common.seeAll')}</Text>
                <AppIcon name="chevron" size={16} color={colors.brand} />
              </Pressable>
            </Link>
          </View>
          {upcomingHomework.length === 0 ? (
            <EmptyState
              icon="party"
              iconColor={accent.yellow}
              title={t('mobile.allCaughtUp')}
              message={t('mobile.noHomeworkSoon')}
            />
          ) : (
            upcomingHomework.slice(0, 4).map((hw: any) => (
              <Link key={hw.id} href={`/homework/${hw.id}`} asChild>
                <Pressable>
                  <Card style={styles.listCard}>
                    <Text style={[styles.itemTitle, { color: colors.text }]}>{hw.title}</Text>
                    <Muted>{labelOf(hw.course?.name || hw.subject, 'Homework')}</Muted>
                    {hw.dueDate ? <Badge label={formatDueDate(hw.dueDate)} tone="warning" icon="clock" /> : null}
                  </Card>
                </Pressable>
              </Link>
            ))
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionTitleRow}>
              <AppIcon name="live" size={20} color={accent.blue} />
              <Subtitle>{t('nav.liveClasses')}</Subtitle>
            </View>
            <Link href="/(tabs)/live" asChild>
              <Pressable style={styles.linkRow}>
                <Text style={[styles.link, { color: colors.brand }]}>{t('common.seeAll')}</Text>
                <AppIcon name="chevron" size={16} color={colors.brand} />
              </Pressable>
            </Link>
          </View>
          {liveOrSoon.length === 0 && onlineClasses.length === 0 ? (
            <EmptyState
              icon="sleep"
              iconColor={accent.purple}
              title={t('mobile.noLiveNow')}
              message={t('mobile.comeBackLive')}
            />
          ) : (
            (liveOrSoon.length ? liveOrSoon : onlineClasses).slice(0, 3).map((session: any) => (
              <Card key={session.id} style={styles.listCard}>
                <Badge label={statusLabel(session.status)} tone={statusTone(session.status)} />
                <Text style={[styles.itemTitle, { color: colors.text }]}>{session.title}</Text>
                <Muted>{formatSessionWhen(session.startsAt || session.startAt || session.scheduledAt)}</Muted>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.xl,
    padding: spacing.sm + 2,
    paddingRight: spacing.md,
    borderWidth: 2,
  },
  brandName: {
    fontSize: 16,
    fontWeight: '800',
  },
  motto: {
    fontSize: 12,
    fontWeight: '700',
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: brand[700],
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 3,
    borderColor: brand[400],
  },
  wave: {
    fontSize: 15,
    fontWeight: '700',
    color: brand[200],
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 30,
  },
  classChip: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  classChipText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: brand[500],
    borderWidth: 4,
    borderColor: '#fff',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  shortcuts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  shortcut: {
    width: '31%',
    flexGrow: 1,
    minWidth: 100,
    minHeight: 108,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  shortcutIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutLabel: {
    fontWeight: '800',
    fontSize: 13,
    textAlign: 'center',
  },
  statsCard: {},
  statsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 2,
    height: 44,
    opacity: 0.35,
    marginHorizontal: spacing.sm,
    borderRadius: 2,
  },
  statValue: {
    fontSize: 30,
    fontWeight: '800',
  },
  section: {
    gap: spacing.sm,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  link: {
    fontWeight: '800',
    fontSize: 14,
  },
  listCard: {
    gap: 8,
  },
  itemTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
});
