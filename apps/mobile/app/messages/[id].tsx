/**
 * Buyer ↔ agent chat screen (Task #55).
 *
 * Loads the message history (cursor-paginated, oldest-first in the UI),
 * subscribes to realtime new-message events for this conversation, and
 * sends new messages via the buyer REST endpoint. Marks the conversation
 * read on mount + whenever a new incoming message arrives while the
 * screen is focused.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { conversationsApi, type ChatMessage } from '../../src/api/conversations';
import { subscribeToConversation } from '../../src/realtime/socket';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';
import { useAuth } from '../../src/auth/AuthContext';

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function ChatScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const conversationId = String(id || '');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');

  const messagesQuery = useQuery({
    queryKey: ['conversations', conversationId, 'messages'],
    queryFn: () => conversationsApi.messages(conversationId, { limit: 50 }),
    enabled: !!conversationId && !!user,
  });

  // Server returns DESC; we render oldest-first so the input bar at the
  // bottom shows the most recent message. Reverse once, deduplicate by id
  // so realtime appends + manual sends don't double-render.
  useEffect(() => {
    if (!messagesQuery.data) return;
    setMessages((prev) => {
      const map = new Map<string, ChatMessage>();
      for (const m of [...messagesQuery.data!.messages].reverse()) map.set(m.id, m);
      // Preserve any locally-appended messages that haven't been refetched
      // yet (e.g. messages that arrived realtime mid-fetch).
      for (const m of prev) if (!map.has(m.id)) map.set(m.id, m);
      const out = Array.from(map.values());
      out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return out;
    });
  }, [messagesQuery.data]);

  // Realtime subscription.
  useEffect(() => {
    if (!conversationId) return;
    const unsub = subscribeToConversation(conversationId, {
      onMessage: (e) => {
        setMessages((prev) => (prev.some((m) => m.id === e.message.id) ? prev : [...prev, e.message]));
        // If the incoming message is from the agent, mark the thread read
        // so the unread badge clears on the conversation list.
        if (e.message.senderKind === 'AGENT') {
          conversationsApi.markRead(conversationId).catch(() => {});
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      },
    });
    return unsub;
  }, [conversationId, queryClient]);

  // Mark read on first open so the inbox badge clears.
  useEffect(() => {
    if (!conversationId || !user) return;
    conversationsApi
      .markRead(conversationId)
      .then(() => queryClient.invalidateQueries({ queryKey: ['conversations'] }))
      .catch(() => {});
  }, [conversationId, user, queryClient]);

  const sendMutation = useMutation({
    mutationFn: (body: string) => conversationsApi.send(conversationId, body),
    onSuccess: (data) => {
      setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const onSend = useCallback(() => {
    const body = draft.trim();
    if (!body || sendMutation.isPending) return;
    setDraft('');
    sendMutation.mutate(body);
  }, [draft, sendMutation]);

  // Auto-scroll to bottom whenever messages change.
  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages.length]);

  const headerTitle = useMemo(() => (title ? String(title) : 'Tin nhắn'), [title]);

  if (!user) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <Text style={styles.emptyTitle}>Vui lòng đăng nhập</Text>
        <Text style={styles.emptySubtitle}>Bạn cần đăng nhập để xem hội thoại.</Text>
        <Pressable style={styles.backCta} onPress={() => router.back()}>
          <Text style={styles.backCtaText}>Quay lại</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {headerTitle}
          </Text>
          <Text style={styles.headerSubtitle}>Chuyên viên tư vấn</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        {messagesQuery.isLoading && messages.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const mine = item.senderKind === 'BUYER';
              return (
                <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.body}</Text>
                    <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                      {formatTime(item.createdAt)}
                    </Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>💬</Text>
                <Text style={styles.emptyTitle}>Hãy bắt đầu cuộc trò chuyện</Text>
                <Text style={styles.emptySubtitle}>
                  Nhắn tin cho chuyên viên để được tư vấn nhanh nhất.
                </Text>
              </View>
            }
          />
        )}

        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            maxLength={4000}
          />
          <Pressable
            onPress={onSend}
            disabled={!draft.trim() || sendMutation.isPending}
            style={[
              styles.sendBtn,
              (!draft.trim() || sendMutation.isPending) && { opacity: 0.4 },
            ]}
          >
            {sendMutation.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.sendText}>Gửi</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgBase },
  center: {
    flex: 1,
    backgroundColor: colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgSurface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  backBtn: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
  backBtnText: { fontSize: 32, color: colors.brand, fontWeight: '600', lineHeight: 32 },
  headerTitle: { fontSize: typography.lg, fontWeight: '800', color: colors.textPrimary },
  headerSubtitle: { fontSize: typography.xs, color: colors.textTertiary },

  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    flexGrow: 1,
  },
  bubbleRow: { flexDirection: 'row', marginVertical: 2 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  bubbleMine: { backgroundColor: colors.brand, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.bgMuted, borderBottomLeftRadius: 4 },
  bubbleText: { color: colors.textPrimary, fontSize: typography.base, lineHeight: 20 },
  bubbleTextMine: { color: colors.textInverse },
  bubbleTime: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 2,
    alignSelf: 'flex-end',
  },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.75)' },

  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl * 2 },
  emptyIcon: { fontSize: 56, marginBottom: spacing.md },
  emptyTitle: { fontSize: typography.lg, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs },
  emptySubtitle: {
    fontSize: typography.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgSurface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: colors.bgMuted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: typography.base,
    color: colors.textPrimary,
  },
  sendBtn: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  sendText: { color: 'white', fontWeight: '800', fontSize: typography.base },
  backCta: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    backgroundColor: colors.brand,
    borderRadius: radius.md,
  },
  backCtaText: { color: 'white', fontWeight: '700' },
});
