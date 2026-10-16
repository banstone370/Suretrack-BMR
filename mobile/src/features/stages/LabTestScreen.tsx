import React, { useEffect } from 'react';
import StageFrame, { type StageCtx } from '../../components/StageFrame';
import { Card, Field, NoticeBanner, SectionTitle, SelectField } from '../../components/ui';
import { DateField, TimeField } from '../../components/DateTimeField';
import { STAGE_DEFS, type RouteSlug } from '../../lib/stageDefs';
import AttachmentPanel from '../../components/AttachmentPanel';
import { useAuth } from '../../state/AuthContext';

export default function LabTestScreen({ batchId, kind }: { batchId: string; kind: 'sterility' | 'bet' }) {
  const def = STAGE_DEFS[kind as RouteSlug];
  return (
    <StageFrame batchId={batchId} def={def}>
      {(ctx) => <Form ctx={ctx} batchId={batchId} kind={kind} />}
    </StageFrame>
  );
}

function Form({ ctx, batchId, kind }: { ctx: StageCtx; batchId: string; kind: 'sterility' | 'bet' }) {
  const { hasPermission } = useAuth();
  const d = ctx.data;
  const set = ctx.setForm;
  const snap = ctx.stage.processParamsSnapshot;
  const sopRef = String(
    d.sopRef ?? (kind === 'sterility' ? snap?.sterilitySop ?? 'SOP/QC/004' : snap?.betSop ?? 'SOP/QC/005'),
  );

  const testDate = String(d.testDate ?? d.doneOn ?? '');
  const reportNo = String(d.reportNo ?? '');
  const result = String(d.result === 'PENDING' ? '' : d.result ?? '');
  const reportingDate = String(d.reportingDate ?? '');
  const startTime = String(d.startTime ?? '');
  const endTime = String(d.endTime ?? '');

  const failing = result === 'FAIL';

  useEffect(() => {
    ctx.registerValidate(() => {
      if (!testDate) return 'Test date is required.';
      if (!reportNo.trim()) return 'Report No. is required.';
      if (result !== 'PASS' && result !== 'FAIL') return 'Result must be PASS or FAIL.';
      if (!reportingDate) return 'Reporting date is required.';
      if (!startTime) return 'Start time is required.';
      if (!endTime) return 'End time is required.';
      return null;
    });
    ctx.setSubmitOpts(
      failing
        ? {
            confirmLabel: 'Submit Fail',
            requireReason: true,
            reasonLabel: 'Failure Reason',
            message: 'Submitting a FAIL result rejects the batch. A reason is required.',
          }
        : null,
    );
  });

  return (
    <>
      <Card>
        <SectionTitle>{STAGE_DEFS[kind as RouteSlug].label}</SectionTitle>
        <NoticeBanner message={`SOP: ${sopRef}`} tone="info" />
        {failing ? (
          <NoticeBanner message="Result is FAIL — submitting will reject the batch and a failure reason is required." tone="warning" />
        ) : null}
        <DateField label="Test Date" value={testDate} onChange={(v) => set({ testDate: v })} disabled={!ctx.editable} />
        <Field label="Report No." value={reportNo} onChangeText={(v) => set({ reportNo: v })} placeholder="e.g. STR-260914-01" editable={ctx.editable} />
        <SelectField
          label="Result"
          value={result}
          onChange={(v) => set({ result: v })}
          disabled={!ctx.editable}
          options={[
            { value: 'PASS', label: 'PASS' },
            { value: 'FAIL', label: 'FAIL' },
          ]}
        />
        <DateField label="Reporting Date" value={reportingDate} onChange={(v) => set({ reportingDate: v })} disabled={!ctx.editable} />
        <TimeField label="Start Time" value={startTime} onChange={(v) => set({ startTime: v })} disabled={!ctx.editable} />
        <TimeField label="End Time" value={endTime} onChange={(v) => set({ endTime: v })} disabled={!ctx.editable} />
      </Card>
      <Card>
        <AttachmentPanel
          batchId={batchId}
          stageSlug={STAGE_DEFS[kind as RouteSlug].apiSlug}
          canUpload={ctx.editable || hasPermission('batches:view_all')}
        />
      </Card>
    </>
  );
}
