import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/state/AuthContext';
import { Loading } from '../../src/components/ui';
import { colors } from '../../src/lib/theme';

export default function AppLayout() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="batches/create" options={{ title: 'Create Batch' }} />
      <Stack.Screen name="batch/[id]/index" options={{ title: 'Batch' }} />
      <Stack.Screen name="batch/[id]/stage/[slug]" options={{ title: 'Stage' }} />
      <Stack.Screen name="batch/[id]/dispatch" options={{ title: 'Dispatch' }} />
      <Stack.Screen name="batch/[id]/audit" options={{ title: 'Batch Audit' }} />
    </Stack>
  );
}
