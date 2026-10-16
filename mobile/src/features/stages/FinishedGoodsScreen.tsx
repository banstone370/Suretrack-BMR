import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import StageFrame, { type StageCtx } from '../../components/StageFrame';
import { Card, Field, InfoTile, NoticeBanner, SectionTitle } from '../../components/ui';
import { DateField } from '../../components/DateTimeField';
import { STAGE_DEFS } from '../../lib/stageDefs';
import { api, unwrap } from '../../lib/api';
import { formatDate, num, todayISO } from '../../lib/format';
import type { ApiResponse, BatchDetail } from '../../types';

export default function FinishedGoodsScreen({ batchId }: { batchId: string }) {
  return (
    <StageFrame batchId={batchId} def={STAGE_DEFS['finished-goods']}>
      {(ctx) => <Form ctx={ctx} batchId={batchId} />}
    </StageFrame>
  );
}

function Form({ ctx, batchId }: { ctx: StageCtx; batchId: string }) {
  const d = ctx.data;
  const set = ctx.setForm;
  const snap = ctx.stage.processParamsSnapshot;
  const batch = useQuery({
    queryKey: ['batch', batchId],
    queryFn: async () => unwrap(await api.get<ApiResponse<BatchDetail>>(`/batches/${batchId}`)),
  });

  const quantity = String(d.quantity ?? batch.data?.batchSize ?? '');
  const transferDate = String(d.transferDate ?? '');
  const receivedOn = String(d.receivedOn ?? '');
  const storageCondition = String(d.storageCondition ?? snap?.storageCondition ?? 'Store at Room Temperature');
  const fgId = d.finishedGoodsId as string | undefined;

  useEffect(() => {
    ctx.registerValidate(() => {
      if (num(quantity) <= 0) return 'Quantity must be greater than 0.';
      if (!transferDate) return 'Transfer date is required.';
      if (batch.data && num(quantity) > batch.data.batchSize)
        return `Quantity cannot exceed batch size (${batch.data.batchSize}).`;
      return null;
    });
  });

  return (
    <Card>
      <SectionTitle>Finished Goods Transfer</SectionTitle>
      <View style={{ flexDirection: 'row' }}>
        <InfoTile label="Batch Expiry" value={formatDate(batch.data?.expiryDate)} />
        <InfoTile label="Batch Size" value={String(batch.data?.batchSize ?? '—')} />
      </View>
      {ctx.lockState === 'LOCKED' && fgId ? (
        <NoticeBanner message="Inventory record created for this batch." tone="success" />
      ) : null}
      <Field
        label="Quantity"
        value={quantity}
        onChangeText={(v) => set({ quantity: num(v) })}
        keyboardType="numeric"
        editable={ctx.editable}
      />
      <DateField label="Transfer Date" value={transferDate || todayISO()} onChange={(v) => set({ transferDate: v })} disabled={!ctx.editable} />
      <DateField label="Received On" value={receivedOn || todayISO()} onChange={(v) => set({ receivedOn: v })} disabled={!ctx.editable} />
      <Field label="Storage Condition" value={storageCondition} onChangeText={(v) => set({ storageCondition: v })} editable={ctx.editable} />
    </Card>
  );
}
