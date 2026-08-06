import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { Card, EmptyState, ErrorText, LoadingBlock, Muted, Screen } from '@/src/components/ui';
import { api } from '@/src/lib/api';
import { useTheme } from '@/src/context/ThemeContext';
import { colors, spacing } from '@/src/theme';

export default function ELibraryListScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const list = await api.getELibraryItems();
      setItems(Array.isArray(list) ? list : list?.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load library');
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
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<ErrorText>{error}</ErrorText>}
        ListEmptyComponent={
          <EmptyState
            icon="library"
            iconColor={colors.violet}
            title="The library is waiting"
            message="Books and fun resources will show up here soon!"
          />
        }
        renderItem={({ item }) => (
          <Link href={`/e-library/${item.id}`} asChild>
            <Pressable>
              <Card style={styles.card}>
                <Text style={styles.title}>{item.title}</Text>
                <Muted>{item.author || item.category || 'E-Library'}</Muted>
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
  card: {
    gap: 6,
    marginBottom: spacing.sm,
  },
  title: {
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

