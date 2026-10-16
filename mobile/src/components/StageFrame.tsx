import React, { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../state/AuthContext';
import { apiErrorMessage } from '../lib/api';
import { useStage, useStageActions } from '../hooks/useStage';
import type { StageDef } from '../lib/stageDefs';
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  Loading,
  NoticeBanner,
  Screen,
  SectionTitle,
  StatusBadge,
} from './ui';
import { SignatureModal, fetchEsignStatement, type SignaturePayload } from './SignatureModal';
import type { StageResponse } from '../hooks/useStage';
import { colors } from '../lib/theme';

export interface StageFrameProps {
  batchId: string;
  def: StageDef;
  children: (ctx: StageCtx) => ReactNode;
}

export interface StageCtx {
  stage: StageResponse;
  data: Record<string, unknown>;
  lockState: string;
  editable: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canReject: boolean;
  saved: { current: Record<string, unknown> };
  setForm: (patch: Record<string, unknown>) => void;
  replaceForm: (next: Record<string, unknown>) => void;
  save: () => void;
  registerValidate: (fn: () => string | null) => void;
  setSubmitOpts: (opts: null | { confirmLabel?: string; requireReason?: boolean; reasonLabel?: string; message?: string }) => void;
  requestSubmit: (
    validate: () => string | null,
    opts?: { confirmLabel?: string; requireReason?: boolean; reasonLabel?: string; message?: string },
  ) => void;
  requestApprove: () => void;
  requestReject: (opts?: {
    decision?: 'REJECTED' | 'HOLD';
    title?: string;
    confirmLabel?: string;
  }) => void;
  busy: boolean;
  error: string;
  esignStatement: string;
}

