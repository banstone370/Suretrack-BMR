import React, { useEffect } from 'react';
import StageFrame, { type StageCtx } from '../../components/StageFrame';
import { Card, Field, InfoTile, SectionTitle } from '../../components/ui';
import { DateField, TimeField } from '../../components/DateTimeField';
import { STAGE_DEFS } from '../../lib/stageDefs';
import { num } from '../../lib/format';

export default function VisualInspectionScreen({ batchId }: { batchId: string }) {
  return (
    <StageFrame batchId={batchId} def={STAGE_DEFS.inspection}>
      {(ctx) => <Form ctx={ctx} />}
    </StageFrame>
  );
}

function Form({ ctx }: { ctx: StageCtx }) {
  const d = ctx.data;
  const set = ctx.setForm;
  const unitsChecked = String(d.unitsChecked ?? '');
  const particlesFound = String(d.particlesFound ?? '');
  const inspectionDate = String(d.inspectionDate ?? '');
  const startTime = String(d.startTime ?? '');
  const endTime = String(d.endTime ?? '');

  const percent = useMemoPercent(num(unitsChecked), num(particlesFound));

  useEffect(() => {
    ctx.registerValidate(() => {
      const u = num(unitsChecked);
      const p = num(particlesFound);
      if (!Number.isInteger(u) || u < 0) return 'Units checked must be an integer ≥ 0.';
      if (!Number.isInteger(p) || p < 0) return 'Particles found must be an integer ≥ 0.';
      if (p > u) return 'Particles found cannot exceed units checked.';
      if (!inspectionDate) return 'Inspection date is required.';
      return null;
    });
  });

  return (
    <Card>
      <SectionTitle>Visual Inspection</SectionTitle>
      <Field label="Units Checked" value={unitsChecked} onChangeText={(v) => set({ unitsChecked: v })} keyboardType="numeric" editable={ctx.editable} />
      <Field label="Particles Found" value={particlesFound} onChangeText={(v) => set({ particlesFound: v })} keyboardType="numeric" editable={ctx.editable} />
      <InfoTile label="Particles found %" value={String(percent)} />
      <DateField label="Inspection Date" value={inspectionDate} onChange={(v) => set({ inspectionDate: v })} disabled={!ctx.editable} />
      <TimeField label="Start Time" value={startTime} onChange={(v) => set({ startTime: v })} disabled={!ctx.editable} />
      <TimeField label="End Time" value={endTime} onChange={(v) => set({ endTime: v })} disabled={!ctx.editable} />
    </Card>
  );
}

function useMemoPercent(units: number, particles: number): number {
  if (units <= 0) return 0;
  return Math.round((particles / units) * 10000) / 100;
}
