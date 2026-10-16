import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import { api, apiErrorMessage, arrayBufferToBase64, downloadBlob, unwrap } from '../../src/lib/api';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  InfoTile,
  KeyValue,
  Loading,
  Screen,
  SectionTitle,
  StatusBadge,
} from '../../src/components/ui';
import { colors } from '../../src/lib/theme';
import { formatDate, statusLabel } from '../../src/lib/format';
import type { ApiResponse } from '../../src/types';

type ReportTab = 'production' | 'qc' | 'sterilization' | 'inventory' | 'dispatch';

const TABS: Array<{ id: ReportTab; label: string }> = [
  { id: 'production', label: 'Production' },
  { id: 'qc', label: 'QC' },
  { id: 'sterilization', label: 'Sterilization' },
  { id: 'inventory', label: 'Finished Goods' },
  { id: 'dispatch', label: 'Dispatch' },
];

interface ProductionReport {
  batchesCreated: number;
  batchesCompleted: number;
  productionQuantity: number;
  averageBatchSize: number;
  byStatus: Array<{ status: string; count: number }>;
  recentBatches: Array<{
    _id: string;
    batchNo: string;
    productName: string;
    batchSize: number;
    status: string;
    manufacturingDate: string;
  }>;
}

interface QcReport {
  pendingQc: number;
  onHold: number;
  failed: number;
  passed: number;
  summary: Array<{ label: string; value: number }>;
  batches: Array<{
    id: string;
    batchNo: string;
    productName: string;
    status: string;
    sterilityResult: string | null;
    betResult: string | null;
  }>;
}

interface SterilizationReport {
  cyclesInProgress: number;
  cyclesCompleted: number;
  quantitySterilized: number;
  cartridgeUsage: Array<{ status: string; count: number; remainingGrams: number }>;
  recentCycles: Array<{
    id: string;
    batchNo: string;
    quantity: number | null;
    cartridgeBatchNo: string | null;
    machineId: string | null;
    operator: string | null;
  }>;
}

interface InventoryReport {
  availableQuantity: number;
  dispatchedQuantity: number;
  releasedBatches: number;
  dispatchedBatches: number;
  byStatus: Array<{ status: string; lots: number; available: number; dispatched: number }>;
  items: Array<{
    _id: string;
    batchId: string;
    batchNo: string;
    productName: string;
    quantityAvailable: number;
    quantityDispatched: number;
    status: string;
    expiryDate: string;
  }>;
}

interface DispatchReport {
  confirmedDispatches: number;
  quantityDispatched: number;
  byCustomer: Array<{ customer: string; count: number; quantity: number }>;
  byDate: Array<{ date: string; count: number; quantity: number }>;
  recent: Array<{
    _id: string;
    batchNo: string;
    customerName: string;
    billNo: string;
    quantity: number;
    dispatchDate: string;
  }>;
}

function KpiRow({ tiles }: { tiles: Array<{ label: string; value: string }> }) {
  return (
    <View style={styles.kpiRow}>
      {tiles.map((t) => (
        <InfoTile key={t.label} label={t.label} value={t.value} />
      ))}
    </View>
  );
}

/** Horizontal bar chart (mobile replacement for recharts BarChart) */
function BarRows({ title, data }: { title: string; data: Array<{ name: string; value: number }> }) {
  const max = Math.max(...data.map((d) => d.value), 0);
  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      {data.length === 0 ? (
        <Text style={styles.empty}>No data yet</Text>
      ) : (
        data.map((d, i) => (
          <View key={`${d.name}-${i}`} style={styles.barRow}>
            <Text style={styles.barLabel} numberOfLines={1}>
              {d.name}
            </Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: max > 0 ? `${Math.max(2, Math.round((d.value / max) * 100))}%` : '0%' },
                ]}
              />
            </View>
            <Text style={styles.barValue}>{d.value.toLocaleString()}</Text>
          </View>
        ))
      )}
    </Card>
  );
}

