import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import StageFrame, { type StageCtx } from '../../components/StageFrame';
import { Card, Field, SectionTitle } from '../../components/ui';
import { DateField, TimeField } from '../../components/DateTimeField';
import { STAGE_DEFS } from '../../lib/stageDefs';
import { todayISO } from '../../lib/format';
import { colors, radius } from '../../lib/theme';

type StepRow = Record<string, unknown>;

function asText(v: unknown): string {
  return v == null ? '' : String(v);
}

function asDate(v: unknown): string {
  return v ? String(v).slice(0, 10) : '';
}

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
  const process = asText(d.process ?? 'The needles are made Ready for Sterilization.');
  const processDate = asText(d.processDate);
  const startTime = asText(d.startTime);
  const endTime = asText(d.endTime);
  const remarks = asText(d.remarks);
  const status = asText(d.status ?? 'NOT_STARTED');
  /** Product-centric (v2) batches record a date/time per template step. */
  const steps: StepRow[] | null = Array.isArray(d.steps) ? (d.steps as StepRow[]) : null;

  function updateStep(index: number, patch: StepRow) {
    if (!steps) return;
    set({ steps: steps.map((s, i) => (i === index ? { ...s, ...patch } : s)) });
  }

  useEffect(() => {
    ctx.registerValidate(() => {
      if (steps) {
        if (steps.length === 0) return 'No manufacturing steps found in this product template.';
        for (const s of steps) {
          const label = asText(s.step);
          if (!asDate(s.processDate)) return `Process date is required for step: ${label}`;
          if (!asText(s.startTime)) return `Start time is required for step: ${label}`;
          if (!asText(s.endTime)) return `End time is required for step: ${label}`;
        }
        return null;
      }
      if (!processDate) return 'Process date is required.';
      if (!startTime) return 'Start time is required.';
      if (!endTime) return 'End time is required.';
      return null;
    });
  });

  if (steps) {
    return (
      <Card>
        <SectionTitle>Manufacturing steps</SectionTitle>
        <Text style={styles.hint}>
          Steps come from this product&apos;s BMR template. Record the date and start/end time for
          each step — they are printed on the batch record.
        </Text>
        {steps.map((s, i) => (
          <View key={`${asText(s.step)}-${i}`} style={styles.stepBox}>
            <Text style={styles.stepTitle}>
              {i + 1}. {asText(s.step)}
            </Text>
            <DateField
              label="Date"
              value={asDate(s.processDate)}
              onChange={(v) => updateStep(i, { processDate: v })}
              disabled={!ctx.editable}
            />
            <TimeField
              label="Start time"
              value={asText(s.startTime)}
              onChange={(v) => updateStep(i, { startTime: v })}
              disabled={!ctx.editable}
            />
            <TimeField
              label="End time"
              value={asText(s.endTime)}
              onChange={(v) => updateStep(i, { endTime: v })}
              disabled={!ctx.editable}
            />
          </View>
        ))}
        <Field
          label="Remarks"
          value={remarks}
          onChangeText={(v) => set({ remarks: v })}
          multiline
          editable={ctx.editable}
        />
        <Field label="Status (read-only)" value={status.replace(/_/g, ' ')} onChangeText={undefined} editable={false} />
      </Card>
    );
  }

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

const styles = StyleSheet.create({
  hint: { color: colors.muted, fontSize: 13, marginBottom: 12 },
  stepBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    backgroundColor: colors.greyLight,
    padding: 12,
    marginBottom: 12,
  },
  stepTitle: { fontWeight: '700', color: colors.text, fontSize: 14, marginBottom: 8 },
});
