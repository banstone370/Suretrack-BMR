import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import type { ApiResponse } from '../../types';

interface NotificationItem {
  _id: string;
  title: string;
  body: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
  type: string;
}

interface PendingInbox {
  pendingBatches: number;
  unreadCount: number;
  statuses: string[];
}

export function NotificationsPage() {
  const queryClient = useQueryClient();

  const pending = useQuery({
    queryKey: ['notifications-pending'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<PendingInbox>>('/notifications/pending');
      return data.data;
    },
  });

  const list = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<NotificationItem[]>>('/notifications');
      return data.data;
    },
    refetchInterval: 30000,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-pending'] });
    },
  });

  const markAll = useMutation({
    mutationFn: async () => {
      await api.post('/notifications/read-all');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-pending'] });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-brand-950 sm:text-2xl">
            Inbox
          </h1>
          <p className="mt-1 text-sm text-muted">Pending work and notifications for your role</p>
        </div>
        <button
          type="button"
          onClick={() => markAll.mutate()}
          className="rounded-md border border-line bg-white px-4 py-2 text-sm hover:bg-brand-50"
        >
          Mark all read
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-white/90 px-4 py-3 shadow-sm">
          <p className="text-xs text-muted">Batches awaiting your role</p>
          <p className="mt-1 font-display text-3xl font-semibold text-brand-900">
            {pending.data?.pendingBatches ?? '—'}
          </p>
          {(pending.data?.statuses?.length ?? 0) > 0 && (
            <p className="mt-1 text-xs text-muted">{pending.data?.statuses.join(', ')}</p>
          )}
          <Link to="/batches" className="mt-2 inline-block text-sm text-brand-800 hover:underline">
            Open batches →
          </Link>
        </div>
        <div className="rounded-xl border border-line bg-white/90 px-4 py-3 shadow-sm">
          <p className="text-xs text-muted">Unread notifications</p>
          <p className="mt-1 font-display text-3xl font-semibold text-brand-900">
            {pending.data?.unreadCount ?? '—'}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {(list.data ?? []).map((n) => (
          <div
            key={n._id}
            className={`rounded-xl border px-4 py-3 shadow-sm ${
              n.isRead ? 'border-line bg-white/70' : 'border-brand-800/20 bg-brand-50/80'
            }`}
          >
            <div className="flex items-start gap-3">
              <Bell size={16} className="mt-1 shrink-0 text-brand-800" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{n.title}</p>
                <p className="mt-0.5 text-sm text-muted">{n.body}</p>
                <p className="mt-1 text-xs text-muted">{formatDate(n.createdAt)}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  {n.link && (
                    <Link to={n.link} className="text-brand-800 hover:underline">
                      Open
                    </Link>
                  )}
                  {!n.isRead && (
                    <button
                      type="button"
                      onClick={() => markRead.mutate(n._id)}
                      className="text-muted hover:underline"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        {list.isSuccess && (list.data?.length ?? 0) === 0 && (
          <p className="text-sm text-muted">No notifications yet.</p>
        )}
      </div>
    </div>
  );
}