function ProductionPanel({ d }: { d: ProductionReport }) {
  return (
    <View>
      <KpiRow
        tiles={[
          { label: 'Batches created', value: String(d.batchesCreated ?? 0) },
          { label: 'Batches completed', value: String(d.batchesCompleted ?? 0) },
          { label: 'Production quantity', value: Number(d.productionQuantity ?? 0).toLocaleString() },
          { label: 'Avg batch size', value: Number(d.averageBatchSize ?? 0).toLocaleString() },
        ]}
      />
      <BarRows
        title="Batches by status"
        data={(d.byStatus ?? []).map((r) => ({ name: statusLabel(r.status), value: r.count }))}
      />
      {(d.recentBatches ?? []).length === 0 ? (
        <EmptyState text="No batches yet." />
      ) : (
        (d.recentBatches ?? []).map((b) => (
          <Card key={b._id}>
            <KeyValue label={b.batchNo} value={<StatusBadge status={b.status} />} />
            <Text style={styles.sub}>{b.productName}</Text>
            <KeyValue label="Size" value={Number(b.batchSize ?? 0).toLocaleString()} />
            <KeyValue label="Mfg date" value={formatDate(b.manufacturingDate)} />
          </Card>
        ))
      )}
    </View>
  );
}

function QcPanel({ d }: { d: QcReport }) {
  return (
    <View>
      <KpiRow
        tiles={[
          { label: 'Pending QC', value: String(d.pendingQc ?? 0) },
          { label: 'On hold', value: String(d.onHold ?? 0) },
          { label: 'Rejected', value: String(d.failed ?? 0) },
          { label: 'Lab passes (Sterility+BET)', value: String(d.passed ?? 0) },
        ]}
      />
      <BarRows
        title="QC summary"
        data={(d.summary ?? []).map((r) => ({ name: r.label, value: r.value }))}
      />
      {(d.batches ?? []).length === 0 ? (
        <EmptyState text="No QC items." />
      ) : (
        (d.batches ?? []).map((b) => (
          <Card key={b.id}>
            <KeyValue label={b.batchNo} value={<StatusBadge status={b.status} />} />
            <Text style={styles.sub}>{b.productName}</Text>
            <KeyValue label="Sterility" value={b.sterilityResult ?? '—'} />
            <KeyValue label="BET" value={b.betResult ?? '—'} />
          </Card>
        ))
      )}
    </View>
  );
}

function SterilizationPanel({ d }: { d: SterilizationReport }) {
  return (
    <View>
      <KpiRow
        tiles={[
          { label: 'Cycles in progress', value: String(d.cyclesInProgress ?? 0) },
          { label: 'Cycles completed', value: String(d.cyclesCompleted ?? 0) },
          { label: 'Quantity sterilized', value: Number(d.quantitySterilized ?? 0).toLocaleString() },
        ]}
      />
      <BarRows
        title="ETO cartridge lots by status"
        data={(d.cartridgeUsage ?? []).map((r) => ({ name: r.status, value: r.count }))}
      />
      {(d.recentCycles ?? []).length === 0 ? (
        <EmptyState text="No sterilization cycles yet." />
      ) : (
        (d.recentCycles ?? []).map((c) => (
          <Card key={c.id}>
            <Text style={styles.title}>{c.batchNo}</Text>
            <KeyValue label="Qty" value={c.quantity != null ? Number(c.quantity).toLocaleString() : '—'} />
            <KeyValue label="Cartridge" value={c.cartridgeBatchNo ?? '—'} />
            <KeyValue label="Machine" value={c.machineId ?? '—'} />
            <KeyValue label="Operator" value={c.operator ?? '—'} />
          </Card>
        ))
      )}
    </View>
  );
}

function InventoryPanel({ d }: { d: InventoryReport }) {
  return (
    <View>
      <KpiRow
        tiles={[
          { label: 'Available quantity', value: Number(d.availableQuantity ?? 0).toLocaleString() },
          { label: 'Dispatched quantity', value: Number(d.dispatchedQuantity ?? 0).toLocaleString() },
          { label: 'Released batches', value: String(d.releasedBatches ?? 0) },
          { label: 'Dispatched batches', value: String(d.dispatchedBatches ?? 0) },
        ]}
      />
      <BarRows
        title="Finished goods available by status"
        data={(d.byStatus ?? []).map((r) => ({ name: statusLabel(r.status), value: r.available }))}
      />
      {(d.items ?? []).length === 0 ? (
        <EmptyState text="No finished goods yet." />
      ) : (
        (d.items ?? []).map((item) => (
          <Card key={item._id}>
            <KeyValue label={item.batchNo} value={<StatusBadge status={item.status} />} />
            <Text style={styles.sub}>{item.productName}</Text>
            <KeyValue label="Available" value={Number(item.quantityAvailable ?? 0).toLocaleString()} />
            <KeyValue label="Dispatched" value={Number(item.quantityDispatched ?? 0).toLocaleString()} />
            <KeyValue label="Expiry" value={formatDate(item.expiryDate)} />
          </Card>
        ))
      )}
    </View>
  );
}

