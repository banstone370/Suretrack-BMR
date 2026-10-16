import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import StageFrame, { type StageCtx } from '../../components/StageFrame';
import {
  Badge,
  Button,
  Card,
  Field,
  NoticeBanner,
  OBSERVATION_PRESETS,
  SectionTitle,
  SelectField,
} from '../../components/ui';
import { DateField, TimeField } from '../../components/DateTimeField';
import { STAGE_DEFS } from '../../lib/stageDefs';
import type { StageDef } from '../../lib/stageDefs';
import { colors, radius } from '../../lib/theme';
import { num, statusLabel } from '../../lib/format';
import type { BatchStatus } from '../../types';

interface CheckRow {
  process: string;
  processDate?: string;
  startTime?: string;
  endTime?: string;
  observation?: string;
  result?: string | null;
}

interface LineRow {
  rawMaterialName?: string;
  supplierBatchNo?: string;
  quantityWithdrawn?: number | string;
  unit?: string;
  qualityCheckedDate?: string;
  requirementSlipNo?: string;
}

const CONSUMPTION: StageDef = {
  routeSlug: 'raw-material',
  apiSlug: 'raw-material-consumption',
  field: 'rawMaterialConsumption',
  label: 'Raw Material Consumption',
  editPermission: 'rm_consumption:edit',
  editableWhen: ['RAW_MATERIAL_APPROVED', 'MATERIAL_ISSUED'],
  submittableWhen: ['RAW_MATERIAL_APPROVED'],
  submitLabel: 'Submit Issue',
};

export default function RawMaterialScreen({ batchId }: { batchId: string }) {
  const [tab, setTab] = useState<'qc' | 'consumption'>('qc');
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.tabBar}>
        {(['qc', 'consumption'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text style={{ color: tab === t ? colors.primary : colors.muted, fontWeight: '700' }}>
              {t === 'qc' ? 'Quality Check' : 'Consumption'}
            </Text>
          </Pressable>
        ))}
      </View>
      {tab === 'qc' ? (
        <StageFrame key="qc" batchId={batchId} def={STAGE_DEFS['raw-material']}>
          {(ctx) => <QcForm ctx={ctx} />}
        </StageFrame>
      ) : (
        <StageFrame key="consumption" batchId={batchId} def={CONSUMPTION}>
          {(ctx) => <ConsumptionForm ctx={ctx} />}
        </StageFrame>
      )}
    </View>
  );
}

function QcForm({ ctx }: { ctx: StageCtx }) {
  const rows: CheckRow[] = useMemo(() => {
    const seeded = (ctx.stage.processParamsSnapshot?.rmQcChecks ?? []).map((p) => ({
      process: p,
      result: null,
    }));
    const saved = (ctx.data.checks as CheckRow[] | undefined) ?? [];
    const base = saved.length ? saved : seeded;
    return base.length ? base : [{ process: 'Hub checking', result: null }];
  }, [ctx.data.checks, ctx.stage.processParamsSnapshot]);

  const [apply, setApply] = useState({ date: '', start: '', end: '' });
  const [applyHint, setApplyHint] = useState('');

  useEffect(() => {
    ctx.setSubmitOpts(
      rows.length && rows.every((r) => r.result)
        ? null
        : { message: 'Submit for Approval', confirmLabel: 'Submit for Approval' },
    );
    ctx.registerValidate(() => {
      if (!rows.length) return 'At least one QC process row is required.';
      if (rows.some((r) => !r.result)) return 'Every process row needs a result (PASS / FAIL / NA).';
      return null;
    });
  });

  const setRow = (i: number, patch: Partial<CheckRow>) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    ctx.setForm({ checks: next });
  };

  const overall = rows.some((r) => r.result === 'FAIL') ? 'FAIL' : 'PASS';
  const approved = ctx.saved.current.approvedAt != null;
  void approved;

  return (
    <>
      <Card>
        <SectionTitle>Quality Check</SectionTitle>
        <NoticeBanner
          message={`Rows are fixed by the product template. Overall result: ${overall}${overall === 'FAIL' ? ' — approval is blocked; use Reject.' : ''}`}
          tone={overall === 'FAIL' ? 'warning' : 'info'}
        />
        {rows.map((r, i) => {
          const obs = r.observation ?? '';
          const isOther = obs.startsWith('Other:') || (obs !== '' && !OBSERVATION_PRESETS.includes(obs));
          const preset = isOther ? 'Other' : obs || '';
          return (
            <View key={i} style={styles.rowCard}>
              <Text style={styles.process}>{r.process}</Text>
              <DateField label="Process Date" value={r.processDate ?? ''} onChange={(v) => setRow(i, { processDate: v })} disabled={!ctx.editable} />
              <TimeField label="Start Time" value={r.startTime ?? ''} onChange={(v) => setRow(i, { startTime: v })} disabled={!ctx.editable} />
              <TimeField label="End Time" value={r.endTime ?? ''} onChange={(v) => setRow(i, { endTime: v })} disabled={!ctx.editable} />
              <SelectField
                label="Observation"
                value={preset}
                onChange={(v) =>
                  setRow(i, {
                    observation: v === 'Other' ? (isOther ? obs : 'Other: ') : v,
                  })
                }
                disabled={!ctx.editable}
                options={OBSERVATION_PRESETS.map((p) => ({ value: p, label: p }))}
              />
              {isOther ? (
                <Field
                  label="Other Observation Text"
                  value={obs.replace(/^Other:\s*/, '')}
                  onChangeText={(v) => setRow(i, { observation: `Other: ${v}` })}
                  editable={ctx.editable}
                />
              ) : null}
              <SelectField
                label="Result"
                value={(r.result as string) ?? ''}
                onChange={(v) => setRow(i, { result: v })}
                disabled={!ctx.editable}
                options={[
                  { value: 'PASS', label: 'PASS' },
                  { value: 'FAIL', label: 'FAIL' },
                  { value: 'NA', label: 'NA' },
                ]}
              />
            </View>
          );
        })}
      </Card>
      {ctx.editable && rows.length > 1 ? (
        <Card>
          <SectionTitle>Same date &amp; time for all processes</SectionTitle>
          <DateField label="Date" value={apply.date} onChange={(v) => setApply((a) => ({ ...a, date: v }))} />
          <TimeField label="Start" value={apply.start} onChange={(v) => setApply((a) => ({ ...a, start: v }))} />
          <TimeField label="End" value={apply.end} onChange={(v) => setApply((a) => ({ ...a, end: v }))} />
          {applyHint ? <NoticeBanner message={applyHint} tone="warning" /> : null}
          <Button
            title="Apply to all processes"
            variant="secondary"
            onPress={() => {
              if (!apply.date && !apply.start && !apply.end) {
                setApplyHint('Pick a date and/or times first.');
                return;
              }
              const next = rows.map((r) => ({
                ...r,
                ...(apply.date ? { processDate: apply.date } : {}),
                ...(apply.start ? { startTime: apply.start } : {}),
                ...(apply.end ? { endTime: apply.end } : {}),
              }));
              ctx.setForm({ checks: next });
              setApplyHint('');
            }}
          />
          <Button
            title="Copy first row to all"
            variant="ghost"
            onPress={() => {
              const first = rows[0];
              const next = rows.map((r) => ({
                ...r,
                processDate: first.processDate,
                startTime: first.startTime,
                endTime: first.endTime,
              }));
              ctx.setForm({ checks: next });
            }}
          />
        </Card>
      ) : null}
    </>
  );
}

