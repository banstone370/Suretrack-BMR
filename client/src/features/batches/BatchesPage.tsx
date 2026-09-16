import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BatchStatusBadge } from '../../components/batch/BatchStatusBadge';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import type { ApiResponse, BatchListItem } from '../../types';

export function BatchesPage() {
  const [batchNo, setBatchNo] = useState('');
  const [status, setStatus] = useState('');

  const batches = useQuery({
    queryKey: ['batches', batchNo, status],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<BatchListItem[]>>('/batches', {
        params: {
          batchNo: batchNo || undefined,
          status: status || undefined,
        },
      });
      return data;
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-brand-950 sm:text-2xl">Batches</h1>
          <p className="mt-1 text-sm text-muted">All manufacturing batch records</p>
        </div>
        <Link
          to="/batches/create"
          className="inline-flex w-full items-center justify-center rounded-md bg-brand-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800 sm:w-auto sm:py-2"
        >
          Create Batch
        </Link>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-line bg-white/80 p-4 sm:flex-row sm:flex-wrap">
        <input
          value={batchNo}
          onChange={(e) => setBatchNo(e.target.value)}
          placeholder="Batch number"
          className="w-full min-w-0 rounded-md border border-line px-3 py-2 text-sm outline-none ring-brand-800 focus:ring-2 sm:w-48"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full min-w-0 rounded-md border border-line px-3 py-2 text-sm outline-none ring-brand-800 focus:ring-2 sm:w-56"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="RAW_MATERIAL_QC">Raw Material QC</option>
          <option value="MANUFACTURING">Manufacturing</option>
          <option value="STERILIZATION">Sterilization</option>
          <option value="QA_REVIEW">QA Review</option>
          <option value="FINISHED_GOODS">Finished Goods</option>
          <option value="DISPATCHED">Dispatched</option>
        </select>
      </div>

      <div className="table-scroll rounded-xl border border-line bg-white/80 shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-brand-50/80 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Batch No.</th>
              <th className="px-5 py-3 font-medium">Product</th>
              <th className="px-5 py-3 font-medium">Catalogue</th>
              <th className="px-5 py-3 font-medium">Size</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Progress</th>
              <th className="px-5 py-3 font-medium">Mfg Date</th>
            </tr>
          </thead>
          <tbody>
            {(batches.data?.data ?? []).map((batch) => (
              <tr key={batch.id} className="border-t border-line/70 hover:bg-brand-50/40">
                <td className="px-5 py-3">
                  <Link
                    to={`/batches/${batch.id}`}
                    className="font-medium text-brand-900 hover:underline"
                  >
                    {batch.batchNo}
                  </Link>
                </td>
                <td className="px-5 py-3">{batch.productName}</td>
                <td className="px-5 py-3 text-muted">{batch.catalogueNo}</td>
                <td className="px-5 py-3">{batch.batchSize.toLocaleString()}</td>
                <td className="px-5 py-3">
                  <BatchStatusBadge status={batch.status} />
                </td>
                <td className="px-5 py-3 text-muted">{batch.progressPercent}%</td>
                <td className="px-5 py-3 text-muted">{formatDate(batch.manufacturingDate)}</td>
              </tr>
            ))}
            {batches.isSuccess && (batches.data?.data?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-muted">
                  No batches match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