function DispatchPanel({ d }: { d: DispatchReport }) {
  return (
    <View>
      <KpiRow
        tiles={[
          { label: 'Confirmed dispatches', value: String(d.confirmedDispatches ?? 0) },
          { label: 'Quantity dispatched', value: Number(d.quantityDispatched ?? 0).toLocaleString() },
        ]}
      />
      <BarRows
        title="Customer-wise quantity"
        data={(d.byCustomer ?? []).map((r) => ({ name: r.customer, value: r.quantity }))}
      />
      <BarRows
        title="Date-wise quantity"
        data={(d.byDate ?? []).map((r) => ({ name: r.date, value: r.quantity }))}
      />
      {(d.recent ?? []).length === 0 ? (
        <EmptyState text="No dispatches yet." />
      ) : (
        (d.recent ?? []).map((r) => (
          <Card key={r._id}>
            <Text style={styles.title}>{r.billNo}</Text>
            <Text style={styles.sub}>
              {r.batchNo} · {r.customerName}
            </Text>
            <KeyValue label="Qty" value={Number(r.quantity ?? 0).toLocaleString()} />
            <KeyValue label="Date" value={formatDate(r.dispatchDate)} />
          </Card>
        ))
      )}
    </View>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('production');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const report = useQuery({
    queryKey: ['report', tab],
    queryFn: async () =>
      unwrap(await api.get<ApiResponse<Record<string, unknown>>>(`/reports/${tab}`)),
  });

  const exportCsv = async () => {
    setExporting(true);
    setExportError('');
    try {
      const buf = await downloadBlob(`/api/v1/reports/${tab}?format=csv`);
      const name = `${tab}-report.csv`;
      const file = new File(Paths.cache, name);
      file.create({ overwrite: true });
      file.write(arrayBufferToBase64(buf), { encoding: 'base64' });
      try {
        await file.preview({ title: name });
      } catch {
        Alert.alert('Export saved', `CSV saved to ${file.uri}`);
      }
    } catch (e) {
      Alert.alert('Export failed', apiErrorMessage(e, 'Failed to export CSV'));
      setExportError(apiErrorMessage(e, 'Failed to export CSV'));
    } finally {
      setExporting(false);
    }
  };

  const d = report.data;

  return (
    <Screen>
      <Card>
        <SectionTitle>Reports</SectionTitle>
        <Text style={styles.sub}>
          Production, QC, sterilization, inventory, and dispatch analytics
        </Text>
        <Button
          title={exporting ? 'Exporting…' : 'Export CSV'}
          variant="secondary"
          onPress={() => void exportCsv()}
          loading={exporting}
        />
        <ErrorBanner message={exportError} />
      </Card>

      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            style={[styles.tab, tab === t.id && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {report.isLoading || (!d && !report.error) ? <Loading label="Loading report…" /> : null}
      {report.error ? <ErrorBanner message={apiErrorMessage(report.error)} /> : null}

      {d ? (
        tab === 'production' ? (
          <ProductionPanel d={d as unknown as ProductionReport} />
        ) : tab === 'qc' ? (
          <QcPanel d={d as unknown as QcReport} />
        ) : tab === 'sterilization' ? (
          <SterilizationPanel d={d as unknown as SterilizationReport} />
        ) : tab === 'inventory' ? (
          <InventoryPanel d={d as unknown as InventoryReport} />
        ) : (
          <DispatchPanel d={d as unknown as DispatchReport} />
        )
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { color: colors.muted, fontSize: 13, marginTop: 3 },
  title: { fontWeight: '800', fontSize: 15, color: colors.text },
  empty: { color: colors.muted, textAlign: 'center', paddingVertical: 16 },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.text },
  tabTextActive: { color: '#fff' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  barLabel: { color: colors.muted, fontSize: 12, width: 96 },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.greyLight,
    overflow: 'hidden',
  },
  barFill: { height: 10, borderRadius: 5, backgroundColor: colors.primary },
  barValue: { color: colors.text, fontSize: 12, fontWeight: '700', width: 64, textAlign: 'right' },
});
