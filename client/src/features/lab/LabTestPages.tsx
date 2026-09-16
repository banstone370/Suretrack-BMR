import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { StageShell } from '../../components/batch/StageShell';
import { AttachmentPanel } from '../../components/common/AttachmentPanel';
import { ElectronicSignature } from '../../components/forms/ElectronicSignature';
import { useAuth } from '../auth/AuthContext';
import { useStage } from '../../hooks/useStage';

type LabResult = '' | 'PASS' | 'FAIL' | 'PENDING';

interface LabForm {
  testDate: string;
  reportNo: string;
  result: LabResult;
  reportingDate: string;
  startTime: string;
  endTime: string;
}

function LabTestPage({
  stageSlug,
  title,
  permission,
  defaultSop,
  snapshotSopKey,
  passMessage,
}: {
  stageSlug: 'sterility' | 'bet';
  title: string;
  permission: string;
  defaultSop: string;
  snapshotSopKey: 'sterilitySop' | 'betSop';
  passMessage: string;
}) {
  const { batchId } = useParams();
  const { hasPermission } = useAuth();
  const stage = useStage(batchId, stageSlug);
  const [signOpen, setSignOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState<LabForm>({
    testDate: '',
    reportNo: '',
    result: '',
    reportingDate: '',
    startTime: '',
    endTime: '',
  });

  const snapshot = stage.query.data?.processParamsSnapshot as Record<string, string> | undefined;
  const sopRef = snapshot?.[snapshotSopKey] ?? defaultSop;

  useEffect(() => {
    const data = stage.query.data?.data;
    if (!data) return;
    setForm({
      testDate: data.testDate
        ? String(data.testDate).slice(0, 10)
        : data.doneOn
          ? String(data.doneOn).slice(0, 10)
          : '',
      reportNo: String(data.reportNo ?? ''),
      result: (data.result as LabResult) || '',
      reportingDate: data.reportingDate ? String(data.reportingDate).slice(0, 10) : '',
      startTime: String(data.startTime ?? ''),
      endTime: String(data.endTime ?? ''),
    });
  }, [stage.query.data]);

  const batch = stage.batchQuery.data;
  const locked = ['SUBMITTED', 'APPROVED', 'LOCKED'].includes(
    String(stage.query.data?.data?.lockState ?? ''),
  );
  const canEdit = hasPermission(permission) && !locked;

  return (
    <StageShell
      batchId={batchId!}
      batchNo={batch?.batchNo}
      productName={batch?.productName}
      status={batch?.status}
      progressPercent={batch?.progressPercent}
      title={title}
    >
      <section className="space-y-4 rounded-xl border border-line bg-white/90 p-3 shadow-sm sm:p-5">
        <div className="rounded-lg bg-brand-50/80 px-4 py-3 text-sm">
          <span className="text-muted">SOP: </span>
          <span className="font-semibold text-brand-900">{sopRef}</span>
        </div>

        <p className="text-xs text-muted">
          Lock: {String(stage.query.data?.data?.lockState ?? 'OPEN')}
        </p>
        {msg && <p className="text-sm text-accent-600">{msg}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Test date
            <input
              type="date"
              disabled={!canEdit}
              value={form.testDate}
              onChange={(e) => setForm((f) => ({ ...f, testDate: e.target.value }))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Report no.
            <input
              disabled={!canEdit}
              value={form.reportNo}
              onChange={(e) => setForm((f) => ({ ...f, reportNo: e.target.value }))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
              placeholder="e.g. STR-260914-01"
            />
          </label>
          <label className="block text-sm font-medium">
            Result
            <select
              disabled={!canEdit}
              value={form.result === 'PENDING' ? '' : form.result}
              onChange={(e) =>
                setForm((f) => ({ ...f, result: e.target.value as LabResult }))
              }
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            >
              <option value="">Select</option>
              <option value="PASS">Pass</option>
              <option value="FAIL">Fail</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            Reporting date
            <input
              type="date"
              disabled={!canEdit}
              value={form.reportingDate}
              onChange={(e) => setForm((f) => ({ ...f, reportingDate: e.target.value }))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Start time
            <input
              type="time"
              disabled={!canEdit}
              value={form.startTime}
              onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            End time
            <input
              type="time"
              disabled={!canEdit}
              value={form.endTime}
              onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
        </div>

        <AttachmentPanel
          batchId={batchId!}
          stageSlug={stageSlug}
          canUpload={canEdit || hasPermission('batches:view_all')}
        />

        {canEdit && (
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-line px-4 py-2 text-sm hover:bg-brand-50"
              onClick={async () => {
                await stage.save.mutateAsync({ ...form, sopRef });
                setMsg('Draft saved');
              }}
            >
              Save Draft
            </button>
            <button
              type="button"
              className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white"
              onClick={() => setSignOpen(true)}
            >
              Submit Result
            </button>
          </div>
        )}
      </section>

      <ElectronicSignature
        open={signOpen}
        title={`Submit ${title}`}
        confirmLabel={form.result === 'FAIL' ? 'Submit Fail' : 'Submit Pass'}
        requireReason={form.result === 'FAIL'}
        onClose={() => setSignOpen(false)}
        onConfirm={async ({ password, statement, reason }) => {
          await stage.submit.mutateAsync({
            payload: { ...form, sopRef, doneOn: form.testDate },
            password,
            statement,
            reason,
          });
          setMsg(
            form.result === 'FAIL'
              ? `${title} failed — batch rejected`
              : passMessage,
          );
        }}
      />
    </StageShell>
  );
}

export function SterilityPage() {
  return (
    <LabTestPage
      stageSlug="sterility"
      title="Sterility Test"
      permission="sterility:edit"
      defaultSop="SOP/QC/004"
      snapshotSopKey="sterilitySop"
      passMessage="Sterility passed — moved to BET Test"
    />
  );
}

export function BetPage() {
  return (
    <LabTestPage
      stageSlug="bet"
      title="BET Test"
      permission="bet:edit"
      defaultSop="SOP/QC/005"
      snapshotSopKey="betSop"
      passMessage="BET passed — moved to QA Review"
    />
  );
}
