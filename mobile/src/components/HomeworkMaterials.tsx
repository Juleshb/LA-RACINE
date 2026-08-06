import { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { WebView } from 'react-native-webview';
import { AppIcon } from '@/src/components/AppIcon';
import { Button, Card, ErrorText, LoadingBlock, Muted } from '@/src/components/ui';
import { api } from '@/src/lib/api';
import { useTheme } from '@/src/context/ThemeContext';
import { downloadAuthedFile, type DownloadedFile } from '@/src/lib/downloadFile';
import {
  getYouTubeEmbedUrl,
  parseYouTubeId,
  youtubeThumbUrl,
  youtubeWatchUrl,
} from '@/src/lib/youtube';
import { radius, spacing } from '@/src/theme';

const VIDEO_H = Math.round(Dimensions.get('window').width * 0.56);
const FILE_H = Math.round(Dimensions.get('window').height * 0.45);

type Attachment = {
  id: string;
  fileName?: string;
  mimeType?: string;
};

type Video = {
  id: string;
  title?: string;
  youtubeId?: string;
  videoUrl?: string;
};

function MaterialHead({
  icon,
  label,
}: {
  icon: 'film' | 'image' | 'pdf' | 'clipboard' | 'library';
  label: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.head}>
      <View style={styles.badge}>
        <AppIcon name={icon} size={22} color={colors.brand} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

function HomeworkVideo({ video }: { video: Video }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const youtubeId = video.youtubeId || parseYouTubeId(video.videoUrl);
  const [playing, setPlaying] = useState(false);
  const title =
    video.title && video.title !== 'Watch this' ? video.title : 'Watch this video';

  if (!youtubeId) {
    return (
      <Card style={styles.card}>
        <MaterialHead icon="film" label={title} />
        <Muted>This video link is missing or not a YouTube link.</Muted>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <MaterialHead icon="film" label={title} />
      <View style={styles.videoWrap}>
        {playing ? (
          <WebView
            source={{ uri: getYouTubeEmbedUrl(youtubeId, { autoplay: true }) }}
            style={styles.video}
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
          />
        ) : (
          <Pressable style={styles.poster} onPress={() => setPlaying(true)}>
            <Image
              source={{ uri: youtubeThumbUrl(youtubeId) }}
              style={styles.posterImg}
              resizeMode="cover"
            />
            <View style={styles.playBtn}>
              <AppIcon name="play" size={36} color="#fff" />
            </View>
            <Text style={styles.playLabel}>Tap to watch</Text>
          </Pressable>
        )}
      </View>
      <Pressable
        style={styles.externalRow}
        onPress={() => Linking.openURL(youtubeWatchUrl(youtubeId))}
      >
        <AppIcon name="external" size={14} color={colors.brand} />
        <Text style={styles.externalText}>Open in YouTube</Text>
      </Pressable>
    </Card>
  );
}

function HomeworkAttachment({
  homeworkId,
  attachment,
}: {
  homeworkId: string;
  attachment: Attachment;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isImage = Boolean(attachment.mimeType?.startsWith('image/'));
  const isPdf = attachment.mimeType === 'application/pdf';
  const [file, setFile] = useState<DownloadedFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const source = await api.getHomeworkAttachmentSource(homeworkId, attachment.id);
        const downloaded = await downloadAuthedFile({
          cacheKey: `hw-${homeworkId}-${attachment.id}`,
          source,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
        });
        if (!cancelled) setFile(downloaded);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Could not load file');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [homeworkId, attachment.id, attachment.fileName, attachment.mimeType]);

  const share = async () => {
    if (!file) return;
    setSharing(true);
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: file.mimeType,
          dialogTitle: attachment.fileName || 'Homework file',
          UTI: file.isPdf ? 'com.adobe.pdf' : undefined,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Could not open file');
    } finally {
      setSharing(false);
    }
  };

  const title = isPdf
    ? 'Read this page'
    : isImage
      ? 'Look at this picture'
      : attachment.fileName || 'Homework file';

  return (
    <Card style={styles.card}>
      <MaterialHead icon={isPdf ? 'pdf' : isImage ? 'image' : 'library'} label={title} />
      {attachment.fileName ? <Muted>{attachment.fileName}</Muted> : null}
      <ErrorText>{error}</ErrorText>

      {loading ? <LoadingBlock label="Opening file…" /> : null}

      {file?.isImage ? (
        <Image source={{ uri: file.uri }} style={styles.image} resizeMode="contain" />
      ) : null}

      {file?.isPdf && Platform.OS === 'ios' ? (
        <View style={styles.pdfWrap}>
          <WebView
            source={{ uri: file.uri }}
            style={styles.pdf}
            originWhitelist={['*']}
            allowFileAccess
            startInLoadingState
            scalesPageToFit
          />
        </View>
      ) : null}

      {file?.isPdf && Platform.OS !== 'ios' ? (
        <Muted>Tap Open / share to read this PDF.</Muted>
      ) : null}

      {file && !file.isPdf && !file.isImage ? (
        <Muted>This file needs another app to open.</Muted>
      ) : null}

      {file ? (
        <Button
          title={Platform.OS === 'ios' ? 'Open with…' : 'Open / share'}
          icon="external"
          variant="secondary"
          onPress={share}
          loading={sharing}
        />
      ) : null}
    </Card>
  );
}

/** Videos + reading files for a homework assignment (web StudentHomeworkMaterials parity). */
export function HomeworkMaterials({ homework }: { homework: any }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const description = homework?.description || homework?.instructions;
  const videos: Video[] = homework?.videos || [];
  const attachments: Attachment[] = homework?.attachments || [];
  const images = attachments.filter((a) => a.mimeType?.startsWith('image/'));
  const pdfs = attachments.filter((a) => a.mimeType === 'application/pdf');
  const other = attachments.filter(
    (a) => !a.mimeType?.startsWith('image/') && a.mimeType !== 'application/pdf',
  );

  if (!description && videos.length === 0 && attachments.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      {description ? (
        <Card style={styles.card}>
          <MaterialHead icon="clipboard" label="What to do" />
          <Text style={styles.body}>{description}</Text>
        </Card>
      ) : null}

      {videos.map((video) => (
        <HomeworkVideo key={video.id} video={video} />
      ))}

      {images.map((att) => (
        <HomeworkAttachment key={att.id} homeworkId={homework.id} attachment={att} />
      ))}

      {pdfs.map((att) => (
        <HomeworkAttachment key={att.id} homeworkId={homework.id} attachment={att} />
      ))}

      {other.map((att) => (
        <HomeworkAttachment key={att.id} homeworkId={homework.id} attachment={att} />
      ))}
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  card: {
    gap: spacing.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  videoWrap: {
    height: VIDEO_H,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
  video: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  poster: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterImg: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(2,132,199,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playLabel: {
    marginTop: 8,
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  externalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  externalText: {
    color: colors.brand,
    fontWeight: '700',
    fontSize: 13,
  },
  image: {
    width: '100%',
    height: FILE_H,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
  },
  pdfWrap: {
    height: FILE_H,
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
});
}

