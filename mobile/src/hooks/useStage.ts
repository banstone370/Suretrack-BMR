import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../lib/api';
import type { ApiResponse, BatchStatus, ProcessParamsSnapshot } from '../types';
import type { SignaturePayload } from '../components/SignatureModal';

export interface StageResponse {
  batchId: string;
  batchNo: string;
  status: BatchStatus;
  progressPercent: number;
  stage: string;
  label: string;
  data: Record<string, unknown>;
  processParamsSnapshot: ProcessParamsSnapshot;
}

export function stageQueryKey(batchId: string, slug: string) {
  return ['stage', batchId, slug];
}

export function useStage(batchId: string, slug: string) {
  return useQuery({
    queryKey: stageQueryKey(batchId, slug),
    queryFn: async () =>
      unwrap(await api.get<ApiResponse<StageResponse>>(`/batches/${batchId}/${slug}`)),
    enabled: !!batchId && !!slug,
  });
}

export interface RejectOptions {
  decision?: 'REJECTED' | 'HOLD';
}

export function useStageActions(batchId: string, slug: string) {
  const qc = useQueryClient();
  const base = `/batches/${batchId}/${slug}`;
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: stageQueryKey(batchId, slug) });
    qc.invalidateQueries({ queryKey: ['batch', batchId] });
    qc.invalidateQueries({ queryKey: ['batches'] });
  };

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      unwrap(await api.put<ApiResponse<StageResponse>>(base, { payload })),
    onSuccess: invalidate,
  });

  const submit = useMutation({
    mutationFn: async (v: { payload: Record<string, unknown>; signature: SignaturePayload; reason?: string }) =>
      unwrap(
        await api.post<ApiResponse<StageResponse>>(`${base}/submit`, {
          payload: v.payload,
          signature: { password: v.signature.password, statement: v.signature.statement },
          reason: v.reason,
        }),
      ),
    onSuccess: invalidate,
  });

  const approve = useMutation({
    mutationFn: async (v: { signature: SignaturePayload }) =>
      unwrap(
        await api.post<ApiResponse<StageResponse>>(`${base}/approve`, {
          signature: { password: v.signature.password, statement: v.signature.statement },
        }),
      ),
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: async (v: { signature: SignaturePayload; reason: string; decision?: 'REJECTED' | 'HOLD' }) =>
      unwrap(
        await api.post<ApiResponse<StageResponse>>(`${base}/reject`, {
          signature: { password: v.signature.password, statement: v.signature.statement },
          reason: v.reason,
          decision: v.decision,
        }),
      ),
    onSuccess: invalidate,
  });

  return { save, submit, approve, reject };
}

export function lockStateOf(data?: Record<string, unknown> | null): string {
  return (data?.lockState as string) ?? 'OPEN';
}

export function isStageLocked(data?: Record<string, unknown> | null): boolean {
  const ls = lockStateOf(data);
  return ls === 'LOCKED' || ls === 'APPROVED' || ls === 'SUBMITTED';
}
