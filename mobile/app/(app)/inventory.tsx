import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api, apiErrorMessage, unwrap } from '../../src/lib/api';
import {
  Card,
  EmptyState,
  ErrorBanner,
  KeyValue,
  Loading,
  Screen,
  SectionTitle,
  StatusBadge,
} from '../../src/components/ui';
import { colors } from '../../src/lib/theme';
import { formatDate } from '../../src/lib/format';
import type { ApiResponse } from '../../src/types';

interface FgRow {
  _id: string;
  batchId: string;
  batchNo: string;
  productName: string;
  catalogueNo: string;
  quantityAvailable: number;
  quantityDispatched: number;
  receivedOn: string;
  expiryDate: string;
  storageCondition: string;
  status: string;
}

export default function InventoryPage() {
  const list = useQuery({
    queryKey: ['inventory-fg'],
    queryFn: async () => unwrap(await api.get<ApiResponse<FgRow[]>>('/inventory/finished-goods')),
  });

  return (
    <Screen>
      <Card>
        <SectionTitle>Finished Goods</SectionTitle>
        <Text style={styles.sub}>Released inventory available for dispatch</Text>
      </Card>

      {list.isLoading ? <Loading label="Loading inventory…" /> : null}
      {list.error ? <ErrorBanner message={apiErrorMessage(list.error)} /> : null}
      {list.isSuccess && (list.data?.length ?? 0) === 0 ? (
        <EmptyState text="No finished goods yet. Complete QA release and FG transfer on a batch." />
      ) : null}

      {(list.data ?? []).map((row) => (
        <Card key={row._id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.title}>{row.batchNo}</Text>
            <StatusBadge status={row.status} />
          </View>
          <Text style={styles.sub}>
            {row.productName} · Cat. {row.catalogueNo}
          </Text>
          <KeyValue label="Available" value={row.quantityAvailable.toLocaleString()} />
          <KeyValue label="Dispatched" value={row.quantityDispatched.toLocaleString()} />
          <KeyValue label="Received" value={formatDate(row.receivedOn)} />
          <KeyValue label="Expiry" value={formatDate(row.expiryDate)} />
          <KeyValue label="Storage" value={row.storageCondition || '—'} />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontWeight: '800', fontSize: 16, color: colors.text },
  sub: { color: colors.muted, fontSize: 13, marginTop: 3 },
});
