import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import StageFrame, { type StageCtx } from '../../components/StageFrame';
import { Card, Field, InfoTile, NoticeBanner, SectionTitle, SelectField } from '../../components/ui';
import { DateField, TimeField } from '../../components/DateTimeField';
import { STAGE_DEFS } from '../../lib/stageDefs';
import { api, unwrap } from '../../lib/api';
import { num, todayISO } from '../../lib/format';
import type { ApiResponse } from '../../types';

interface Cartridge {
  _id: string;
  cartridgeBatchNo: string;
  quantityRemainingGrams: number;
  expiryDate: string;
}

export default function SterilizationScreen({ batchId }: { batchId: string }) {
  return (
    <StageFrame batchId={batchId} def={STAGE_DEFS.sterilization}>
      {(ctx) => <Form ctx={ctx} />}
    </StageFrame>
  );
}

function Form({ ctx }: { ctx: StageCtx }) {
  const d = ctx.data;
  const set = ctx.setForm;
  const snap = ctx.stage.processParamsSnapshot?.sterilizationParams;
  const configured = {
    temperatureC: num(snap?.temperatureC ?? 55),
    durationHours: num(snap?.durationHours ?? 4),
    grams: num(snap?.etoCartridgeGrams ?? 40),
    sopRef: snap?.sopRef ?? 'SOP/MF/008',
  };

  const cartridges = useQuery({
    queryKey: ['eto-cartridges', 'AVAILABLE'],
    queryFn: async () =>
      unwrap(
        await api.get<ApiResponse<Cartridge[]>>('/eto-cartridges', {
          params: { status: 'AVAILABLE' },
        }),
      ),
    enabled: ctx.editable,
  });

  const quantity = String(d.quantity ?? '');
  const startDate = String(d.startDate ?? '');
  const startTime = String(d.startTime ?? '');
  const endDate = String(d.endDate ?? '');
  const endTime = String(d.endTime ?? '');
  const machineId = String(d.machineId ?? '');
  const etoCartridgeId = String(d.etoCartridgeId ?? '');
  const cartridgeBatchNo = String(d.cartridgeBatchNo ?? '');
  const remarks = String(d.remarks ?? '');
  const cycleStatus = String(d.cycleStatus ?? 'NOT_STARTED');

  const expectedEnd = useMemoExpectedEnd(startDate, startTime, configured.durationHours);

  useEffect(() => {
    ctx.registerValidate(() => {
      if (num(quantity) <= 0) return 'Quantity must be greater than 0.';
      if (!startDate) return 'Start date is required.';
      if (!startTime) return 'Start time is required.';
      if (!endDate) return 'End date is required.';
      if (!endTime) return 'End time is required.';
      if (!machineId.trim()) return 'Machine ID is required.';
      if (!etoCartridgeId && !cartridgeBatchNo) return 'Select an ETO cartridge.';
      return null;
    });
  });

  return (
    <Card>
      <SectionTitle>ETO Sterilization</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 0 }}>
        <InfoTile label="Temperature" value={`${configured.temperatureC}°C`} />
        <InfoTile label="Required Duration" value={`${configured.durationHours} h`} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <InfoTile label="ETO Cartridge" value={`${configured.grams} g`} />
        <InfoTile label="SOP" value={configured.sopRef} />
      </View>
      <NoticeBanner message={`Cycle status: ${cycleStatus.replace(/_/g, ' ')}`} tone="info" />
      <Field label="Quantity" value={quantity} onChangeText={(v) => set({ quantity: num(v) })} keyboardType="numeric" editable={ctx.editable} />
      <Field label="Machine ID" value={machineId} onChangeText={(v) => set({ machineId: v })} editable={ctx.editable} />
      <SelectField
        label="ETO Cartridge"
        value={etoCartridgeId}
        disabled={!ctx.editable}
        onChange={(v) => {
          const c = (cartridges.data ?? []).find((x) => x._id === v);
          set({ etoCartridgeId: v, cartridgeBatchNo: c?.cartridgeBatchNo ?? '' });
        }}
        options={(cartridges.data ?? []).map((c) => ({
          value: c._id,
          label: `${c.cartridgeBatchNo} · ${c.quantityRemainingGrams}g rem · exp ${String(c.expiryDate).slice(0, 10)}`,
        }))}
      />
      <DateField label="Start Date" value={startDate || todayISO()} onChange={(v) => set({ startDate: v })} disabled={!ctx.editable} />
      <TimeField label="Start Time" value={startTime} onChange={(v) => set({ startTime: v })} disabled={!ctx.editable} />
      <InfoTile label="Expected End" value={expectedEnd} />
      <DateField label="End Date" value={endDate} onChange={(v) => set({ endDate: v })} disabled={!ctx.editable} />
      <TimeField label="End Time" value={endTime} onChange={(v) => set({ endTime: v })} disabled={!ctx.editable} />
      <Field label="Remarks" value={remarks} onChangeText={(v) => set({ remarks: v })} multiline editable={ctx.editable} />
    </Card>
  );
}

function useMemoExpectedEnd(startDate: string, startTime: string, hours: number): string {
  if (!startDate || !startTime) return '—';
  const d = new Date(`${startDate}T${startTime}:00`);
  if (Number.isNaN(d.getTime())) return '—';
  d.setHours(d.getHours() + hours);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd} ${hh}:${mi}`;
}
