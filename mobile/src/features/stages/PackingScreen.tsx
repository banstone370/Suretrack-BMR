import React, { useEffect } from 'react';
import StageFrame, { type StageCtx } from '../../components/StageFrame';
import { Card, Field, InfoTile, SectionTitle } from '../../components/ui';
import { DateField } from '../../components/DateTimeField';
import { STAGE_DEFS } from '../../lib/stageDefs';
import { num, todayISO } from '../../lib/format';

export default function PackingScreen({ batchId }: { batchId: string }) {
  return (
    <StageFrame batchId={batchId} def={STAGE_DEFS.packing}>
      {(ctx) => <Form ctx={ctx} />}
    </StageFrame>
  );
}

function Form({ ctx }: { ctx: StageCtx }) {
  const d = ctx.data;
  const set = ctx.setForm;
  const pouchesTaken = String(d.pouchesTaken ?? '');
  const pouchesDamaged = String(d.pouchesDamaged ?? '');
  const devicesPacked = String(d.devicesPacked ?? '');
  const packingDate = String(d.packingDate ?? '');
  const remarks = String(d.remarks ?? '');

  const good = num(pouchesTaken) - num(pouchesDamaged);

  useEffect(() => {
    ctx.registerValidate(() => {
      if (num(pouchesTaken) < 0) return 'Pouches taken must be ≥ 0.';
      if (num(pouchesDamaged) < 0) return 'Pouches damaged must be ≥ 0.';
      if (num(devicesPacked) < 0) return 'Devices packed must be ≥ 0.';
      if (num(pouchesDamaged) > num(pouchesTaken)) return 'Damaged pouches cannot exceed pouches taken.';
      if (!packingDate) return 'Packing date is required.';
      return null;
    });
  });

  return (
    <Card>
      <SectionTitle>Packing</SectionTitle>
      <Field label="Pouches Taken" value={pouchesTaken} onChangeText={(v) => set({ pouchesTaken: v })} keyboardType="numeric" editable={ctx.editable} />
      <Field label="Pouches Damaged" value={pouchesDamaged} onChangeText={(v) => set({ pouchesDamaged: v })} keyboardType="numeric" editable={ctx.editable} />
      <InfoTile label="Good Pouches" value={String(good)} />
      <Field label="Devices Packed" value={devicesPacked} onChangeText={(v) => set({ devicesPacked: v })} keyboardType="numeric" editable={ctx.editable} />
      <DateField label="Packing Date" value={packingDate || todayISO()} onChange={(v) => set({ packingDate: v })} disabled={!ctx.editable} />
      <Field label="Remarks" value={remarks} onChangeText={(v) => set({ remarks: v })} multiline editable={ctx.editable} />
    </Card>
  );
}
