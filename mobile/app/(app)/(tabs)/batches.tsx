import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api, apiErrorMessage, unwrap } from '../../../src/lib/api';
import { useAuth } from '../../../src/state/AuthContext';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Loading,
  ProgressBar,
  Screen,
  SelectField,
  StatusBadge,
} from '../../../src/components/ui';
import { colors } from '../../../src/lib/theme';
import { formatDate, statusLabel } from '../../../src/lib/format';
import type { ApiResponse, BatchListItem } from '../../../src/types';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: statusLabel('DRAFT') },
  { value: 'RAW_MATERIAL_QC', label: statusLabel('RAW_MATERIAL_QC') },
  { value: 'MANUFACTURING', label: statusLabel('MANUFACTURING') },
  { value: 'STERILIZATION', label: statusLabel('STERILIZATION') },
  { value: 'QA_REVIEW', label: statusLabel('QA_REVIEW') },
  { value: 'FINISHED_GOODS', label: statusLabel('FINISHED_GOODS') },
  { value: 'DISPATCHED', label: statusLabel('DISPATCHED') },
];

export default function BatchesPage() {
  const { hasPermission } = useAuth();
  const [batchNo, setBatchNo] = useState('');
  const [status, setStatus] = useState('');
  const [applied, setApplied] = useState({ batchNo: '', status: '' });

  const params = useMemo(() => {
    const p: Record<string, string> = { limit: '100' };
    if (applied.batchNo) p.batchNo = applied.batchNo;
    if (applied.status) p.status = applied.status;
    return p;
  }, [applied]);

  const batches = useQuery({
    queryKey: ['batches', params],
    queryFn: async () =>
      unwrap(await api.get<ApiResponse<BatchListItem[]>>('/batches', { params })),
  });

  return (
    <Screen>
      {hasPermission('batches:create') ? (
        <Button title="Create Batch" onPress={() => router.push('/(app)/batches/create')} />
      ) : null}
      <Card>
        <Field label="Batch No." value={batchNo} onChangeText={setBatchNo} placeholder="Search batch number" />
        <SelectField label="Status" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        <Button
          title="Search"
          variant="secondary"
          onPress={() => setApplied({ batchNo, status })}
        />
      </Card>
      {batches.isLoading ? <Loading /> : null}
      {batches.error ? <ErrorBanner message={apiErrorMessage(batches.error)} /> : null}
      {batches.data?.length === 0 ? <EmptyState text="No batches found." /> : null}
      {(batches.data ?? []).map((b) => (
        <Link key={b.id} href={{ pathname: '/(app)/batch/[id]', params: { id: b.id } } as never}>
          <Pressable>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.title}>{b.batchNo}</Text>
                <StatusBadge status={b.status} />
              </View>
              <Text style={styles.sub}>{b.productName} · Cat. {b.catalogueNo}</Text>
              <Text style={styles.sub}>
                Size {b.batchSize} · Mfg {formatDate(b.manufacturingDate)} · Exp {formatDate(b.expiryDate)}
              </Text>
              <View style={{ marginTop: 8 }}>
                <ProgressBar percent={b.progressPercent} />
              </View>
            </Card>
          </Pressable>
        </Link>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontWeight: '800', fontSize: 16, color: colors.text },
  sub: { color: colors.muted, fontSize: 13, marginTop: 3 },
});
