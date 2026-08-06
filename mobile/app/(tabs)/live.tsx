import { useCallback, useMemo, useState } from 'react';
import { FlatList, Linking, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Badge, Button, Card, EmptyState, ErrorText, LoadingBlock, Muted, Screen } from '@/src/components/ui';
import { api } from '@/src/lib/api';
import { useTheme } from '@/src/context/ThemeContext';
import { useTranslation } from '@/src/context/LanguageContext';
import { formatSessionWhen, statusLabel, statusTone } from '@/src/lib/format';
import {
  canEmbedInApp,
  detectMeetingProvider,
  normalizeMeetingUrl,
  PROVIDER_LABELS,
} from '@/src/lib/meetingLinks';
import { spacing } from '@/src/theme';

export default function LiveClassesScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const list = await api.getOnlineClasses();
      setItems(Array.isArray(list) ? list : list?.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load live classes');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const joinClass = async (item: any) => {
    const url = normalizeMeetingUrl(item.meetingUrl || item.joinUrl || item.link);
    if (!url) {
      setError('No meeting link yet');
      return;
    }

    const provider = detectMeetingProvider(url, item.meetingProvider);

    // Zoom → stay in app (same as web portal). Meet / other → system browser / app.
    if (canEmbedInApp(provider, url)) {
      router.push({
        pathname: '/meeting',
        params: {
          url,
          title: item.title || 'Live class',
          provider,
        },
      });
      return;
    }

    const can = await Linking.canOpenURL(url);
    if (can) await Linking.openURL(url);
    else setError('Cannot open this meeting link');
  };

  if (loading) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<ErrorText>{error}</ErrorText>}
        ListEmptyComponent={
          <EmptyState
            icon="live"
            iconColor={colors.brand}
            title="No live classes yet"
            message="When your teacher starts a Meet or Zoom, you’ll see it here!"
          />
        }
        renderItem={({ item }) => {
          const when = item.startsAt || item.startAt || item.scheduledAt;
          const url = item.meetingUrl || item.joinUrl || item.link;
          const provider = detectMeetingProvider(url, item.meetingProvider);
          const inApp = canEmbedInApp(provider, url);
          return (
            <Card style={styles.card}>
              <View style={styles.badges}>
                <Badge label={statusLabel(item.status)} tone={statusTone(item.status)} />
                <Badge label={PROVIDER_LABELS[provider]} tone="teal" />
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Muted>{item.class?.name || item.course?.name || 'Live class'}</Muted>
              {when ? <Muted>{formatSessionWhen(when)}</Muted> : null}
              {item.teacher ? (
                <Muted>
                  {item.teacher.firstName} {item.teacher.lastName}
                </Muted>
              ) : null}
              {url ? (
                <Button
                  title={inApp ? t('mobile.joinInApp') : t('common.joinClass')}
                  icon="play"
                  onPress={() => joinClass(item)}
                />
              ) : (
                <Muted>No meeting link yet</Muted>
              )}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  card: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
});
}

