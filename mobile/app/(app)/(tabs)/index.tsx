import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api, apiErrorMessage, unwrap } from '../../../src/lib/api';
import { useAuth } from '../../../src/state/AuthContext';
import {
  Button,
  Card,
  ErrorBanner,
  Loading,
  NoticeBanner,
  ProgressBar,
  Screen,
  SectionTitle,
  StatusBadge,
} from '../../../src/components/ui';
import { colors, radius } from '../../../src/lib/theme';
import { formatDate, statusLabel } from '../../../src/lib/format';
import type { ApiResponse, BatchListItem, DashboardSummary } from '../../../src/types';

interface RecentBatch {
  id: string;
  batchNo: string;
  productName: string;
  status: string;
  stage?: string;
  progressPercent: number;
  manufacturingDate: string;
  updatedAt: string;
}

const KPIS: Array<{ key: keyof DashboardSummary; label: string }> = [
  { key: 'activeBatches', label: 'Active Batches' },
  { key: 'pendingQc', label: 'Pending QC' },
  { key: 'readyFg', label: 'Ready FG' },
  { key: 'pendingApprovals', label: 'Pending Approvals' },
  { key: 'sterilization', label: 'Sterilization' },
  { key: 'dispatch', label: 'Dispatch' },
];

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const summary = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => unwrap(await api.get<ApiResponse<DashboardSummary>>('/dashboard/summary')),
  });
  const recent = useQuery({
    queryKey: ['dashboard-recent'],
    queryFn: async () => unwrap(await api.get<ApiResponse<RecentBatch[]>>('/dashboard/recent-batches')),
  });

  if (summary.isLoading) return <Loading />;

  return (
    <Screen scroll>
      <NoticeBanner message={`Signed in as ${user?.name} (${user?.employeeId})`} tone="info" />
      <Text style={styles.hello}>Welcome back</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
        {KPIS.map((k) => (
          <View key={k.key} style={styles.kpi}>
            <Text style={styles.kpiValue}>{summary.data?.[k.key] ?? 0}</Text>
            <Text style={styles.kpiLabel}>{k.label}</Text>
          </View>
        ))}
      </ScrollView>

      {hasPermission('batches:create') ? (
        <Button title="Create Batch" onPress={() => router.push('/(app)/batches/create')} />
      ) : null}

      <Card>
        <SectionTitle>Recent Batches</SectionTitle>
        {recent.isLoading ? <Loading /> : null}
        {recent.error ? <ErrorBanner message={apiErrorMessage(recent.error)} /> : null}
        {(recent.data ?? []).map((b) => (
          <Link key={b.id} href={{ pathname: '/(app)/batch/[id]', params: { id: b.id } } as never}>
            <Pressable style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{b.batchNo}</Text>
                <Text style={styles.rowSub}>{b.productName}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <StatusBadge status={b.status} />
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{formatDate(b.manufacturingDate)}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <ProgressBar percent={b.progressPercent} />
                </View>
              </View>
              <Text style={{ color: colors.muted }}>›</Text>
            </Pressable>
          </Link>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hello: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10 },
  kpi: {
    backgroundColor: '#fff',
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    minWidth: 108,
  },
  kpiValue: { fontSize: 22, fontWeight: '800', color: colors.primary },
  kpiLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  rowTitle: { fontWeight: '700', color: colors.text, fontSize: 15 },
  rowSub: { color: colors.muted, fontSize: 13, marginTop: 1 },
});
