import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { Badge, Card, EmptyState, ErrorText, LoadingBlock, Muted, Screen } from '@/src/components/ui';
import { AppIcon } from '@/src/components/AppIcon';
import { api } from '@/src/lib/api';
import { useTheme } from '@/src/context/ThemeContext';
import { formatDueDate, labelOf } from '@/src/lib/format';
import { spacing } from '@/src/theme';

export default function HomeworkListScreen() {
  const { colors, accent } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [items, setItems] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [list, grades] = await Promise.all([
        api.getHomework(),
        api.getHomeworkGradesSummary().catch(() => null),
      ]);
      setItems(Array.isArray(list) ? list : list?.items || []);
      setSummary(grades);
    } catch (err: any) {
      setError(err.message || 'Failed to load homework');
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
        ListHeaderComponent={
          <View style={styles.header}>
            <ErrorText>{error}</ErrorText>
            {summary ? (
              <Card>
                <View style={styles.summaryHead}>
                  <AppIcon name="trophy" size={22} color={accent.yellow} />
                  <Text style={styles.summaryTitle}>Your grades</Text>
                </View>
                <Muted>
                  {summary.completed ?? 0} completed
                  {summary.averagePercent != null
                    ? ` · avg ${Math.round(summary.averagePercent)}%`
                    : ''}
                </Muted>
              </Card>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="homework"
            iconColor={accent.magenta}
            title="No homework yet"
            message="When your teacher gives you a task, it will pop up here!"
          />
        }
        renderItem={({ item }) => (
          <Link href={`/homework/${item.id}`} asChild>
            <Pressable>
              <Card style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.title}>{item.title}</Text>
                  {item.mySubmission ? (
                    <Badge label="Done" tone="success" icon="check" />
                  ) : (
                    <Badge label="To do" tone="brand" />
                  )}
                </View>
                <Muted>{labelOf(item.course?.name || item.subject, 'Homework')}</Muted>
                {item.dueDate ? <Badge label={formatDueDate(item.dueDate)} tone="warning" /> : null}
              </Card>
            </Pressable>
          </Link>
        )}
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
  header: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  summaryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.brandDark,
  },
  card: {
    gap: 6,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
});
}

