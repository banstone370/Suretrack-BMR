import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { StageShell } from '../../components/batch/StageShell';
import { ElectronicSignature } from '../../components/forms/ElectronicSignature';
import { useAuth } from '../auth/AuthContext';
import { useStage } from '../../hooks/useStage';

export function QaReviewPage() {
  const { batchId } = useParams();
  const { hasPermission } = useAuth();
  const stage = useStage(batchId, 'qa');
  const [signMode, setSignMode] = useState<'submit' | 'release' | 'hold' | 'reject' | null>(null);
  const [msg, setMsg] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');

  useEffect(() => {
    const data = stage.query.data?.data;
    if (!data) return;
    setReviewNotes(String(data.reviewNotes ?? ''));
  }, [stage.query.data]);

  const batch = stage.batchQuery.data;
  const lockState = String(stage.query.data?.data?.lockState ?? 'OPEN');
  const locked = ['APPROVED', 'LOCKED'].includes(lockState);
  const canEdit = hasPermission('qa:review') && lockState === 'OPEN';
  const canDecide = hasPermission('qa:release') && lockState === 'SUBMITTED';

  return (
    <StageShell
      batchId={batchId!}
      batchNo={batch?.batchNo}
      productName={batch?.productName}
      status={batch?.status}
      progressPercent={batch?.progressPercent}
      title="QA Review & Release"
    >
      <section className="space-y-4 rounded-xl border border-line bg-white/90 p-3 shadow-sm sm:p-5">
        <p className="text-xs text-muted">Lock: {lockState}</p>
        {msg && <p className="text-sm text-accent-600">{msg}</p>}

        <div className="rounded-lg bg-brand-50/70 p-4 text-sm">
          <p className="font-medium text-brand-900">Final compliance review</p>
          <p className="mt-1 text-muted">
            Confirm all production, QC, sterilization, and lab stages are complete before release.
          </p>
        </div>

        <label className="block text-sm font-medium">
          Review notes
          <textarea
            disabled={!canEdit}
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            rows={5}
            placeholder="Summarize batch compliance review…"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <>
              <button
                type="button"
                className="rounded-md border border-line px-4 py-2 text-sm hover:bg-brand-50"
                onClick={async () => {
                  await stage.save.mutateAsync({ reviewNotes });
                  setMsg('QA draft saved');
                }}
              >
                Save Draft
              </button>
              <button
                type="button"
                className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white"
                onClick={() => setSignMode('submit')}
              >
                Submit for Release
              </button>
            </>
          )}
          {canDecide && (
            <>
              <button
                type="button"
                className="rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white"
                onClick={() => setSignMode('release')}
              >
                Release Batch
              </button>
              <button
                type="button"
                className="rounded-md border border-warn px-4 py-2 text-sm font-medium text-warn"
                onClick={() => setSignMode('hold')}
              >
                Place On Hold
              </button>
              <button
                type="button"
                className="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white"
                onClick={() => setSignMode('reject')}
              >
                Reject
              </button>
            </>
          )}
          {locked && <p className="text-sm text-muted">QA decision is locked.</p>}
        </div>
      </section>

      <ElectronicSignature
        open={signMode === 'submit'}
        title="Submit QA Review"
        onClose={() => setSignMode(null)}
        onConfirm={async ({ password, statement }) => {
          await stage.submit.mutateAsync({
            payload: { reviewNotes },
            password,
            statement,
          });
          setMsg('QA review submitted — awaiting release decision');
        }}
      />
      <ElectronicSignature
        open={signMode === 'release'}
        title="Release Batch"
        confirmLabel="Approve & Release"
        statement="I confirm that I have reviewed this batch record and authorize release."
        onClose={() => setSignMode(null)}
        onConfirm={async ({ password, statement }) => {
          await stage.approve.mutateAsync({ password, statement });
          setMsg('Batch released — ready for finished goods transfer');
        }}
      />
      <ElectronicSignature
        open={signMode === 'hold'}
        title="Place Batch On Hold"
        confirmLabel="Hold"
        requireReason
        onClose={() => setSignMode(null)}
        onConfirm={async ({ password, statement, reason }) => {
          await stage.reject.mutateAsync({
            password,
            statement,
            reason: reason!,
            decision: 'HOLD',
          });
          setMsg('Batch placed on hold');
        }}
      />
      <ElectronicSignature
        open={signMode === 'reject'}
        title="Reject Batch"
        confirmLabel="Reject"
        requireReason
        onClose={() => setSignMode(null)}
        onConfirm={async ({ password, statement, reason }) => {
          await stage.reject.mutateAsync({
            password,
            statement,
            reason: reason!,
            decision: 'REJECTED',
          });
          setMsg('Batch rejected');
        }}
      />
    </StageShell>
  );
}
