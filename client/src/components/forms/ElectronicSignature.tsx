import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../features/auth/AuthContext';

interface Props {
  open: boolean;
  title: string;
  statement?: string;
  confirmLabel?: string;
  requireReason?: boolean;
  onClose: () => void;
  onConfirm: (data: { password: string; statement: string; reason?: string }) => Promise<void> | void;
}

const DEFAULT_STATEMENT =
  'I confirm that I have reviewed this record and the entries are accurate.';

export function ElectronicSignature({
  open,
  title,
  statement = DEFAULT_STATEMENT,
  confirmLabel = 'Confirm & Sign',
  requireReason = false,
  onClose,
  onConfirm,
}: Props) {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword('');
      setReason('');
      setError('');
    }
  }, [open]);

  if (!open) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (requireReason && !reason.trim()) {
      setError('Reason is required');
      return;
    }
    setBusy(true);
    try {
      await onConfirm({ password, statement, reason: reason.trim() || undefined });
      onClose();
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Signature failed';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <form
        onSubmit={onSubmit}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-white p-5 shadow-xl sm:max-h-none sm:max-w-md sm:rounded-xl"
      >
        <h2 className="font-display text-lg font-semibold text-brand-950">{title}</h2>
        <p className="mt-2 text-sm text-muted">{statement}</p>

        <div className="mt-4 rounded-lg bg-brand-50/80 px-3 py-2 text-sm">
          <p className="font-medium text-ink">{user?.name}</p>
          <p className="text-xs text-muted">
            Employee ID: {user?.employeeId} · {new Date().toLocaleString('en-GB')}
          </p>
        </div>

        {requireReason && (
          <label className="mt-4 block text-sm font-medium">
            Reason
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2 outline-none ring-brand-800 focus:ring-2"
              rows={3}
              required
            />
          </label>
        )}

        <label className="mt-4 block text-sm font-medium">
          Password / PIN
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-line px-3 py-2 outline-none ring-brand-800 focus:ring-2"
            required
            autoFocus
          />
        </label>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line px-4 py-2.5 text-sm hover:bg-brand-50 sm:py-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-brand-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60 sm:py-2"
          >
            {busy ? 'Signing…' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
