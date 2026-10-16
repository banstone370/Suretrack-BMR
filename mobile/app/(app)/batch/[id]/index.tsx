import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Print from 'expo-print';
import { api, apiErrorMessage, downloadPdf, unwrap } from '../../../../src/lib/api';
import { useAuth } from '../../../../src/state/AuthContext';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  InfoTile,
  KeyValue,
  Loading,
  NoticeBanner,
  ProgressBar,
  Screen,
  SectionTitle,
  SelectField,
  StatusBadge,
} from '../../../../src/components/ui';
import ReasonModal from '../../../../src/components/ReasonModal';
import { colors, radius } from '../../../../src/lib/theme';
import { formatDate, statusLabel } from '../../../../src/lib/format';
import type { ApiResponse, BatchDetail } from '../../../../src/types';

const STAGE_LINKS: Array<{ slug: string; label: string }> = [
  { slug: 'raw-material', label: 'Raw Material' },
  { slug: 'manufacturing', label: 'Manufacturing' },
  { slug: 'qc', label: 'In-Process QC' },
  { slug: 'inspection', label: 'Visual Inspection' },
  { slug: 'packing', label: 'Packing' },
  { slug: 'sealing', label: 'Sealing' },
  { slug: 'sterilization', label: 'ETO Sterilization' },
  { slug: 'labelling', label: 'Labelling' },
  { slug: 'sterility', label: 'Sterility Test' },
  { slug: 'bet', label: 'BET Test' },
  { slug: 'qa', label: 'QA Review' },
  { slug: 'finished-goods', label: 'Finished Goods' },
];

const CORRECTION_STAGES = [
  'raw-material-qc',
  'raw-material-consumption',
  'manufacturing',
  'in-process-qc',
  'visual-inspection',
  'packing',
  'sealing',
  'sterilization',
  'labelling',
  'sterility',
  'bet',
  'qa',
  'finished-goods',
];

interface Correction {
  _id: string;
  stageSlug: string;
  reason: string;
  status: string;
  requestedBy?: { name?: string };
  resolvedAt?: string;
  resolutionNote?: string;
}

