import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import RawMaterialScreen from '../../../../../src/features/stages/RawMaterialScreen';
import ManufacturingScreen from '../../../../../src/features/stages/ManufacturingScreen';
import InProcessQcScreen from '../../../../../src/features/stages/InProcessQcScreen';
import VisualInspectionScreen from '../../../../../src/features/stages/VisualInspectionScreen';
import PackingScreen from '../../../../../src/features/stages/PackingScreen';
import SealingScreen from '../../../../../src/features/stages/SealingScreen';
import SterilizationScreen from '../../../../../src/features/stages/SterilizationScreen';
import LabellingScreen from '../../../../../src/features/stages/LabellingScreen';
import LabTestScreen from '../../../../../src/features/stages/LabTestScreen';
import QaReviewScreen from '../../../../../src/features/stages/QaReviewScreen';
import FinishedGoodsScreen from '../../../../../src/features/stages/FinishedGoodsScreen';
import { EmptyState } from '../../../../../src/components/ui';

export default function StageRoute() {
  const { id, slug } = useLocalSearchParams<{ id: string; slug: string }>();
  const batchId = String(id ?? '');
  switch (slug) {
    case 'raw-material':
      return <RawMaterialScreen batchId={batchId} />;
    case 'manufacturing':
      return <ManufacturingScreen batchId={batchId} />;
    case 'qc':
      return <InProcessQcScreen batchId={batchId} />;
    case 'inspection':
      return <VisualInspectionScreen batchId={batchId} />;
    case 'packing':
      return <PackingScreen batchId={batchId} />;
    case 'sealing':
      return <SealingScreen batchId={batchId} />;
    case 'sterilization':
      return <SterilizationScreen batchId={batchId} />;
    case 'labelling':
      return <LabellingScreen batchId={batchId} />;
    case 'sterility':
      return <LabTestScreen batchId={batchId} kind="sterility" />;
    case 'bet':
      return <LabTestScreen batchId={batchId} kind="bet" />;
    case 'qa':
      return <QaReviewScreen batchId={batchId} />;
    case 'finished-goods':
      return <FinishedGoodsScreen batchId={batchId} />;
    default:
      return (
        <React.Fragment>
          <EmptyState text={`Unknown stage: ${slug}`} />
        </React.Fragment>
      );
  }
}
