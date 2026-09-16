import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../../lib/api';
import { formatDate, STATUS_LABELS } from '../../lib/utils';
import type { ApiResponse } from '../../types';

type ReportTab = 'production' | 'qc' | 'sterilization' | 'inventory' | 'dispatch';

const TABS: Array<{ id: ReportTab; label: string }> = [
  { id: 'production', label: 'Production' },
  { id: 'qc', label: 'QC' },
  { id: 'sterilization', label: 'Sterilization' },
  { id: 'inventory', label: 'Finished Goods' },
  { id: 'dispatch', label: 'Dispatch' },
];

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-line bg-white/90 px-4 py-3 shadow-sm">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-brand-900">{value}</p>
    </div>
  );
}

function ChartCard({
  title,
  data,
  dataKey,
  nameKey,
}: {
  title: string;
  data: Array<Record<string, string | number>>;
  dataKey: string;
  nameKey: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-white/90 p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No data yet</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d5dee5" />
              <XAxis dataKey={nameKey} tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={56} />
              <YAxis tick={{ fontSize: 11 }} width={36} />
              <Tooltip />
              <Bar dataKey={dataKey} fill="#0b4f6c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function ProductionPanel() {
  const report = useQuery({
    queryKey: ['report', 'production'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Record<string, unknown>>>('/reports/production');
      return data.data;
    },
  });

  const d = report.data;
  const byStatus = ((d?.byStatus as Array<{ status: string; count: number }>) ?? []).map(
    (r) => ({
      name: STATUS_LABELS[r.status] ?? r.status,
      count: r.count,
    }),
  );
  const recent = (d?.recentBatches as Array<{
    _id: string;
    batchNo: string;
    productName: string;
    batchSize: number;
    status: string;
    manufacturingDate: string;
  }>) ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Batches created" value={Number(d?.batchesCreated ?? 0)} />
        <Kpi label="Batches completed" value={Number(d?.batchesCompleted ?? 0)} />
        <Kpi
          label="Production quantity"
          value={Number(d?.productionQuantity ?? 0).toLocaleString()}
        />
        <Kpi label="Avg batch size" value={Number(d?.averageBatchSize ?? 0).toLocaleString()} />
      </div>
      <ChartCard title="Batches by status" data={byStatus} dataKey="count" nameKey="name" />
      <div className="table-scroll rounded-xl border border-line bg-white/80 shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-brand-50/80 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Mfg date</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((b) => (
              <tr key={b._id} className="border-t border-line/70">
                <td className="px-4 py-2">
                  <Link to={`/batches/${b._id}`} className="text-brand-900 hover:underline">
                    {b.batchNo}
                  </Link>
                </td>
                <td className="px-4 py-2">{b.productName}</td>
                <td className="px-4 py-2">{b.batchSize.toLocaleString()}</td>
                <td className="px-4 py-2">{STATUS_LABELS[b.status] ?? b.status}</td>
                <td className="px-4 py-2 text-muted">{formatDate(b.manufacturingDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QcPanel() {
  const report = useQuery({
    queryKey: ['report', 'qc'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Record<string, unknown>>>('/reports/qc');
      return data.data;
    },
  });
  const d = report.data;
  const summary = ((d?.summary as Array<{ label: string; value: number }>) ?? []).map((r) => ({
    name: r.label,
    value: r.value,
  }));
  const batches = (d?.batches as Array<{
    id: string;
    batchNo: string;
    productName: string;
    status: string;
    sterilityResult: string | null;
    betResult: string | null;
  }>) ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Pending QC" value={Number(d?.pendingQc ?? 0)} />
        <Kpi label="On hold" value={Number(d?.onHold ?? 0)} />
        <Kpi label="Rejected" value={Number(d?.failed ?? 0)} />
        <Kpi label="Lab passes (Sterility+BET)" value={Number(d?.passed ?? 0)} />
      </div>
      <ChartCard title="QC summary" data={summary} dataKey="value" nameKey="name" />
      <div className="table-scroll rounded-xl border border-line bg-white/80 shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-brand-50/80 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Sterility</th>
              <th className="px-4 py-3">BET</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} className="border-t border-line/70">
                <td className="px-4 py-2">
                  <Link to={`/batches/${b.id}`} className="text-brand-900 hover:underline">
                    {b.batchNo}
                  </Link>
                  <div className="text-xs text-muted">{b.productName}</div>
                </td>
                <td className="px-4 py-2">{STATUS_LABELS[b.status] ?? b.status}</td>
                <td className="px-4 py-2">{b.sterilityResult ?? '—'}</td>
                <td className="px-4 py-2">{b.betResult ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SterilizationPanel() {
  const report = useQuery({
    queryKey: ['report', 'sterilization'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Record<string, unknown>>>(
        '/reports/sterilization',
      );
      return data.data;
    },
  });
  const d = report.data;
  const cartridgeUsage = (
    (d?.cartridgeUsage as Array<{ status: string; count: number; remainingGrams: number }>) ??
    []
  ).map((r) => ({ name: r.status, count: r.count, remaining: r.remainingGrams }));
  const cycles = (d?.recentCycles as Array<{
    id: string;
    batchNo: string;
    quantity: number | null;
    cartridgeBatchNo: string | null;
    machineId: string | null;
    operator: string | null;
    status: string;
  }>) ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Cycles in progress" value={Number(d?.cyclesInProgress ?? 0)} />
        <Kpi label="Cycles completed" value={Number(d?.cyclesCompleted ?? 0)} />
        <Kpi
          label="Quantity sterilized"
          value={Number(d?.quantitySterilized ?? 0).toLocaleString()}
        />
      </div>
      <ChartCard
        title="ETO cartridge lots by status"
        data={cartridgeUsage}
        dataKey="count"
        nameKey="name"
      />
      <div className="table-scroll rounded-xl border border-line bg-white/80 shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-brand-50/80 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Cartridge</th>
              <th className="px-4 py-3">Machine</th>
              <th className="px-4 py-3">Operator</th>
            </tr>
          </thead>
          <tbody>
            {cycles.map((c) => (
              <tr key={c.id} className="border-t border-line/70">
                <td className="px-4 py-2">
                  <Link to={`/batches/${c.id}`} className="text-brand-900 hover:underline">
                    {c.batchNo}
                  </Link>
                </td>
                <td className="px-4 py-2">{c.quantity?.toLocaleString() ?? '—'}</td>
                <td className="px-4 py-2">{c.cartridgeBatchNo ?? '—'}</td>
                <td className="px-4 py-2">{c.machineId ?? '—'}</td>
                <td className="px-4 py-2">{c.operator ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InventoryPanel() {
  const report = useQuery({
    queryKey: ['report', 'inventory'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Record<string, unknown>>>('/reports/inventory');
      return data.data;
    },
  });
  const d = report.data;
  const byStatus = (
    (d?.byStatus as Array<{ status: string; lots: number; available: number }>) ?? []
  ).map((r) => ({ name: r.status, available: r.available, lots: r.lots }));
  const items = (d?.items as Array<{
    _id: string;
    batchId: string;
    batchNo: string;
    productName: string;
    quantityAvailable: number;
    quantityDispatched: number;
    status: string;
    expiryDate: string;
  }>) ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Available quantity"
          value={Number(d?.availableQuantity ?? 0).toLocaleString()}
        />
        <Kpi
          label="Dispatched quantity"
          value={Number(d?.dispatchedQuantity ?? 0).toLocaleString()}
        />
        <Kpi label="Released batches" value={Number(d?.releasedBatches ?? 0)} />
        <Kpi label="Dispatched batches" value={Number(d?.dispatchedBatches ?? 0)} />
      </div>
      <ChartCard
        title="Finished goods available by status"
        data={byStatus}
        dataKey="available"
        nameKey="name"
      />
      <div className="table-scroll rounded-xl border border-line bg-white/80 shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-brand-50/80 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Available</th>
              <th className="px-4 py-3">Dispatched</th>
              <th className="px-4 py-3">Expiry</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item._id} className="border-t border-line/70">
                <td className="px-4 py-2">
                  <Link
                    to={`/batches/${item.batchId}`}
                    className="text-brand-900 hover:underline"
                  >
                    {item.batchNo}
                  </Link>
                  <div className="text-xs text-muted">{item.productName}</div>
                </td>
                <td className="px-4 py-2">{item.quantityAvailable.toLocaleString()}</td>
                <td className="px-4 py-2">{item.quantityDispatched.toLocaleString()}</td>
                <td className="px-4 py-2 text-muted">{formatDate(item.expiryDate)}</td>
                <td className="px-4 py-2">{item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DispatchPanel() {
  const report = useQuery({
    queryKey: ['report', 'dispatch'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Record<string, unknown>>>('/reports/dispatch');
      return data.data;
    },
  });
  const d = report.data;
  const byCustomer = (
    (d?.byCustomer as Array<{ customer: string; quantity: number }>) ?? []
  ).map((r) => ({ name: r.customer, quantity: r.quantity }));
  const byDate = ((d?.byDate as Array<{ date: string; quantity: number }>) ?? []).map((r) => ({
    name: r.date,
    quantity: r.quantity,
  }));
  const recent = (d?.recent as Array<{
    _id: string;
    batchNo: string;
    customerName: string;
    billNo: string;
    quantity: number;
    dispatchDate: string;
  }>) ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Kpi label="Confirmed dispatches" value={Number(d?.confirmedDispatches ?? 0)} />
        <Kpi
          label="Quantity dispatched"
          value={Number(d?.quantityDispatched ?? 0).toLocaleString()}
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Customer-wise quantity"
          data={byCustomer}
          dataKey="quantity"
          nameKey="name"
        />
        <ChartCard title="Date-wise quantity" data={byDate} dataKey="quantity" nameKey="name" />
      </div>
      <div className="table-scroll rounded-xl border border-line bg-white/80 shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-brand-50/80 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Bill</th>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r._id} className="border-t border-line/70">
                <td className="px-4 py-2 font-medium">{r.billNo}</td>
                <td className="px-4 py-2">{r.batchNo}</td>
                <td className="px-4 py-2">{r.customerName}</td>
                <td className="px-4 py-2">{r.quantity.toLocaleString()}</td>
                <td className="px-4 py-2 text-muted">{formatDate(r.dispatchDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('production');
  const [exporting, setExporting] = useState(false);

  async function exportCsv() {
    setExporting(true);
    try {
      const { data } = await api.get(`/reports/${tab}`, {
        params: { format: 'csv' },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tab}-report.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-brand-950 sm:text-2xl">Reports</h1>
          <p className="mt-1 text-sm text-muted">
            Production, QC, sterilization, inventory, and dispatch analytics
          </p>
        </div>
        <button
          type="button"
          onClick={() => void exportCsv()}
          disabled={exporting}
          className="rounded-md border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-brand-50 disabled:opacity-60"
        >
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      <div className="-mx-1 overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2 px-1 sm:min-w-0 sm:flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-md px-3 py-2 text-sm sm:py-1.5 ${
                tab === t.id
                  ? 'bg-brand-900 text-white'
                  : 'border border-line bg-white text-ink hover:bg-brand-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'production' && <ProductionPanel />}
      {tab === 'qc' && <QcPanel />}
      {tab === 'sterilization' && <SterilizationPanel />}
      {tab === 'inventory' && <InventoryPanel />}
      {tab === 'dispatch' && <DispatchPanel />}
    </div>
  );
}
