import React from 'react';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../../../src/lib/api';
import { colors } from '../../../src/lib/theme';

function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications-pending'],
    queryFn: async () => {
      const res = await api.get('/notifications/pending');
      return unwrap<{ unreadCount?: number }>(res);
    },
    refetchInterval: 30_000,
  });
}

export default function TabsLayout() {
  const pending = useUnreadCount();
  const unread = pending.data?.unreadCount ?? 0;
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="batches"
        options={{
          title: 'Batches',
          tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={unread > 0 ? 'mail' : 'mail-outline'} size={size} color={color as string} />
          ),
          tabBarBadge: unread > 0 ? unread : undefined,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal-circle-outline" size={size} color={color as string} />,
        }}
      />
    </Tabs>
  );
}

void Text;
