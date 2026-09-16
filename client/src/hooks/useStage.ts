import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ApiResponse, BatchDetail } from '../types';

export interface StageResponse {
  batchId: string;
  batchNo: string;
  status: string;
  progressPercent: number;
  stage: string;
  label: string;
  data: Record<string, unknown>;
  processParamsSnapshot: Record<string, unknown>;
}

export function useStage(batchId: string | undefined, stage: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['stage', batchId, stage],
    enabled: !!batchId,
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<StageResponse>>(`/batches/${batchId}/${stage}`);
      return data.data;
    },
  });

  const batchQuery = useQuery({
    queryKey: ['batch', batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<BatchDetail>>(`/batches/${batchId}`);
      return data.data;
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['stage', batchId, stage] });
    void queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
    void queryClient.invalidateQueries({ queryKey: ['batches'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
  };

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.put<ApiResponse<BatchDetail>>(`/batches/${batchId}/${stage}`, {
        payload,
      });
      return data.data;
    },
    onSuccess: invalidate,
  });

  const submit = useMutation({
    mutationFn: async (body: {
      payload: Record<string, unknown>;
      password: string;
      statement?: string;
      reason?: string;
    }) => {
      const { data } = await api.post<ApiResponse<BatchDetail>>(
        `/batches/${batchId}/${stage}/submit`,
        {
          payload: body.payload,
          signature: { password: body.password, statement: body.statement },
          reason: body.reason,
        },
      );
      return data.data;
    },
    onSuccess: invalidate,
  });

  const approve = useMutation({
    mutationFn: async (body: { password: string; statement?: string; reason?: string }) => {
      const { data } = await api.post<ApiResponse<BatchDetail>>(
        `/batches/${batchId}/${stage}/approve`,
        {
          signature: { password: body.password, statement: body.statement },
          reason: body.reason,
        },
      );
      return data.data;
    },
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: async (body: {
      password: string;
      statement?: string;
      reason: string;
      decision?: 'REJECTED' | 'HOLD';
    }) => {
      const { data } = await api.post<ApiResponse<BatchDetail>>(
        `/batches/${batchId}/${stage}/reject`,
        {
          signature: { password: body.password, statement: body.statement },
          reason: body.reason,
          decision: body.decision,
        },
      );
      return data.data;
    },
    onSuccess: invalidate,
  });

  return { query, batchQuery, save, submit, approve, reject };
}
