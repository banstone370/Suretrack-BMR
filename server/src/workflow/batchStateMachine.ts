import { PRIMARY_BATCH_STATUSES } from '../config/constants.js';
import { BatchStatus } from '../types/enums.js';

export function batchProgressPercent(status: BatchStatus): number {
  if (status === BatchStatus.ON_HOLD || status === BatchStatus.REJECTED) {
    return 0;
  }
  if (status === BatchStatus.CANCELLED || status === BatchStatus.ARCHIVED) {
    return 0;
  }
  const index = PRIMARY_BATCH_STATUSES.indexOf(
    status as (typeof PRIMARY_BATCH_STATUSES)[number],
  );
  if (index < 0) return 0;
  return Math.round((index / (PRIMARY_BATCH_STATUSES.length - 1)) * 100);
}

export const TIMELINE_STAGES = [
  { key: 'RAW_MATERIAL_QC', label: 'Raw Material QC' },
  { key: 'MANUFACTURING', label: 'Manufacturing' },
  { key: 'IN_PROCESS_QC', label: 'In-Process QC' },
  { key: 'VISUAL_INSPECTION', label: 'Visual Inspection' },
  { key: 'PACKING', label: 'Packing' },
  { key: 'SEALING', label: 'Sealing' },
  { key: 'STERILIZATION', label: 'ETO Sterilization' },
  { key: 'LABELLING', label: 'Labelling' },
  { key: 'STERILITY_TEST', label: 'Sterility Test' },
  { key: 'BET_TEST', label: 'BET Test' },
  { key: 'QA_REVIEW', label: 'QA Release' },
  { key: 'FINISHED_GOODS', label: 'Finished Goods' },
  { key: 'DISPATCHED', label: 'Dispatch' },
] as const;

export function buildTimeline(status: BatchStatus) {
  const primaryIndex = PRIMARY_BATCH_STATUSES.indexOf(
    status as (typeof PRIMARY_BATCH_STATUSES)[number],
  );

  return TIMELINE_STAGES.map((stage) => {
    const stageIndex = PRIMARY_BATCH_STATUSES.indexOf(
      stage.key as (typeof PRIMARY_BATCH_STATUSES)[number],
    );
    let state: 'complete' | 'current' | 'upcoming' = 'upcoming';
    if (primaryIndex < 0) {
      state = 'upcoming';
    } else if (stageIndex < primaryIndex) {
      state = 'complete';
    } else if (stageIndex === primaryIndex) {
      state = 'current';
    }
    return { ...stage, state };
  });
}
