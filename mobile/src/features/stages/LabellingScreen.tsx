import React, { useEffect } from 'react';
import StageFrame, { type StageCtx } from '../../components/StageFrame';
import { Card, Field, NoticeBanner, SectionTitle } from '../../components/ui';
import { DateField } from '../../components/DateTimeField';
import { STAGE_DEFS } from '../../lib/stageDefs';
import { num, todayISO } from '../../lib/format';

export default function LabellingScreen({ batchId }: { batchId: string }) {
  return (
    <StageFrame batchId={batchId} def={STAGE_DEFS.labelling}>
      {(ctx) => <Form ctx={ctx} />}
    </StageFrame>
  );
}

function Form({ ctx }: { ctx: StageCtx }) {
  const d = ctx.data;
  const set = ctx.setForm;
  const labelsPrinted = String(d.labelsPrinted ?? '');
  const labelsUsed = String(d.labelsUsed ?? '');
  const labelsDestroyed = String(d.labelsDestroyed ?? '');
  const devicesLabelled = String(d.devicesLabelled ?? '');
  const overrideReason = String(d.overrideReason ?? '');
  const doneOn = String(d.doneOn ?? '');

  const needsOverride = num(labelsUsed) > num(labelsPrinted);

  useEffect(() => {
    ctx.registerValidate(() => {
      if (num(labelsPrinted) < 0) return 'Labels printed must be ≥ 0.';
      if (num(labelsUsed) < 0) return 'Labels used must be ≥ 0.';
      if (num(labelsDestroyed) < 0) return 'Labels destroyed must be ≥ 0.';
      if (num(devicesLabelled) < 0) return 'Devices labelled must be ≥ 0.';
      if (needsOverride && !overrideReason.trim())
        return 'Override reason is required when labels used exceed labels printed.';
      if (!doneOn) return 'Done-on date is required.';
      return null;
    });
  });

  return (
    <Card>
      <SectionTitle>Batch Labelling</SectionTitle>
      <Field label="Labels Printed" value={labelsPrinted} onChangeText={(v) => set({ labelsPrinted: num(v) })} keyboardType="numeric" editable={ctx.editable} />
      <Field label="Labels Used" value={labelsUsed} onChangeText={(v) => set({ labelsUsed: num(v) })} keyboardType="numeric" editable={ctx.editable} />
      <Field label="Labels Destroyed" value={labelsDestroyed} onChangeText={(v) => set({ labelsDestroyed: num(v) })} keyboardType="numeric" editable={ctx.editable} />
      <Field label="Devices Labelled" value={devicesLabelled} onChangeText={(v) => set({ devicesLabelled: num(v) })} keyboardType="numeric" editable={ctx.editable} />
      {needsOverride ? (
        <>
          <NoticeBanner message="Labels used exceed labels printed — an override reason is required." tone="warning" />
          <Field label="Override Reason" value={overrideReason} onChangeText={(v) => set({ overrideReason: v })} multiline editable={ctx.editable} />
        </>
      ) : null}
      <DateField label="Done On" value={doneOn || todayISO()} onChange={(v) => set({ doneOn: v })} disabled={!ctx.editable} />
    </Card>
  );
}
