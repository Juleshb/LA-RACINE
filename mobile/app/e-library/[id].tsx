import { useCallback, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { WebView } from 'react-native-webview';
import { Button, Card, ErrorText, LoadingBlock, Muted, Screen, Subtitle } from '@/src/components/ui';
import { downloadELibraryFile } from '@/src/lib/eLibraryFile';
import { api } from '@/src/lib/api';
import { useTheme } from '@/src/context/ThemeContext';
import { colors, radius, spacing } from '@/src/theme';

const VIEWPORT_H = Math.round(Dimensions.get('window').height * 0.62);

export default function ELibraryDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [localFile, setLocalFile] = useState<{
    uri: string;
    mimeType: string;
    isPdf: boolean;
    isImage: boolean;
  } | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      setLocalFile(null);
      const data = await api.getELibraryItem(String(id));
      setItem(data);
      if (data?.hasFile) {
        setOpening(true);
        try {
          const file = await downloadELibraryFile(String(id), data);
          setLocalFile(file);
        } catch (err: any) {
          setError(err.message || 'Could not open file');
        } finally {
          setOpening(false);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load book');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const openFile = async () => {
    setOpening(true);
    setError('');
    try {
      const file = await downloadELibraryFile(String(id), item || {});
      setLocalFile(file);
    } catch (err: any) {
      setError(err.message || 'Could not open file');
    } finally {
      setOpening(false);
    }
  };

  const shareFile = async () => {
    setSharing(true);
    setError('');
    try {
      const file = localFile || (await downloadELibraryFile(String(id), item || {}));
      if (!localFile) setLocalFile(file);
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setError('Sharing is not available on this device');
        return;
      }
      await Sharing.shareAsync(file.uri, {
        mimeType: file.mimeType,
        dialogTitle: item?.title || 'Open book',
        UTI: file.isPdf ? 'com.adobe.pdf' : undefined,
      });
    } catch (err: any) {
      setError(err.message || 'Could not share file');
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }

  if (!item) {
    return (
      <Screen>
        <View style={styles.pad}>
          <ErrorText>{error || 'Book not found'}</ErrorText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad}>
        <Card style={styles.card}>
          <Subtitle>{item.title}</Subtitle>
          <Muted>{item.author || item.category || 'E-Library'}</Muted>
          {item.description ? <Text style={styles.body}>{item.description}</Text> : null}
        </Card>

        <ErrorText>{error}</ErrorText>

        {!item.hasFile ? (
          <Card style={styles.card}>
            <Muted>This book opens in the reading corner soon. Ask your teacher!</Muted>
          </Card>
        ) : (
          <Card style={styles.readerCard}>
            <Text style={styles.readerLabel}>Read the book</Text>

            {opening && !localFile ? (
              <View style={styles.readerLoading}>
                <LoadingBlock label="Opening book…" />
              </View>
            ) : null}

            {localFile?.isImage ? (
              <Image
                source={{ uri: localFile.uri }}
                style={styles.image}
                resizeMode="contain"
                accessibilityLabel={item.title}
              />
            ) : null}

            {localFile?.isPdf ? (
              Platform.OS === 'ios' ? (
                <View style={styles.pdfWrap}>
                  <WebView
                    source={{ uri: localFile.uri }}
                    style={styles.pdf}
                    originWhitelist={['*']}
                    allowFileAccess
                    startInLoadingState
                    scalesPageToFit
                    javaScriptEnabled
                    onError={() =>
                      setError('Could not preview this PDF here. Use “Open with…” below.')
                    }
                  />
                </View>
              ) : (
                <View style={styles.androidPdfHint}>
                  <Muted>
                    PDF preview works best in a reader app on Android. Tap Open / share to read it.
                  </Muted>
                </View>
              )
            ) : null}

            {localFile && !localFile.isPdf && !localFile.isImage ? (
              <Muted>This file type needs another app to open.</Muted>
            ) : null}

            <View style={styles.actions}>
              {!localFile ? (
                <Button title="Open file" icon="library" onPress={openFile} loading={opening} />
              ) : null}
              <Button
                title={Platform.OS === 'ios' ? 'Open with…' : 'Open / share'}
                icon="external"
                variant="secondary"
                onPress={shareFile}
                loading={sharing}
              />
            </View>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
  pad: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  card: {
    gap: spacing.sm,
  },
  body: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  readerCard: {
    gap: spacing.sm,
    overflow: 'hidden',
  },
  readerLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  readerLoading: {
    minHeight: 120,
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: VIEWPORT_H,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
  },
  pdfWrap: {
    height: VIEWPORT_H,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  pdf: {
    flex: 1,
    backgroundColor: '#fff',
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  androidPdfHint: {
    paddingVertical: spacing.md,
  },
});
}

