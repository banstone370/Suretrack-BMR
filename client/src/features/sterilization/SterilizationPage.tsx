import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { StageShell } from '../../components/batch/StageShell';
import { ElectronicSignature } from '../../components/forms/ElectronicSignature';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { useStage } from '../../hooks/useStage';
import type { ApiResponse } from '../../types';

interface Cartridge {
  _id: string;
  cartridgeBatchNo: string;
  manufacturer: string;
  expiryDate: string;
  quantityRemainingGrams: number;
  status: string;
}

export function SterilizationPage() {
  const { batchId } = useParams();
  const { hasPermission } = useAuth();
  const stage = useStage(batchId, 'sterilization');
  const [signOpen, setSignOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    quantity: 0,
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    machineId: '',
    etoCartridgeId: '',
    remarks: '',
  });

  const snapshot = stage.query.data?.processParamsSnapshot as {
    sterilizationParams?: {
      temperatureC: number;
      durationHours: number;
      etoCartridgeGrams: number;
      sopRef: string;
    };
  };
  const params = snapshot?.sterilizationParams ?? {
    temperatureC: 55,
    durationHours: 4,
    etoCartridgeGrams: 40,
    sopRef: 'SOP/MF/008',
  };

  const cartridges = useQuery({
    queryKey: ['eto-cartridges', 'AVAILABLE'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Cartridge[]>>('/eto-cartridges', {
        params: { status: 'AVAILABLE' },
      });
      return data.data;
    },
  });

  useEffect(() => {
    const data = stage.query.data?.data;
    if (!data) return;
    setForm({
      quantity: Number(data.quantity ?? 0),
      startDate: data.startDate ? String(data.startDate).slice(0, 10) : '',
      startTime: String(data.startTime ?? ''),
      endDate: data.endDate ? String(data.endDate).slice(0, 10) : '',
      endTime: String(data.endTime ?? ''),
      machineId: String(data.machineId ?? ''),
      etoCartridgeId: String(data.etoCartridgeId ?? ''),
      remarks: String(data.remarks ?? ''),
    });
  }, [stage.query.data]);

  const expectedEnd = useMemo(() => {
    if (!form.startDate || !form.startTime) return null;
    const [hh, mm] = form.startTime.split(':').map(Number);
    const start = new Date(form.startDate);
    start.setHours(hh || 0, mm || 0, 0, 0);
    return new Date(start.getTime() + params.durationHours * 60 * 60 * 1000);
  }, [form.startDate, form.startTime, params.durationHours]);

  const batch = stage.batchQuery.data;
  const locked = ['SUBMITTED', 'APPROVED', 'LOCKED'].includes(
    String(stage.query.data?.data?.lockState ?? ''),
  );
  const canEdit = hasPermission('sterilization:edit') && !locked;

  return (
    <StageShell
      batchId={batchId!}
      batchNo={batch?.batchNo}
      productName={batch?.productName}
      status={batch?.status}
      progressPercent={batch?.progressPercent}
      title="ETO Sterilization"
    >
      <section className="space-y-4 rounded-xl border border-line bg-white/90 p-3 shadow-sm sm:p-5">
        <div className="grid gap-3 rounded-lg bg-brand-50/80 p-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted">Temperature</p>
            <p className="mt-1 font-semibold">{params.temperatureC}°C</p>
          </div>
          <div>
            <p className="text-xs text-muted">Required duration</p>
            <p className="mt-1 font-semibold">{params.durationHours} Hours</p>
          </div>
          <div>
            <p className="text-xs text-muted">ETO cartridge</p>
            <p className="mt-1 font-semibold">{params.etoCartridgeGrams} g · {params.sopRef}</p>
          </div>
        </div>

        {msg && <p className="text-sm text-accent-600">{msg}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Quantity
            <input
              type="number"
              min={0}
              disabled={!canEdit}
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Machine ID
            <input
              disabled={!canEdit}
              value={form.machineId}
              onChange={(e) => setForm((f) => ({ ...f, machineId: e.target.value }))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Start date
            <input
              type="date"
              disabled={!canEdit}
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Start time
            <input
              type="time"
              disabled={!canEdit}
              value={form.startTime}
              onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            End date
            <input
              type="date"
              disabled={!canEdit}
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            End time
            <input
              type="time"
              disabled={!canEdit}
              value={form.endTime}
              onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
        </div>

        {expectedEnd && (
          <div className="rounded-lg border border-line px-4 py-3 text-sm">
            <span className="text-muted">Expected end: </span>
            <span className="font-medium">{expectedEnd.toLocaleString('en-GB')}</span>
          </div>
        )}

        <label className="block text-sm font-medium">
          ETO cartridge
          <select
            disabled={!canEdit}
            value={form.etoCartridgeId}
            onChange={(e) => setForm((f) => ({ ...f, etoCartridgeId: e.target.value }))}
            className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
          >
            <option value="">Select cartridge</option>
            {(cartridges.data ?? []).map((c) => (
              <option key={c._id} value={c._id}>
                {c.cartridgeBatchNo} · {c.quantityRemainingGrams}g rem · exp{' '}
                {formatDate(c.expiryDate)}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium">
          Remarks
          <textarea
            disabled={!canEdit}
            value={form.remarks}
            onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
            className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            rows={3}
          />
        </label>

        {canEdit && (
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-line px-4 py-2 text-sm hover:bg-brand-50"
              onClick={async () => {
                await stage.save.mutateAsync({
                  ...form,
                  configuredTemperatureC: params.temperatureC,
                  requiredDurationHours: params.durationHours,
                  etoCartridgeGrams: params.etoCartridgeGrams,
                  sopRef: params.sopRef,
                });
                setMsg('Sterilization draft saved');
              }}
            >
              Save Draft
            </button>
            <button
              type="button"
              className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white"
              onClick={() => setSignOpen(true)}
            >
              Complete Cycle
            </button>
          </div>
        )}
      </section>

      <ElectronicSignature
        open={signOpen}
        title="Complete ETO Sterilization"
        onClose={() => setSignOpen(false)}
        onConfirm={async ({ password, statement }) => {
          await stage.submit.mutateAsync({
            payload: {
              ...form,
              configuredTemperatureC: params.temperatureC,
              requiredDurationHours: params.durationHours,
              etoCartridgeGrams: params.etoCartridgeGrams,
              sopRef: params.sopRef,
            },
            password,
            statement,
          });
          setMsg('Sterilization complete — moved to Labelling');
        }}
      />
    </StageShell>
  );
}
