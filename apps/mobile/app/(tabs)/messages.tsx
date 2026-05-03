/**
 * Conversations tab (Task #55).
 *
 * Lists every thread the buyer has with vendor agents, ordered by last
 * message. Tapping a row deep-links into `/messages/<id>`. Refreshes on
 * focus + on every realtime event from any open chat (the chat screen
 * invalidates the ['conversations'] query as it sends/receives).
 *
 * Logged-out users see the empty state — the conversations endpoint is
 * gated by buyer JWT, so we short-circuit before hitting the network.
 */

import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { conversationsApi, type ConversationSummary } from '../../src/api/conversations';
import { useAuth } from '../../src/auth/AuthContext';
import { EmptyState } from '../../src/components/EmptyState';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

function relativeTime(iso: string): string {
  const now = Date.now();
  const ts = new Date(iso).getTime();
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'vừa xong';
  if (min < 60) return `${min} phút`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} ngày`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['conversations'],
    queryFn: () => conversationsApi.list(),
    enabled: !!user,
  });

  // Refresh whenever the tab regains focus (e.g. after coming back from a
  // chat where new messages arrived).
  useFocusEffect(
    useCallback(() => {
      if (user) queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }, [user, queryClient]),
  );

  const renderItem = useCallback(
    ({ item }: { item: ConversationSummary }) => {
      const title = item.listingTitle || item.agentName || 'Chuyên viên';
      const preview = item.lastMessagePreview || 'Bắt đầu trò chuyện…';
      const unread = item.unreadForBuyer > 0;
      return (
        <Pressable
          style={styles.row}
          onPress={() =>
            router.push({
              pathname: '/messages/[id]',
              params: { id: item.id, title: title.slice(0, 80) },
            })
          }
          android_ripple={{ color: colors.brandSoft }}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(item.agentName || 'CV').slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={styles.rowBody}>
            <View style={styles.rowHead}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.rowTime}>{relativeTime(item.lastMessageAt)}</Text>
            </View>
            <View style={styles.rowFoot}>
              <Text
                style={[styles.preview, unread && styles.previewUnread]}
                numberOfLines={1}
              >
                {preview}
              </Text>
              {unread ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{Math.min(item.unreadForBuyer, 99)}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>
      );
    },
    [router],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Tin nhắn</Text>
        <Text style={styles.subtitle}>Trao đổi trực tiếp với chuyên viên</Text>
      </View>

      {!user ? (
        <EmptyState
          icon="💬"
          title="Đăng nhập để nhắn tin"
          subtitle="Vui lòng đăng nhập để xem và gửi tin nhắn cho chuyên viên tư vấn."
        />
      ) : query.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : query.error ? (
        <EmptyState
          icon="⚠️"
          title="Không tải được hội thoại"
          subtitle="Vui lòng kiểm tra kết nối mạng và thử lại."
        />
      ) : (query.data?.conversations.length || 0) === 0 ? (
        <EmptyState
          icon="💬"
          title="Chưa có hội thoại nào"
          subtitle="Mở một bất động sản và bấm 'Nhắn tin chuyên viên' để bắt đầu."
        />
      ) : (
        <FlatList
          data={query.data?.conversations || []}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => query.refetch()}
              tintColor={colors.brand}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.bgSurface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { fontSize: typography.xxl, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: typography.sm, color: colors.textTertiary, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.bgSurface,
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.brand, fontWeight: '800', fontSize: typography.lg },
  rowBody: { flex: 1 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: {
    fontSize: typography.base,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  rowTime: { fontSize: typography.xs, color: colors.textTertiary },
  rowFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: spacing.sm,
  },
  preview: { fontSize: typography.sm, color: colors.textTertiary, flex: 1 },
  previewUnread: { color: colors.textPrimary, fontWeight: '700' },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: 'white', fontSize: 11, fontWeight: '800' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 76 },
});