function ConsumptionForm({ ctx }: { ctx: StageCtx }) {
  const rows: LineRow[] = useMemo(() => {
    const saved = (ctx.data.lines as LineRow[] | undefined) ?? [];
    return saved.length ? saved : [{}];
  }, [ctx.data.lines]);

  useEffect(() => {
    ctx.registerValidate(() => {
      if (!rows.length) return 'At least one consumption line is required.';
      for (const r of rows) {
        if (!r.rawMaterialName?.trim()) return 'Each line needs a raw material name.';
        if (!r.supplierBatchNo?.trim()) return 'Each line needs a supplier batch no.';
        if (num(r.quantityWithdrawn) <= 0) return 'Each line needs quantity withdrawn > 0.';
      }
      return null;
    });
  });

  const setRow = (i: number, patch: Partial<LineRow>) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    ctx.setForm({ lines: next });
  };

  return (
    <Card>
      <SectionTitle>Consumption Lines</SectionTitle>
      {rows.map((r, i) => (
        <View key={i} style={styles.rowCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontWeight: '700', color: colors.text }}>Line {i + 1}</Text>
            {ctx.editable && rows.length > 1 ? (
              <Pressable onPress={() => ctx.setForm({ lines: rows.filter((_, idx) => idx !== i) })}>
                <Text style={{ color: colors.danger, fontWeight: '700' }}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
          <Field label="Raw Material Name" value={r.rawMaterialName ?? ''} onChangeText={(v) => setRow(i, { rawMaterialName: v })} editable={ctx.editable} />
          <Field label="Supplier Batch No." value={r.supplierBatchNo ?? ''} onChangeText={(v) => setRow(i, { supplierBatchNo: v })} editable={ctx.editable} />
          <Field label="Quantity Withdrawn" value={String(r.quantityWithdrawn ?? '')} onChangeText={(v) => setRow(i, { quantityWithdrawn: num(v) })} keyboardType="numeric" editable={ctx.editable} />
          <Field label="Unit" value={r.unit ?? 'pcs'} onChangeText={(v) => setRow(i, { unit: v })} editable={ctx.editable} />
          <DateField label="Quality Checked Date" value={r.qualityCheckedDate ?? ''} onChange={(v) => setRow(i, { qualityCheckedDate: v })} disabled={!ctx.editable} />
          <Field label="Requirement Slip No." value={r.requirementSlipNo ?? ''} onChangeText={(v) => setRow(i, { requirementSlipNo: v })} editable={ctx.editable} />
        </View>
      ))}
      {ctx.editable ? (
        <Button title="+ Add Line" variant="secondary" onPress={() => ctx.setForm({ lines: [...rows, {}] })} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 8,
  },
  tab: { padding: 12, marginRight: 4 },
  tabActive: {
    borderBottomWidth: 3,
    borderBottomColor: colors.primary,
  },
  rowCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#fbfdfe',
  },
  process: { fontWeight: '700', color: colors.text, marginBottom: 8 },
});

void Badge;
void statusLabel;
