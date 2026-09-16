import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import type { ApiResponse } from '../../types';

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

export function InventoryPage() {
  const list = useQuery({
    queryKey: ['inventory-fg'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<FgRow[]>>('/inventory/finished-goods');
      return data.data;
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold text-brand-950">Finished Goods</h1>
        <p className="mt-1 text-sm text-muted">Released inventory available for dispatch</p>
      </div>

      <div className="table-scroll rounded-xl border border-line bg-white/80 shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-brand-50/80 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Batch No.</th>
              <th className="px-5 py-3 font-medium">Product</th>
              <th className="px-5 py-3 font-medium">Available</th>
              <th className="px-5 py-3 font-medium">Dispatched</th>
              <th className="px-5 py-3 font-medium">Received</th>
              <th className="px-5 py-3 font-medium">Expiry</th>
              <th className="px-5 py-3 font-medium">Storage</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((row) => (
              <tr key={row._id} className="border-t border-line/70 hover:bg-brand-50/40">
                <td className="px-5 py-3">
                  <Link
                    to={`/batches/${row.batchId}`}
                    className="font-medium text-brand-900 hover:underline"
                  >
                    {row.batchNo}
                  </Link>
                </td>
                <td className="px-5 py-3">{row.productName}</td>
                <td className="px-5 py-3">{row.quantityAvailable.toLocaleString()}</td>
                <td className="px-5 py-3 text-muted">
                  {row.quantityDispatched.toLocaleString()}
                </td>
                <td className="px-5 py-3 text-muted">{formatDate(row.receivedOn)}</td>
                <td className="px-5 py-3 text-muted">{formatDate(row.expiryDate)}</td>
                <td className="px-5 py-3 text-muted">{row.storageCondition}</td>
                <td className="px-5 py-3">{row.status}</td>
              </tr>
            ))}
            {list.isSuccess && (list.data?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-muted">
                  No finished goods yet. Complete QA release and FG transfer on a batch.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
