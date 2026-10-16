import React, { useEffect } from 'react';
import StageFrame, { type StageCtx } from '../../components/StageFrame';
import { Button, Card, Field, NoticeBanner, SectionTitle } from '../../components/ui';
import { STAGE_DEFS } from '../../lib/stageDefs';

export default function QaReviewScreen({ batchId }: { batchId: string }) {
  return (
    <StageFrame batchId={batchId} def={STAGE_DEFS.qa}>
      {(ctx) => <Form ctx={ctx} />}
    </StageFrame>
  );
}

function Form({ ctx }: { ctx: StageCtx }) {
  const d = ctx.data;
  const reviewNotes = String(d.reviewNotes ?? '');

  useEffect(() => {
    ctx.registerValidate(() => {
      if (!reviewNotes.trim()) return 'Review notes are required before submit.';
      return null;
    });
  });

  return (
    <>
      <Card>
        <SectionTitle>QA Review</SectionTitle>
        <NoticeBanner message="Final compliance review before batch release." tone="info" />
        {ctx.lockState === 'LOCKED' || ctx.lockState === 'APPROVED' ? (
          <NoticeBanner message="QA decision is locked." tone="warning" />
        ) : null}
        <Field
          label="Review Notes"
          value={reviewNotes}
          onChangeText={(v) => ctx.setForm({ reviewNotes: v })}
          multiline
          editable={ctx.editable}
        />
      </Card>
      {ctx.canReject ? (
        <Card>
          <Button
            title="Place On Hold"
            variant="danger"
            onPress={() =>
              ctx.requestReject({
                decision: 'HOLD',
                title: 'Place Batch On Hold',
                confirmLabel: 'Place On Hold',
              })
            }
            loading={ctx.busy}
          />
        </Card>
      ) : null}
    </>
  );
}
