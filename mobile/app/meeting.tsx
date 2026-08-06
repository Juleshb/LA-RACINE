import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { AppIcon } from '@/src/components/AppIcon';
import { Button, Muted } from '@/src/components/ui';
import {
  getMeetingEmbedUrl,
  normalizeMeetingUrl,
  parseZoomMeeting,
} from '@/src/lib/meetingLinks';
import { colors, radius, spacing } from '@/src/theme';

/**
 * In-app Zoom room (Zoom web client), matching the web portal iframe join.
 * Google Meet is opened externally from the Live tab instead.
 */
export default function MeetingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    url?: string;
    title?: string;
    provider?: string;
  }>();

  const title = String(params.title || 'Live class');
  const meetingUrl = normalizeMeetingUrl(params.url);
  const provider = String(params.provider || 'ZOOM');
  const embedUrl = useMemo(
    () => getMeetingEmbedUrl(meetingUrl, provider === 'ZOOM' ? 'ZOOM' : provider),
    [meetingUrl, provider],
  );
  const zoom = useMemo(() => parseZoomMeeting(meetingUrl), [meetingUrl]);

  const [loading, setLoading] = useState(true);
  const [webError, setWebError] = useState('');

  const openExternal = useCallback(async () => {
    const target = zoom?.joinUrl || meetingUrl;
    if (!target) return;
    const can = await Linking.canOpenURL(target);
    if (can) await Linking.openURL(target);
  }, [meetingUrl, zoom?.joinUrl]);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/live');
  };

  if (!meetingUrl || !embedUrl) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.fallback}>
          <AppIcon name="live" size={40} color={colors.brand} />
          <Text style={styles.fallbackTitle}>Meeting link missing</Text>
          <Muted>Ask your teacher to publish a Zoom link for this class.</Muted>
          <Button title="Go back" onPress={leave} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.sm) }]}>
        <View style={styles.headerText}>
          <Text style={styles.school}>École La RACINE</Text>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Pressable style={styles.leaveBtn} onPress={leave} hitSlop={8}>
          <AppIcon name="close" size={18} color={colors.danger} />
          <Text style={styles.leaveText}>Leave</Text>
        </Pressable>
      </View>

      <View style={styles.toolbar}>
        <Text style={styles.toolbarHint}>
          Stay in the app for Zoom. If camera or mic fails, open the Zoom app.
        </Text>
        <Pressable style={styles.externalBtn} onPress={openExternal}>
          <AppIcon name="external" size={16} color={colors.brand} />
          <Text style={styles.externalText}>Open in Zoom app</Text>
        </Pressable>
      </View>

      <View style={styles.webWrap}>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.brand} size="large" />
            <Muted>Opening Zoom…</Muted>
          </View>
        ) : null}

        {webError ? (
          <View style={styles.fallback}>
            <Text style={styles.fallbackTitle}>Couldn’t load Zoom here</Text>
            <Muted>{webError}</Muted>
            <Button title="Open in Zoom app" icon="play" onPress={openExternal} />
            <Button title="Leave" variant="secondary" onPress={leave} />
          </View>
        ) : (
          <WebView
            source={{ uri: embedUrl }}
            style={styles.webview}
            onLoadStart={() => {
              setLoading(true);
              setWebError('');
            }}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setWebError('The Zoom page failed to load. Try the Zoom app instead.');
            }}
            onHttpError={() => {
              setLoading(false);
              setWebError('Zoom returned an error. Try the Zoom app instead.');
            }}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            allowsFullscreenVideo
            setSupportMultipleWindows={false}
            startInLoadingState
            mediaCapturePermissionGrantType="grant"
            // Prefer desktop Zoom web UI — embeds more reliably than the mobile site
            userAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.brandBorder,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  school: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.brand,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.roseSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  leaveText: {
    fontWeight: '800',
    color: colors.danger,
    fontSize: 13,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.brandSoft,
    borderBottomWidth: 1,
    borderBottomColor: colors.brandBorder,
  },
  toolbarHint: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  externalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  externalText: {
    color: colors.brand,
    fontWeight: '700',
    fontSize: 12,
  },
  webWrap: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loading: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(15,23,42,0.85)',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.bg,
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
  },
});