export default function StageFrame({ batchId, def, children }: StageFrameProps) {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const stageQuery = useStage(batchId, def.apiSlug);
  const actions = useStageActions(batchId, def.apiSlug);
  const [form, setFormState] = useState<Record<string, unknown>>({});
  const seeded = useRef(false);
  const [error, setError] = useState('');
  const [esign, setEsign] = useState('I confirm that I have reviewed this record and the entries are accurate.');
  const [sign, setSign] = useState<null | 'submit' | 'approve' | 'reject'>(null);
  const validateRef = useRef<null | (() => string | null)>(null);
  const submitOptsRef = useRef<null | {
    confirmLabel?: string;
    requireReason?: boolean;
    reasonLabel?: string;
    message?: string;
  }>(null);
  const rejectOptsRef = useRef<null | { decision?: 'REJECTED' | 'HOLD'; title?: string; confirmLabel?: string }>(
    null,
  );

  useEffect(() => {
    void fetchEsignStatement().then((s) => {
      setEsign(def.approveStatement ? s : s);
    });
  }, [def.approveStatement]);

  useEffect(() => {
    if (stageQuery.data && !seeded.current) {
      seeded.current = true;
      const { lockState: _ls, ...rest } = stageQuery.data.data ?? {};
      setFormState(rest);
    }
  }, [stageQuery.data]);

  const stage = stageQuery.data;
  const lockState = String(stage?.data?.lockState ?? 'OPEN');
  const status = stage?.status ?? 'DRAFT';

  const editable =
    !!stage &&
    hasPermission(def.editPermission) &&
    lockState === 'OPEN' &&
    def.editableWhen.includes(status);
  const canSubmit =
    !!stage &&
    hasPermission(def.editPermission) &&
    lockState === 'OPEN' &&
    def.submittableWhen.includes(status);
  const canApprove =
    !!stage &&
    lockState === 'SUBMITTED' &&
    !!def.requiresApprove &&
    hasPermission(def.approvePermission ?? def.editPermission) &&
    def.submittableWhen.includes(status);
  const canReject = canApprove;

  if (stageQuery.isLoading) return <Loading />;
  if (stageQuery.error)
    return (
      <Screen>
        <ErrorBanner message={apiErrorMessage(stageQuery.error)} />
      </Screen>
    );
  if (!stage) return null;

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['batch', batchId] });
    qc.invalidateQueries({ queryKey: ['batches'] });
  };

  const ctx: StageCtx = {
    stage,
    data: form,
    lockState,
    editable,
    canSubmit,
    canApprove,
    canReject,
    saved: { current: stage.data },
    setForm: (patch) => setFormState((f) => ({ ...f, ...patch })),
    replaceForm: (next) => setFormState(next),
    save: () => {
      setError('');
      actions.save.mutate(form, {
        onError: (e) => setError(apiErrorMessage(e)),
        onSuccess: () => invalidateAll(),
      });
    },
    registerValidate: (fn) => {
      validateRef.current = fn;
    },
    setSubmitOpts: (opts) => {
      submitOptsRef.current = opts ?? null;
    },
    requestSubmit: (validate, opts) => {
      setError('');
      validateRef.current = validate;
      submitOptsRef.current = opts ?? null;
      const msg = validate();
      if (msg) {
        setError(msg);
        return;
      }
      setSign('submit');
    },
    requestApprove: () => {
      setError('');
      setSign('approve');
    },
    requestReject: (opts) => {
      setError('');
      rejectOptsRef.current = opts ?? null;
      setSign('reject');
    },
    busy: actions.save.isPending || actions.submit.isPending || actions.approve.isPending || actions.reject.isPending,
    error,
    esignStatement: esign,
  };

  // the live form state is captured at render; submit uses it directly

  const onSignConfirm = async (sig: SignaturePayload) => {
    setError('');
    try {
      if (sign === 'submit') {
        await actions.submit.mutateAsync({
          payload: form,
          signature: sig,
          reason: sig.reason,
        });
      } else if (sign === 'approve') {
        await actions.approve.mutateAsync({
          signature: { ...sig, statement: sig.statement || esign },
        });
      } else if (sign === 'reject') {
        await actions.reject.mutateAsync({
          signature: { ...sig, statement: sig.statement || esign },
          reason: sig.reason ?? '',
          decision: rejectOptsRef.current?.decision ?? (def.rejectIsHold ? 'HOLD' : 'REJECTED'),
        });
      }
      seeded.current = false;
      invalidateAll();
      void stageQuery.refetch().then((r) => {
        if (r.data) {
          const { lockState: _ls, ...rest } = r.data.data ?? {};
          setFormState(rest);
          seeded.current = true;
        }
      });
    } catch (e) {
      setError(apiErrorMessage(e));
      throw e;
    }
  };

  return (
    <Screen>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.batch}>{stage.batchNo}</Text>
          <StatusBadge status={stage.status} />
        </View>
        <Text style={styles.label}>{def.label}</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'center' }}>
          <Badge text={`Lock: ${lockState}`} tone={lockState === 'OPEN' ? 'success' : 'warning'} />
          {stage.progressPercent != null ? <Text style={styles.pct}>{stage.progressPercent}% complete</Text> : null}
        </View>
        {lockState !== 'OPEN' ? (
          <NoticeBanner
            message={
              lockState === 'SUBMITTED'
                ? def.requiresApprove
                  ? 'Submitted — awaiting approval. Request a correction to make further changes.'
                  : 'Submitted.'
                : `Record is ${lockState.toLowerCase()}. Request a correction to make changes.`
            }
            tone="info"
          />
        ) : null}
        {!editable && lockState === 'OPEN' ? (
          <NoticeBanner
            message={
              hasPermission(def.editPermission)
                ? `Not editable at batch status ${status.replace(/_/g, ' ')}.`
                : 'You do not have permission to edit this stage.'
            }
            tone="warning"
          />
        ) : null}
        <ErrorBanner message={error} />
      </Card>

      {children(ctx)}

      {editable || canSubmit ? (
        <Card>
          <Button title="Save Draft" variant="secondary" onPress={ctx.save} loading={actions.save.isPending} />
          {canSubmit ? (
            <Button
              title={def.submitLabel}
              onPress={() => {
                const msg = validateRef.current ? validateRef.current() : null;
                if (msg) {
                  setError(msg);
                  return;
                }
                setSign('submit');
              }}
              loading={actions.submit.isPending}
            />
          ) : null}
        </Card>
      ) : null}

      {canApprove || canReject ? (
        <Card>
          <SectionTitle>Decision</SectionTitle>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {canApprove ? (
              <Button title={def.approveLabel ?? 'Approve'} variant="success" onPress={ctx.requestApprove} loading={actions.approve.isPending} />
            ) : null}
            {canReject ? (
              <Button
                title={def.rejectIsHold ? 'Hold / Reject' : 'Reject'}
                variant="danger"
                onPress={() => ctx.requestReject()}
                loading={actions.reject.isPending}
              />
            ) : null}
          </View>
        </Card>
      ) : null}

      <SignatureModal
        visible={sign !== null}
        title={
          sign === 'submit'
            ? submitOptsRef.current?.message ?? def.submitLabel
            : sign === 'approve'
              ? def.approveLabel ?? 'Approve'
              : rejectOptsRef.current?.title ?? (def.rejectIsHold ? 'Hold Batch' : 'Reject')
        }
        confirmLabel={
          sign === 'submit'
            ? submitOptsRef.current?.confirmLabel ?? def.submitLabel
            : sign === 'approve'
              ? def.approveLabel ?? 'Approve & Sign'
              : rejectOptsRef.current?.confirmLabel ?? (def.rejectIsHold ? 'Place On Hold' : 'Reject')
        }
        variant={sign === 'approve' ? 'success' : sign === 'reject' ? 'danger' : 'primary'}
        requireReason={sign === 'reject' || (sign === 'submit' && !!submitOptsRef.current?.requireReason)}
        reasonLabel={sign === 'submit' ? submitOptsRef.current?.reasonLabel ?? 'Reason' : 'Reason'}
        statement={
          sign === 'approve' && def.approveStatement ? def.approveStatement : esign
        }
        onClose={() => setSign(null)}
        onConfirm={onSignConfirm}
      />
    </Screen>
  );
}

void Alert;

const styles = StyleSheet.create({
  batch: { fontWeight: '800', fontSize: 16, color: colors.text, flexShrink: 1 },
  label: { color: colors.primary, fontWeight: '700', marginTop: 2 },
  pct: { color: colors.muted, fontSize: 12 },
});
