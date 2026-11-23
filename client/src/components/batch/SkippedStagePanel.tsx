import { useState } from 'react';
import { ElectronicSignature } from '../forms/ElectronicSignature';
import type { useStage } from '../../hooks/useStage';

interface Props {
  stage: ReturnType<typeof useStage>;
  /** Label of the skipped stage, e.g. "Packing" */
  label: string;
  /** Stage the batch advances to once the skip is confirmed, e.g. "Sealing" */
  nextLabel: string;
  /** User holds the stage's edit permission */
  permissionOk: boolean;
  /** Batch is at the status where this stage (and its skip) can be signed off */
  statusOk: boolean;
}

/**
 * Rendered in place of the stage form when the product's BMR template marks
 * this stage as optional (processParamsSnapshot.optionalStages) and the batch
 * was created with lockState SKIPPED.
 */
export function SkippedStagePanel({
  stage,
  label,
  nextLabel,
  permissionOk,
  statusOk,
}: Props) {
  const data = stage.query.data?.data ?? {};
  const reason = String(data.skipReason ?? 'Not applicable for this product');
  const confirmedAt = data.skipConfirmedAt ? new Date(String(data.skipConfirmedAt)) : null;
  const confirmedBy = data.skipConfirmedBy as { name?: string; employeeId?: string } | undefined;
  const status = String(stage.batchQuery.data?.status ?? 'DRAFT').replace(/_/g, ' ');
  const canConfirm = permissionOk && statusOk;
  const [signOpen, setSignOpen] = useState(false);

  return (
    <section className="space-y-4 rounded-xl border border-line bg-white/90 p-3 shadow-sm sm:p-5">
      <div className="rounded-lg border border-brand-800/20 bg-brand-50/80 px-4 py-3">
        <p className="text-xs text-muted">Stage status</p>
        <p className="mt-1 font-display text-lg font-semibold text-brand-950">
          Not applicable — skipped
        </p>
        <p className="mt-1 text-sm text-muted">
          {label} is marked optional in this product&apos;s BMR template, so no entries are
          required for this batch.
        </p>
      </div>

      <p className="text-xs text-muted">Reason: {reason}</p>

      {confirmedAt ? (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-accent-600">
          Skip confirmed by {confirmedBy?.name ?? '—'} ({confirmedBy?.employeeId ?? '—'}) on{' '}
          {confirmedAt.toLocaleString('en-GB')}. The batch moved on to {nextLabel}.
        </div>
      ) : canConfirm ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Confirming the skip requires your electronic signature and advances the batch to{' '}
            {nextLabel}.
          </p>
          <button
            type="button"
            disabled={stage.submit.isPending}
            onClick={() => setSignOpen(true)}
            className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {stage.submit.isPending ? 'Signing…' : 'Confirm skip & continue'}
          </button>
        </div>
      ) : !permissionOk ? (
        <p className="text-sm text-warn">
          Your role cannot confirm this skip — ask the {label} owner to sign it off.
        </p>
      ) : (
        <p className="text-sm text-muted">
          Confirming the skip becomes available once the batch reaches {label} (current status:{' '}
          {status}).
        </p>
      )}

      <ElectronicSignature
        open={signOpen}
        title={`Skip ${label} — not applicable`}
        confirmLabel="Confirm skip & sign"
        statement={`I confirm that ${label} does not apply to this product and may be skipped for this batch.`}
        onClose={() => setSignOpen(false)}
        onConfirm={async ({ password, statement }) => {
          await stage.submit.mutateAsync({ payload: {}, password, statement });
        }}
      />
    </section>
  );
}
