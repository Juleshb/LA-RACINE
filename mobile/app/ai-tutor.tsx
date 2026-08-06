import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AiMarkdown } from '@/src/components/AiMarkdown';
import { AppIcon } from '@/src/components/AppIcon';
import { Button, ErrorText, LoadingBlock, Muted, Screen } from '@/src/components/ui';
import { api } from '@/src/lib/api';
import {
  getAutoSpeakPref,
  getSpeechRatePref,
  setAutoSpeakPref,
  setSpeechRatePref,
  speakText,
  SPEECH_RATES,
  stopSpeaking,
} from '@/src/lib/speech';
import { colors, radius, spacing } from '@/src/theme';

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

type ChatSummary = {
  id: string;
  title?: string;
  preview?: string;
  messageCount?: number;
  updatedAt?: string;
};

function formatWhen(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function AiTutorScreen() {
  const [status, setStatus] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [chatId, setChatId] = useState<string | null>(null);
  const [chatTitle, setChatTitle] = useState('New chat');
  const [history, setHistory] = useState<ChatSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [speechRate, setSpeechRate] = useState(1);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const listRef = useRef<FlatList>(null);
  const autoSpeakRef = useRef(autoSpeak);
  const rateRef = useRef(speechRate);

  useEffect(() => {
    autoSpeakRef.current = autoSpeak;
  }, [autoSpeak]);

  useEffect(() => {
    rateRef.current = speechRate;
  }, [speechRate]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const list = await api.getStudentAiChats();
      setHistory(Array.isArray(list) ? list : []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [s, auto, rate] = await Promise.all([
          api.getStudentAiStatus(),
          getAutoSpeakPref(),
          getSpeechRatePref(),
          loadHistory(),
        ]);
        setStatus(s);
        setAutoSpeak(auto);
        setSpeechRate(rate);
      } catch (err: any) {
        setError(err.message || 'AI tutor unavailable');
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      stopSpeaking();
    };
  }, [loadHistory]);

  const speakMessage = useCallback(async (index: number, content: string) => {
    if (!content?.trim()) return;
    setSpeakingIndex(index);
    await speakText(content, {
      rate: rateRef.current,
      onDone: () => setSpeakingIndex(null),
      onStopped: () => setSpeakingIndex(null),
    });
  }, []);

  const toggleAutoSpeak = async () => {
    const next = !autoSpeak;
    setAutoSpeak(next);
    await setAutoSpeakPref(next);
    if (!next) {
      await stopSpeaking();
      setSpeakingIndex(null);
    }
  };

  const cycleRate = async () => {
    const idx = SPEECH_RATES.indexOf(speechRate as (typeof SPEECH_RATES)[number]);
    const next = SPEECH_RATES[(idx + 1) % SPEECH_RATES.length];
    setSpeechRate(next);
    await setSpeechRatePref(next);
  };

  const stopVoice = async () => {
    await stopSpeaking();
    setSpeakingIndex(null);
  };

  const persistChat = useCallback(
    async (nextMessages: ChatMessage[]) => {
      try {
        const title =
          nextMessages.find((m) => m.role === 'user')?.content?.slice(0, 60) || 'Chat';
        const saved = await api.saveStudentAiChat({
          id: chatId || undefined,
          title,
          messages: nextMessages,
        });
        if (saved?.id) {
          setChatId(saved.id);
          setChatTitle(saved.title || title);
        }
        await loadHistory();
      } catch {
        // Persistence is best-effort
      }
    },
    [chatId, loadHistory],
  );

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setError('');
    setInput('');
    await stopVoice();
    const historyMsgs: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages([...historyMsgs, { role: 'assistant', content: '' }]);
    if (!chatTitle || chatTitle === 'New chat') {
      setChatTitle(text.length > 40 ? `${text.slice(0, 37)}…` : text);
    }
    setSending(true);

    try {
      let full = '';
      await api.streamStudentAiChat(
        { messages: historyMsgs },
        {
          onChunk: (chunk) => {
            full += chunk;
            setMessages([...historyMsgs, { role: 'assistant', content: full }]);
          },
        },
      );
      const finalMessages: ChatMessage[] = [...historyMsgs, { role: 'assistant', content: full }];
      setMessages(finalMessages);
      await persistChat(finalMessages);
      if (autoSpeakRef.current && full.trim()) {
        await speakMessage(finalMessages.length - 1, full);
      }
    } catch (err: any) {
      setError(err.message || 'AI tutor failed');
      setMessages(historyMsgs);
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  const startNew = async () => {
    await stopVoice();
    setMessages([]);
    setChatId(null);
    setChatTitle('New chat');
    setError('');
    setHistoryOpen(false);
  };

  const openChat = async (id: string) => {
    setOpeningId(id);
    setError('');
    await stopVoice();
    try {
      const chat = await api.getStudentAiChat(id);
      const msgs = (chat.messages || [])
        .filter((m: any) => m.role === 'user' || m.role === 'assistant')
        .map((m: any) => ({
          role: m.role as 'user' | 'assistant',
          content: String(m.content || ''),
        }));
      setChatId(chat.id);
      setChatTitle(chat.title || 'Chat');
      setMessages(msgs);
      setHistoryOpen(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    } catch (err: any) {
      setError(err.message || 'Could not open chat');
    } finally {
      setOpeningId(null);
    }
  };

  const confirmDelete = (item: ChatSummary) => {
    Alert.alert('Delete this chat?', item.title || 'This conversation will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteStudentAiChat(item.id);
            if (chatId === item.id) await startNew();
            await loadHistory();
          } catch (err: any) {
            setError(err.message || 'Could not delete chat');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <Screen>
        <LoadingBlock label="Opening Ask AI…" />
      </Screen>
    );
  }

  const configured = status?.configured !== false && status?.available !== false;

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <View style={styles.toolbar}>
          <Pressable
            style={styles.historyBtn}
            onPress={() => {
              setHistoryOpen(true);
              loadHistory();
            }}
          >
            <AppIcon name="library" size={18} color={colors.brand} />
            <Text style={styles.historyBtnText}>History</Text>
            {history.length > 0 ? (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{history.length}</Text>
              </View>
            ) : null}
          </Pressable>

          <Text style={styles.toolbarTitle} numberOfLines={1}>
            {chatTitle}
          </Text>

          <Pressable style={styles.newBtn} onPress={startNew}>
            <AppIcon name="sparkles" size={18} color={colors.brand} />
            <Text style={styles.newChat}>New</Text>
          </Pressable>
        </View>

        <View style={styles.voiceBar}>
          <Pressable
            style={[styles.voiceChip, autoSpeak && styles.voiceChipOn]}
            onPress={toggleAutoSpeak}
          >
            <AppIcon
              name={autoSpeak ? 'volume' : 'volumeOff'}
              size={18}
              color={autoSpeak ? colors.brandDark : colors.textMuted}
            />
            <Text style={[styles.voiceChipText, autoSpeak && styles.voiceChipTextOn]}>
              {autoSpeak ? 'Voice on' : 'Voice off'}
            </Text>
          </Pressable>

          <Pressable style={styles.voiceChip} onPress={cycleRate}>
            <AppIcon name="clock" size={16} color={colors.brandDark} />
            <Text style={styles.voiceChipText}>{speechRate}x</Text>
          </Pressable>

          {speakingIndex != null ? (
            <Pressable style={[styles.voiceChip, styles.stopChip]} onPress={stopVoice}>
              <AppIcon name="stop" size={18} color={colors.danger} />
              <Text style={[styles.voiceChipText, { color: colors.danger }]}>Stop</Text>
            </Pressable>
          ) : null}
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <AppIcon name="ai" size={40} color={colors.teal} />
              </View>
              <Text style={styles.emptyTitle}>Hi! I’m your AI study buddy</Text>
              <Muted>
                Ask me anything — I can also read my answers out loud for you.
              </Muted>
              {history.length > 0 ? (
                <Pressable style={styles.openHistoryLink} onPress={() => setHistoryOpen(true)}>
                  <AppIcon name="library" size={16} color={colors.brand} />
                  <Text style={styles.openHistoryText}>Open past chats</Text>
                </Pressable>
              ) : null}
            </View>
          }
          renderItem={({ item, index }) => {
            const isUser = item.role === 'user';
            const isSpeaking = speakingIndex === index;
            return (
              <View style={[styles.bubbleWrap, isUser ? styles.bubbleWrapUser : styles.bubbleWrapAi]}>
                {!isUser && item.content ? (
                  <Pressable
                    style={[styles.speakBtn, isSpeaking && styles.speakBtnActive]}
                    onPress={() => {
                      if (isSpeaking) stopVoice();
                      else speakMessage(index, item.content);
                    }}
                    hitSlop={8}
                  >
                    <AppIcon
                      name={isSpeaking ? 'stop' : 'volume'}
                      size={16}
                      color={isSpeaking ? colors.danger : colors.brand}
                    />
                  </Pressable>
                ) : null}
                <View
                  style={[
                    styles.bubble,
                    isUser ? styles.userBubble : styles.aiBubble,
                    isSpeaking && styles.speakingBubble,
                  ]}
                >
                  {isUser ? (
                    <Text style={[styles.bubbleText, styles.userText]} selectable>
                      {item.content}
                    </Text>
                  ) : (
                    <AiMarkdown
                      content={item.content}
                      streaming={sending && index === messages.length - 1}
                    />
                  )}
                </View>
              </View>
            );
          }}
        />

        <View style={styles.composer}>
          <ErrorText>{error}</ErrorText>
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask me anything…"
              placeholderTextColor={colors.textMuted}
              editable={configured && !sending}
              multiline
            />
            <Button
              title="Send"
              icon="send"
              onPress={send}
              loading={sending}
              disabled={!configured || !input.trim()}
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={historyOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setHistoryOpen(false)}
      >
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <AppIcon name="library" size={22} color={colors.brand} />
              <Text style={styles.modalTitle}>Chat history</Text>
            </View>
            <Pressable onPress={() => setHistoryOpen(false)} hitSlop={12}>
              <Text style={styles.doneLink}>Done</Text>
            </Pressable>
          </View>

          <Pressable style={styles.newChatCard} onPress={startNew}>
            <AppIcon name="sparkles" size={22} color={colors.brand} />
            <Text style={styles.newChatCardText}>Start a new chat</Text>
            <AppIcon name="chevron" size={18} color={colors.brand} />
          </Pressable>

          {historyLoading ? (
            <View style={styles.historyLoading}>
              <ActivityIndicator color={colors.brand} />
              <Muted>Loading your chats…</Muted>
            </View>
          ) : (
            <FlatList
              data={history}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.historyList}
              ListEmptyComponent={
                <View style={styles.historyEmpty}>
                  <AppIcon name="ai" size={36} color={colors.textMuted} />
                  <Text style={styles.historyEmptyTitle}>No chats yet</Text>
                  <Muted>Your saved conversations will show up here.</Muted>
                </View>
              }
              renderItem={({ item }) => {
                const active = item.id === chatId;
                const opening = openingId === item.id;
                return (
                  <Pressable
                    style={[styles.historyItem, active && styles.historyItemActive]}
                    onPress={() => openChat(item.id)}
                    disabled={Boolean(openingId)}
                  >
                    <View style={styles.historyIcon}>
                      {opening ? (
                        <ActivityIndicator size="small" color={colors.brand} />
                      ) : (
                        <AppIcon name="ai" size={22} color={active ? colors.brand : colors.teal} />
                      )}
                    </View>
                    <View style={styles.historyBody}>
                      <Text style={styles.historyTitle} numberOfLines={1}>
                        {item.title || 'Chat'}
                      </Text>
                      <Text style={styles.historyPreview} numberOfLines={2}>
                        {item.preview || 'No messages yet'}
                      </Text>
                      <Text style={styles.historyMeta}>
                        {item.messageCount || 0} messages
                        {item.updatedAt ? ` · ${formatWhen(item.updatedAt)}` : ''}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => confirmDelete(item)}
                      hitSlop={10}
                      style={styles.deleteBtn}
                    >
                      <AppIcon name="trash" size={18} color={colors.danger} />
                    </Pressable>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.brandBorder,
    backgroundColor: colors.surface,
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brandSoft,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  historyBtnText: {
    color: colors.brandDark,
    fontWeight: '800',
    fontSize: 13,
  },
  countBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  toolbarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: colors.brandDark,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  newChat: {
    color: colors.brand,
    fontWeight: '800',
    fontSize: 13,
  },
  voiceBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.brandBorder,
  },
  voiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.brandBorder,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  voiceChipOn: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
  },
  stopChip: {
    borderColor: '#fecdd3',
    backgroundColor: colors.roseSoft,
  },
  voiceChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textMuted,
  },
  voiceChipTextOn: {
    color: colors.brandDark,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
    flexGrow: 1,
  },
  empty: {
    marginTop: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.brandDark,
    textAlign: 'center',
  },
  openHistoryLink: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brandSoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  openHistoryText: {
    color: colors.brandDark,
    fontWeight: '800',
  },
  bubbleWrap: {
    marginBottom: spacing.sm,
    maxWidth: '92%',
    gap: 6,
  },
  bubbleWrapUser: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubbleWrapAi: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  speakBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.brandBorder,
  },
  speakBtnActive: {
    backgroundColor: colors.roseSoft,
    borderColor: '#fecdd3',
  },
  bubble: {
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  userBubble: {
    backgroundColor: colors.brand,
  },
  aiBubble: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.brandBorder,
  },
  speakingBubble: {
    borderColor: colors.teal,
    backgroundColor: colors.tealSoft,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  userText: {
    color: '#fff',
  },
  composer: {
    padding: spacing.md,
    borderTopWidth: 2,
    borderTopColor: colors.brandBorder,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 2,
    borderColor: colors.brandBorder,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: Platform.OS === 'ios' ? 12 : spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.brandDark,
  },
  doneLink: {
    color: colors.brand,
    fontWeight: '800',
    fontSize: 16,
  },
  newChatCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.brandSoft,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.brandBorder,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  newChatCardText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: colors.brandDark,
  },
  historyLoading: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  historyList: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  historyEmpty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  historyEmptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.brandDark,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.brandBorder,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  historyItemActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  historyIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyBody: {
    flex: 1,
    gap: 2,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.brandDark,
  },
  historyPreview: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  historyMeta: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: colors.brand,
  },
  deleteBtn: {
    padding: 6,
  },
});
