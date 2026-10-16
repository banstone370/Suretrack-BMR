import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage, unwrap } from '../../../src/lib/api';
import { Button, Card, EmptyState, ErrorBanner, Loading, Screen, SectionTitle } from '../../../src/components/ui';
import { colors } from '../../../src/lib/theme';
import { formatDateTime } from '../../../src/lib/format';

interface NotificationItem {
  _id: string;
  title: string;
  body?: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
  type?: string;
}

export default function InboxPage() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => unwrap(await api.get('/notifications')),
    refetchInterval: 30_000,
  });
  const pending = useQuery({
    queryKey: ['notifications-pending'],
    queryFn: async () =>
      unwrap<{ unreadCount?: number; pendingBatches?: number; statuses?: string[] }>(
        await api.get('/notifications/pending'),
      ),
    refetchInterval: 30_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['notifications-pending'] });
  };

  const markRead = useMutation({
    mutationFn: async (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: invalidate,
  });
  const markAll = useMutation({
    mutationFn: async () => api.post('/notifications/read-all'),
    onSuccess: invalidate,
  });

  const items: NotificationItem[] = (list.data as NotificationItem[]) ?? [];
  const unread = items.filter((n) => !n.isRead).length;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Card style={{ flex: 1 }}>
          <Text style={styles.big}>{pending.data?.pendingBatches ?? 0}</Text>
          <Text style={styles.small}>Batches awaiting your role</Text>
          {pending.data?.statuses?.length ? (
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
              {pending.data.statuses.join(', ')}
            </Text>
          ) : null}
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={styles.big}>{pending.data?.unreadCount ?? unread}</Text>
          <Text style={styles.small}>Unread notifications</Text>
        </Card>
      </View>
      <Button title="Mark all read" variant="secondary" onPress={() => markAll.mutate()} loading={markAll.isPending} />
      {list.isLoading ? <Loading /> : null}
      {list.error ? <ErrorBanner message={apiErrorMessage(list.error)} /> : null}
      {items.length === 0 && !list.isLoading ? <EmptyState text="Inbox is empty." /> : null}
      {items.map((n) => (
        <Card key={n._id} style={{ borderLeftWidth: 4, borderLeftColor: n.isRead ? colors.border : colors.primary }}>
          <Text style={styles.title}>{n.title}</Text>
          {n.body ? <Text style={styles.body}>{n.body}</Text> : null}
          <Text style={styles.time}>{formatDateTime(n.createdAt)}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {n.link ? (
              <Pressable
                onPress={() => {
                  const m = /\/batches\/([^/]+)/.exec(n.link ?? '');
                  if (m) router.push({ pathname: '/(app)/batch/[id]', params: { id: m[1] } } as never);
                }}
              >
                <Text style={{ color: colors.primary, fontWeight: '700' }}>Open</Text>
              </Pressable>
            ) : null}
            {!n.isRead ? (
              <Pressable onPress={() => markRead.mutate(n._id)}>
                <Text style={{ color: colors.muted, fontWeight: '600' }}>Mark read</Text>
              </Pressable>
            ) : null}
          </View>
        </Card>
      ))}
    </Screen>
  );
}

void SectionTitle;

const styles = StyleSheet.create({
  big: { fontSize: 24, fontWeight: '800', color: colors.primary },
  small: { color: colors.muted, fontSize: 12, marginTop: 2 },
  title: { fontWeight: '700', color: colors.text, fontSize: 15 },
  body: { color: colors.muted, fontSize: 13, marginTop: 3 },
  time: { color: colors.muted, fontSize: 11, marginTop: 6 },
});
