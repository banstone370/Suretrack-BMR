import React, { useEffect } from 'react';
import { View } from 'react-native';
import StageFrame, { type StageCtx } from '../../components/StageFrame';
import { Card, Field, InfoTile, NoticeBanner, SectionTitle } from '../../components/ui';
import { DateField, TimeField } from '../../components/DateTimeField';
import { STAGE_DEFS } from '../../lib/stageDefs';
import { num, todayISO } from '../../lib/format';

export default function SealingScreen({ batchId }: { batchId: string }) {
  return (
    <StageFrame batchId={batchId} def={STAGE_DEFS.sealing}>
      {(ctx) => <Form ctx={ctx} />}
    </StageFrame>
  );
}

function Form({ ctx }: { ctx: StageCtx }) {
  const d = ctx.data;
  const set = ctx.setForm;
  const snap = ctx.stage.processParamsSnapshot;
  const configured = num(snap?.sealingParams?.temperatureC ?? 200);
  const sopRef = snap?.sealingParams?.sopRef ?? 'SOP/MF/011';

  const actual = d.actualTemperatureC != null ? String(d.actualTemperatureC) : '';
  const devicesSealed = String(d.devicesSealed ?? '');
  const sealingDate = String(d.sealingDate ?? '');
  const startTime = String(d.startTime ?? '');
  const endTime = String(d.endTime ?? '');
  const allowedRange = snap?.sealingParams?.allowedRange;

  useEffect(() => {
    ctx.registerValidate(() => {
      if (d.actualTemperatureC == null || actual === '') return 'Actual sealing temperature is required.';
      if (num(devicesSealed) < 0) return 'Devices sealed must be ≥ 0.';
      if (!sealingDate) return 'Sealing date is required.';
      if (!startTime) return 'Start time is required.';
      if (!endTime) return 'End time is required.';
      return null;
    });
  });

  return (
    <Card>
      <SectionTitle>Sealing</SectionTitle>
      <View style={{ flexDirection: 'row' }}>
        <InfoTile label="Configured Temp (SOP)" value={`${configured}°C`} />
        <InfoTile label="SOP Reference" value={sopRef} />
      </View>
      {allowedRange ? (
        <NoticeBanner message={`Allowed range: ${allowedRange.min}–${allowedRange.max}°C`} tone="info" />
      ) : null}
      <Field
        label="Actual Temperature (°C)"
        value={actual || String(configured)}
        onChangeText={(v) => set({ actualTemperatureC: v === '' ? null : num(v) })}
        keyboardType="numeric"
        editable={ctx.editable}
      />
      <Field label="Devices Sealed" value={devicesSealed} onChangeText={(v) => set({ devicesSealed: num(v) })} keyboardType="numeric" editable={ctx.editable} />
      <DateField label="Sealing Date" value={sealingDate || todayISO()} onChange={(v) => set({ sealingDate: v })} disabled={!ctx.editable} />
      <TimeField label="Start Time" value={startTime} onChange={(v) => set({ startTime: v })} disabled={!ctx.editable} />
      <TimeField label="End Time" value={endTime} onChange={(v) => set({ endTime: v })} disabled={!ctx.editable} />
    </Card>
  );
}
