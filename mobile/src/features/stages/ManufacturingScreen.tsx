import React, { useEffect } from 'react';
import StageFrame, { type StageCtx } from '../../components/StageFrame';
import { Card, Field, SectionTitle } from '../../components/ui';
import { DateField, TimeField } from '../../components/DateTimeField';
import { STAGE_DEFS } from '../../lib/stageDefs';
import { todayISO } from '../../lib/format';

export default function ManufacturingScreen({ batchId }: { batchId: string }) {
  const def = STAGE_DEFS.manufacturing;
  return (
    <StageFrame batchId={batchId} def={def}>
      {(ctx) => <Form ctx={ctx} />}
    </StageFrame>
  );
}

function Form({ ctx }: { ctx: StageCtx }) {
  const d = ctx.data;
  const set = ctx.setForm;
  const process = String(d.process ?? 'The needles are made Ready for Sterilization.');
  const processDate = String(d.processDate ?? '');
  const startTime = String(d.startTime ?? '');
  const endTime = String(d.endTime ?? '');
  const remarks = String(d.remarks ?? '');
  const status = String(d.status ?? 'NOT_STARTED');

  useEffect(() => {
    ctx.registerValidate(() => {
      if (!processDate) return 'Process date is required.';
      if (!startTime) return 'Start time is required.';
      if (!endTime) return 'End time is required.';
      return null;
    });
  });

  return (
    <Card>
      <SectionTitle>Process</SectionTitle>
      <Field label="Process description" value={process} onChangeText={(v) => set({ process: v })} multiline editable={ctx.editable} />
      <DateField label="Process Date" value={processDate || todayISO()} onChange={(v) => set({ processDate: v })} disabled={!ctx.editable} />
      <TimeField label="Start Time" value={startTime} onChange={(v) => set({ startTime: v })} disabled={!ctx.editable} />
      <TimeField label="End Time" value={endTime} onChange={(v) => set({ endTime: v })} disabled={!ctx.editable} />
      <Field label="Remarks" value={remarks} onChangeText={(v) => set({ remarks: v })} multiline editable={ctx.editable} />
      <Field label="Status (read-only)" value={status.replace(/_/g, ' ')} onChangeText={undefined} editable={false} />
    </Card>
  );
}