export default function BatchDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, hasPermission } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'hold' | 'cancel' | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const batch = useQuery({
    queryKey: ['batch', id],
    queryFn: async () => unwrap(await api.get<ApiResponse<BatchDetail>>(`/batches/${id}`)),
    enabled: !!id,
  });
  const corrections = useQuery({
    queryKey: ['corrections', id],
    queryFn: async () => unwrap(await api.get<ApiResponse<Correction[]>>(`/batches/${id}/corrections`)),
    enabled: !!id,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['batch', id] });
    qc.invalidateQueries({ queryKey: ['corrections', id] });
    qc.invalidateQueries({ queryKey: ['batches'] });
    qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
  };

  const lifecycle = async (path: string, body?: Record<string, unknown>) => {
    setError('');
    try {
      await api.post(`/batches/${id}/${path}`, body ?? {});
      refresh();
    } catch (e) {
      setError(apiErrorMessage(e));
      throw e;
    }
  };

  const canResolve = hasPermission('qa:release') || user?.role === 'ADMIN';

  if (batch.isLoading) return <Loading />;
  if (batch.error)
    return (
      <Screen>
        <ErrorBanner message={apiErrorMessage(batch.error)} />
      </Screen>
    );
  const b = batch.data;
  if (!b) return null;

  const snap = b.processParamsSnapshot ?? {};
  const terminal = ['DISPATCHED', 'CANCELLED', 'ARCHIVED', 'REJECTED'].includes(b.status);
  const canHold =
    hasPermission('batch:hold') &&
    !['ON_HOLD', 'DISPATCHED', 'CANCELLED', 'ARCHIVED', 'REJECTED'].includes(b.status);
  const canResume =
    b.status === 'ON_HOLD' && (hasPermission('qa:release') || user?.role === 'ADMIN');
  const canCancel =
    hasPermission('batch:cancel') && !['DISPATCHED', 'CANCELLED', 'ARCHIVED'].includes(b.status);
  const canArchive = user?.role === 'ADMIN' && ['REJECTED', 'CANCELLED'].includes(b.status);

  const openPdf = async () => {
    setPdfBusy(true);
    setError('');
    try {
      const dataUri = await downloadPdf(b.id, b.batchNo);
      await Print.printAsync({ uri: dataUri });
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not open the BMR PDF'));
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <Screen>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.title}>BATCH: {b.batchNo}</Text>
          <StatusBadge status={b.status} />
        </View>
        <Text style={styles.sub}>{b.productName}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 }}>
          <ProgressBar percent={b.progressPercent} />
        </View>
        {b.status === 'ON_HOLD' && b.holdReason ? <NoticeBanner message={`On hold: ${b.holdReason}`} tone="warning" /> : null}
        {b.status === 'REJECTED' && b.rejectReason ? <NoticeBanner message={`Rejected: ${b.rejectReason}`} tone="warning" /> : null}
        <ErrorBanner message={error} />
        <View style={styles.actions}>
          {hasPermission('pdf:generate') ? <Button title="Generate BMR PDF" variant="secondary" onPress={openPdf} loading={pdfBusy} /> : null}
          {b.status === 'DRAFT' && hasPermission('batches:submit_production') ? (
            <Button title="Start Production" onPress={() => lifecycle('start')} />
          ) : null}
          {canHold ? <Button title="Hold Batch" variant="danger" onPress={() => setModal('hold')} /> : null}
          {canResume ? <Button title="Resume from Hold" variant="success" onPress={() => lifecycle('resume')} /> : null}
          {canCancel ? <Button title="Cancel Batch" variant="ghost" onPress={() => setModal('cancel')} /> : null}
          {canArchive ? <Button title="Archive Batch" variant="ghost" onPress={() => lifecycle('archive')} /> : null}
        </View>
      </Card>

      <Card>
        <SectionTitle>Stages</SectionTitle>
        <View style={styles.chips}>
          {STAGE_LINKS.map((s) => {
            const locked = ['LOCKED', 'APPROVED', 'SUBMITTED'].includes(
              String((b.stages ?? {})[fieldFor(s.slug)]?.lockState ?? ''),
            );
            return (
              <Link key={s.slug} href={{ pathname: '/(app)/batch/[id]/stage/[slug]', params: { id: b.id, slug: s.slug } } as never}>
                <Pressable style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}>
                  <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>{s.label}</Text>
                  {locked ? <Text style={{ color: colors.grey, fontSize: 10 }}> 🔒</Text> : null}
                </Pressable>
              </Link>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Link href={{ pathname: '/(app)/batch/[id]/dispatch', params: { id: b.id } } as never} style={{ flex: 1 }}>
            <Text style={{ color: colors.primary, fontWeight: '700', textAlign: 'center', paddingVertical: 10, backgroundColor: colors.primaryLight, borderRadius: radius }}>
              Dispatch
            </Text>
          </Link>
          <Link href={{ pathname: '/(app)/batch/[id]/audit', params: { id: b.id } } as never} style={{ flex: 1 }}>
            <Text style={{ color: colors.primary, fontWeight: '700', textAlign: 'center', paddingVertical: 10, backgroundColor: colors.primaryLight, borderRadius: radius }}>
              Batch Audit
            </Text>
          </Link>
        </View>
      </Card>

      <Card>
        <SectionTitle>Batch Information</SectionTitle>
        <KeyValue label="Catalogue No." value={b.catalogueNo} />
        <KeyValue label="Batch Size" value={String(b.batchSize)} />
        <KeyValue label="Manufacturing Date" value={formatDate(b.manufacturingDate)} />
        <KeyValue label="Expiry Date" value={formatDate(b.expiryDate)} />
        <KeyValue label="Revision" value={`R${b.currentRevision}`} />
        <KeyValue label="Created" value={formatDate(b.createdAt)} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {snap.sealingParams ? (
            <InfoTile label="Sealing (SOP)" value={`${snap.sealingParams.temperatureC}°C · ${snap.sealingParams.sopRef}`} />
          ) : null}
          {snap.sterilizationParams ? (
            <InfoTile
              label="ETO"
              value={`${snap.sterilizationParams.temperatureC}°C · ${snap.sterilizationParams.durationHours}h · ${snap.sterilizationParams.etoCartridgeGrams}g`}
            />
          ) : null}
          {snap.storageCondition ? <InfoTile label="Storage" value={snap.storageCondition} /> : null}
        </View>
      </Card>

      <Card>
        <SectionTitle>Process Timeline</SectionTitle>
        {(b.timeline ?? []).map((t) => (
          <View key={t.key} style={styles.tlRow}>
            <Text style={{ width: 26, textAlign: 'center', fontSize: 16 }}>
              {t.state === 'complete' ? '✅' : t.state === 'current' ? '▶️' : '⚪'}
            </Text>
            <Text
              style={{
                flex: 1,
                color: t.state === 'current' ? colors.primary : colors.text,
                fontWeight: t.state === 'current' ? '800' : '500',
              }}
            >
              {t.label}
            </Text>
            {t.state === 'complete' ? <Badge text="Done" tone="success" /> : t.state === 'current' ? <Badge text="Current" tone="info" /> : null}
          </View>
        ))}
      </Card>

      {(b.statusHistory ?? []).length > 0 ? (
        <Card>
          <SectionTitle>Status History</SectionTitle>
          {b.statusHistory.map((h, i) => (
            <KeyValue key={`${h.status}-${i}`} label={statusLabel(h.status)} value={`${formatDate(h.at)}${h.reason ? ` · ${h.reason}` : ''}`} />
          ))}
        </Card>
      ) : null}

      <CorrectionsPanel
        batch={b}
        corrections={corrections.data ?? []}
        canRequest={hasPermission('batch:request_correction') && !terminal}
        canResolve={canResolve}
        onChanged={() => {
          refresh();
          void corrections.refetch();
        }}
      />

      <ReasonModal
        visible={modal === 'hold'}
        title="Hold Batch"
        confirmLabel="Place On Hold"
        variant="danger"
        onClose={() => setModal(null)}
        onConfirm={async (reason) => {
          await lifecycle('hold', { reason });
        }}
      />
      <ReasonModal
        visible={modal === 'cancel'}
        title="Cancel Batch"
        confirmLabel="Cancel Batch"
        variant="danger"
        onClose={() => setModal(null)}
        onConfirm={async (reason) => {
          await lifecycle('cancel', { reason });
        }}
      />
    </Screen>
  );
}

function CorrectionsPanel({
  batch,
  corrections,
  canRequest,
  canResolve,
  onChanged,
}: {
  batch: BatchDetail;
  corrections: Correction[];
  canRequest: boolean;
  canResolve: boolean;
  onChanged: () => void;
}) {
  const [stageSlug, setStageSlug] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const request = useMutation({
    mutationFn: async () =>
      api.post(`/batches/${batch.id}/corrections`, { stageSlug, reason: reason.trim() }),
    onSuccess: () => {
      setStageSlug('');
      setReason('');
      setError('');
      onChanged();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const resolve = useMutation({
    mutationFn: async (v: { correctionId: string; decision: string }) =>
      api.post(`/batches/${batch.id}/corrections/${v.correctionId}/resolve`, { decision: v.decision }),
    onSuccess: onChanged,
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Card>
      <SectionTitle>Corrections / Unlock</SectionTitle>
      <NoticeBanner
        message="Locked records can only be changed after a correction request is approved. Approving a bump increases the revision number and re-opens the stage for editing."
        tone="info"
      />
      <ErrorBanner message={error} />
      {canRequest ? (
        <>
          <SelectField
            label="Stage"
            value={stageSlug}
            options={CORRECTION_STAGES.map((s) => ({ value: s, label: s }))}
            onChange={setStageSlug}
          />
          <Field label="Reason" value={reason} onChangeText={setReason} multiline />
          <Button
            title="Request Correction"
            variant="secondary"
            onPress={() => {
              if (!stageSlug || !reason.trim()) {
                setError('Select a stage and provide a reason.');
                return;
              }
              request.mutate();
            }}
            loading={request.isPending}
          />
        </>
      ) : null}
      {corrections.length === 0 ? <EmptyState text="No correction requests." /> : null}
      {corrections.map((c) => (
        <View key={c._id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontWeight: '700', color: colors.text }}>{c.stageSlug}</Text>
            <Badge
              text={c.status}
              tone={c.status === 'PENDING' ? 'warning' : c.status === 'APPROVED' ? 'success' : 'danger'}
            />
          </View>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{c.reason}</Text>
          {c.status === 'PENDING' && canResolve ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Button title="Approve" variant="success" onPress={() => resolve.mutate({ correctionId: c._id, decision: 'APPROVE' })} loading={resolve.isPending} />
              <Button title="Reject" variant="danger" onPress={() => resolve.mutate({ correctionId: c._id, decision: 'REJECT' })} loading={resolve.isPending} />
            </View>
          ) : null}
        </View>
      ))}
    </Card>
  );
}

function fieldFor(slug: string): string {
  const map: Record<string, string> = {
    'raw-material': 'rawMaterialQc',
    manufacturing: 'manufacturing',
    qc: 'inProcessQc',
    inspection: 'visualInspection',
    packing: 'packing',
    sealing: 'sealing',
    sterilization: 'sterilization',
    labelling: 'labelling',
    sterility: 'sterilityTest',
    bet: 'betTest',
    qa: 'qaReview',
    'finished-goods': 'finishedGoods',
  };
  return map[slug] ?? slug;
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '800', color: colors.text, flexShrink: 1 },
  sub: { color: colors.muted, marginTop: 2 },
  actions: { marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.primaryLight,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tlRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 8 },
});
