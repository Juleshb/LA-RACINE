import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { AppIcon } from '@/src/components/AppIcon';
import { Badge, Card, EmptyState, ErrorText, LoadingBlock, Muted, Screen } from '@/src/components/ui';
import { api } from '@/src/lib/api';
import { useTheme } from '@/src/context/ThemeContext';
import { labelOf } from '@/src/lib/format';
import { spacing } from '@/src/theme';

export default function LearnScreen() {
  const { colors, accent } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [courses, setCourses] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [list, grades] = await Promise.all([
        api.getELearningCourses(),
        api.getELearningGradesSummary().catch(() => null),
      ]);
      setCourses(Array.isArray(list) ? list : list?.items || []);
      setSummary(grades);
    } catch (err: any) {
      setError(err.message || 'Failed to load courses');
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
        data={courses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <ErrorText>{error}</ErrorText>
            {summary ? (
              <Card>
                <View style={styles.summaryHead}>
                  <AppIcon name="star" size={22} color={accent.yellow} />
                  <Text style={styles.summaryTitle}>Course progress</Text>
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
            icon="learn"
            iconColor={accent.lime}
            title="No courses yet"
            message="Your class courses will appear here when they’re ready!"
          />
        }
        renderItem={({ item }) => (
          <Link href={`/e-learning/${item.id}`} asChild>
            <Pressable>
              <Card style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.title}>{item.title}</Text>
                  {item.mySubmission ? <Badge label="Done" tone="success" icon="check" /> : null}
                </View>
                <Muted>{labelOf(item.subject || item.class?.name, 'Course')}</Muted>
                {item.description ? (
                  <Text style={styles.desc} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
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
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  desc: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
});
}

