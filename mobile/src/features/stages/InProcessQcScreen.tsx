import React, { useEffect } from 'react';
import StageFrame, { type StageCtx } from '../../components/StageFrame';
import { Card, Checkbox, Field, SectionTitle, SelectField } from '../../components/ui';
import { STAGE_DEFS } from '../../lib/stageDefs';
import { todayISO } from '../../lib/format';

export default function InProcessQcScreen({ batchId }: { batchId: string }) {
  return (
    <StageFrame batchId={batchId} def={STAGE_DEFS.qc}>
      {(ctx) => <Form ctx={ctx} />}
    </StageFrame>
  );
}

const CHECKS = [
  { key: 'dustFree', label: 'Dust free' },
  { key: 'burrFree', label: 'Burr free' },
  { key: 'foreignParticleFree', label: 'Foreign particle free' },
] as const;

function Form({ ctx }: { ctx: StageCtx }) {
  const d = ctx.data;
  const set = ctx.setForm;
  const observation = String(d.observation ?? '');
  const result = (d.result as string) ?? '';

  const allChecked = CHECKS.every((c) => d[c.key] === true);

  useEffect(() => {
    ctx.registerValidate(() => {
      if (!result) return 'Select a result (PASS / FAIL / NA).';
      return null;
    });
  });

  const toggle = (key: string) => {
    const next = { ...d, [key]: !(d[key] === true) };
    ctx.replaceForm(next);
    // auto-fill: all three checked and empty result => PASS
    if (CHECKS.every((c) => next[c.key] === true) && !next.result) {
      ctx.setForm({ result: 'PASS' });
    }
  };

  return (
    <Card>
      <SectionTitle>In-Process QC</SectionTitle>
      {CHECKS.map((c) => (
        <Checkbox
          key={c.key}
          label={c.label}
          checked={d[c.key] === true}
          onToggle={() => toggle(c.key)}
          disabled={!ctx.editable}
        />
      ))}
      <Field label="Observation" value={observation} onChangeText={(v) => set({ observation: v })} multiline editable={ctx.editable} />
      <SelectField
        label="Result"
        value={result}
        onChange={(v) => set({ result: v })}
        disabled={!ctx.editable}
        options={[
          { value: 'PASS', label: 'PASS' },
          { value: 'FAIL', label: 'FAIL' },
          { value: 'NA', label: 'NA' },
        ]}
      />
      {allChecked ? (
        <SectionTitle>{'All three checks selected — result auto-filled to PASS if empty.'}</SectionTitle>
      ) : null}
    </Card>
  );
}

void todayISO;
