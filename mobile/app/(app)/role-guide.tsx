import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Screen, SectionTitle, SelectField, Badge } from '../../src/components/ui';
import { useAuth } from '../../src/state/AuthContext';
import { colors } from '../../src/lib/theme';
import { ALL_ROLES, roleLabel } from '../../src/lib/format';

interface MobileRoleGuide {
  role: string;
  title: string;
  department: string;
  summary: string;
  responsibilities: string[];
  howToOperate: string[];
  /** What this role does at each workflow stage */
  stageDuties: Array<{ stage: string; duty: string }>;
  focusAreas: string[];
}

const WORKFLOW_STAGES = [
  'Raw Material QC',
  'Manufacturing',
  'In-Process QC',
  'Visual Inspection',
  'Packing',
  'Sealing',
  'ETO Sterilization',
  'Labelling',
  'Sterility Test',
  'BET Test',
  'QA Release',
  'Finished Goods',
  'Dispatch',
];

const ROLE_GUIDES: Record<string, MobileRoleGuide> = {
  ADMIN: {
    role: 'ADMIN',
    title: 'System Administrator',
    department: 'Administration',
    summary:
      'You configure the eBMR system, manage users and products, and oversee the full batch lifecycle. You do not usually perform shop-floor stage work, but you can access every module for support and compliance.',
    responsibilities: [
      'Create and maintain product masters and process templates',
      'Manage user accounts, roles, and access',
      'Maintain SOPs and system settings',
      'Review audit trail and reports for compliance',
      'Support teams when a batch is blocked or needs correction',
    ],
    howToOperate: [
      'Open Products to add or update catalogue items and process stages',
      'Open Users to invite employees and assign the correct role',
      'Use Settings for plant-wide defaults',
      'Monitor Dashboard and Audit Trail for system health and e-sign activity',
      'Use Reports to export CSV/PDF for management review',
    ],
    stageDuties: [
      { stage: 'System setup (before all stages)', duty: 'Create product catalogue, process template, SOPs, users, and settings' },
      { stage: 'All workflow stages', duty: 'Oversee every stage for support and compliance; unlock correction requests' },
      { stage: 'Exception handling', duty: 'Resolve ON HOLD blocks, cancel or archive records, restore access after fixes' },
      { stage: 'Governance (anytime)', duty: 'Review dashboard, inbox notifications, audit trail, and export reports' },
    ],
    focusAreas: ['Products', 'Users', 'Settings', 'Audit Trail', 'Reports'],
  },
  PRODUCTION_CHEMIST: {
    role: 'PRODUCTION_CHEMIST',
    title: 'Production Chemist',
    department: 'Production',
    summary:
      'You start manufacturing batches, issue raw materials after QC approval, and record manufacturing work. You own the early production stages of the eBMR.',
    responsibilities: [
      'Create new batches for approved products',
      'Issue raw materials once RM QC is approved',
      'Record manufacturing steps and quantities',
      'Submit production work for the next QC checkpoint',
      'Watch Inbox for batches waiting on production',
    ],
    howToOperate: [
      'Go to Batches → Create Batch (select product and batch size)',
      'After QC clears raw material, open the batch and issue materials',
      'Complete Manufacturing entries for the batch',
      'Submit so the batch moves to In-Process QC',
      'Use Inbox to jump to production tasks assigned to you',
    ],
    stageDuties: [
      { stage: 'Batch creation', duty: 'Create the batch from a product (status DRAFT) and start production' },
      { stage: 'Raw Material QC', duty: 'Issue / consume raw materials after QC approval (status MATERIAL ISSUED)' },
      { stage: 'Manufacturing', duty: 'Record manufacturing data and submit (batch moves to In-Process QC)' },
    ],
    focusAreas: ['Inbox', 'Batches', 'Products'],
  },
  QC_OFFICER: {
    role: 'QC_OFFICER',
    title: 'Quality Control Officer',
    department: 'Quality Control',
    summary:
      'You verify materials and product quality at critical checkpoints: raw material QC, in-process checks, visual inspection, sterility, and BET testing.',
    responsibilities: [
      'Inspect and approve (or reject) raw materials',
      'Perform in-process QC and visual inspection',
      'Record sterility and BET laboratory results',
      'Place a batch on hold if quality is at risk',
      'Use Inbox for QC work waiting on you',
    ],
    howToOperate: [
      'Open Inbox for batches in RM QC, IPQC, visual inspection, sterility, or BET',
      'On the batch page, complete checklists and e-sign where required',
      'Approve to advance the batch, or document failure / hold',
      'Review Audit Trail entries for your QC actions when needed',
    ],
    stageDuties: [
      { stage: 'Raw Material QC', duty: 'Run RM QC checks, then approve / reject with an e-signature' },
      { stage: 'In-Process QC', duty: 'Complete IPQC checklist after manufacturing' },
      { stage: 'Visual Inspection', duty: 'Inspect units visually; pass advances to Packing, fail documents hold/rejection' },
      { stage: 'Sterility Test', duty: 'Record sterility test result after labelling' },
      { stage: 'BET Test', duty: 'Record bacterial endotoxin test result; submit to QA Review' },
    ],
    focusAreas: ['Inbox', 'Batches', 'Audit Trail'],
  },
  PACKING_OPERATOR: {
    role: 'PACKING_OPERATOR',
    title: 'Packing Operator',
    department: 'Packing',
    summary:
      'You pack, seal, and label product after manufacturing and QC clearance. Accurate counts and seal parameters protect sterility later in the process.',
    responsibilities: [
      'Pack finished units into approved packaging',
      'Run sealing to SOP temperature / parameters',
      'Apply labelling after sterilization when required',
      'Confirm quantities match the batch record',
    ],
    howToOperate: [
      'Use Inbox for batches in Packing, Sealing, or Labelling',
      'Open the batch stage form and enter counts / parameters',
      'Follow the linked SOP references on each screen',
      'Submit the stage so the batch can move forward',
    ],
    stageDuties: [
      { stage: 'Packing', duty: 'Enter packing counts that match the batch record' },
      { stage: 'Sealing', duty: 'Record sealing temperature against the SOP parameters' },
      { stage: 'Labelling', duty: 'Apply labels after ETO sterilization and submit' },
    ],
    focusAreas: ['Inbox', 'Batches', 'SOPs'],
  },
  STERILIZATION_OPERATOR: {
    role: 'STERILIZATION_OPERATOR',
    title: 'Sterilization Operator',
    department: 'Sterilization',
    summary:
      'You run Ethylene Oxide (ETO) sterilization cycles and manage ETO cartridge inventory. Correct cycle parameters are critical to product safety.',
    responsibilities: [
      'Receive and track ETO cartridges',
      'Load sealed product and run the sterilization cycle',
      'Record temperature, duration, and cartridge used',
      'Complete the sterilization stage on the eBMR',
    ],
    howToOperate: [
      'Check ETO Cartridges for available stock and expiry',
      'Open Inbox for batches in Sterilization',
      'Enter cycle data and consume the cartridge on the batch form',
      'Submit so labelling / lab testing can continue',
    ],
    stageDuties: [
      { stage: 'ETO Sterilization', duty: 'Verify cartridge stock/expiry, run the ETO cycle, record parameters and consume the cartridge' },
    ],
    focusAreas: ['Inbox', 'Batches', 'ETO Cartridges'],
  },
  QA_APPROVER: {
    role: 'QA_APPROVER',
    title: 'Quality Assurance Approver',
    department: 'Quality Assurance',
    summary:
      'You perform the final quality review, release batches, transfer to finished goods, and can hold or cancel a batch when quality or documentation is incomplete.',
    responsibilities: [
      'Review the complete eBMR before release',
      'Approve release or return for correction',
      'Transfer released stock to Finished Goods',
      'Place batches on hold or cancel when justified',
      'Review audit history for release decisions',
    ],
    howToOperate: [
      'Open Inbox for QA Review / Released / On Hold items',
      'Walk through the batch stages and signatures',
      'Release the batch, then complete Finished Goods transfer',
      'Use Hold / Cancel only with a clear recorded reason',
    ],
    stageDuties: [
      { stage: 'QA Release', duty: 'Review the full eBMR and all signatures; release, hold, or request correction' },
      { stage: 'Finished Goods', duty: 'Transfer the released batch into finished-goods stock' },
    ],
    focusAreas: ['Inbox', 'Batches', 'Finished Goods', 'Audit Trail'],
  },
  DISPATCH_USER: {
    role: 'DISPATCH_USER',
    title: 'Dispatch User',
    department: 'Dispatch',
    summary:
      'You ship released finished goods to customers. Only stock that has passed QA release and finished-goods transfer should be dispatched.',
    responsibilities: [
      'Maintain customer records used on delivery notes',
      'Create dispatches from released finished goods',
      'Confirm quantities and destination',
      'Close the batch dispatch stage on the eBMR',
    ],
    howToOperate: [
      'Ensure Customers exist for the destination',
      'Check Finished Goods for available released stock',
      'Open Inbox / Batches for dispatch-ready work',
      'Create and confirm the dispatch document',
    ],
    stageDuties: [
      { stage: 'Dispatch', duty: 'Create a draft dispatch from available FG stock, then confirm it to deduct inventory' },
    ],
    focusAreas: ['Inbox', 'Finished Goods', 'Customers', 'Dispatch'],
  },
};

function Bullets({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((line) => (
        <Text key={line} style={styles.bullet}>
          • {line}
        </Text>
      ))}
    </View>
  );
}

export default function RoleGuidePage() {
  const { user } = useAuth();
  const [role, setRole] = useState<string>(user?.role ?? 'ADMIN');
  const guide = ROLE_GUIDES[role] ?? ROLE_GUIDES.ADMIN;

  return (
    <Screen>
      <Card>
        <SectionTitle>Role Guide</SectionTitle>
        <Text style={styles.sub}>
          What each role does across the 13-stage eBMR workflow. Static reference — no data is
          fetched.
        </Text>
        <SelectField
          label="View guide for role"
          value={role}
          options={ALL_ROLES.map((r) => ({ value: r, label: roleLabel(r) }))}
          onChange={setRole}
        />
        {user?.role === role ? <Badge text="Your role" tone="info" /> : null}
      </Card>

      <Card>
        <Text style={styles.title}>{guide.title}</Text>
        <Text style={styles.sub}>{guide.department}</Text>
        <Text style={styles.summary}>{guide.summary}</Text>
      </Card>

      <Card>
        <SectionTitle>Responsibilities</SectionTitle>
        <Bullets items={guide.responsibilities} />
      </Card>

      <Card>
        <SectionTitle>How to operate</SectionTitle>
        <Bullets items={guide.howToOperate} />
      </Card>

      <Card>
        <SectionTitle>At each workflow stage</SectionTitle>
        {guide.stageDuties.map((s) => (
          <View key={s.stage} style={styles.stageDuty}>
            <Badge text={s.stage} tone="info" />
            <Text style={styles.dutyText}>{s.duty}</Text>
          </View>
        ))}
        <Text style={styles.sub}>Focus areas: {guide.focusAreas.join(' · ')}</Text>
      </Card>

      <Card>
        <SectionTitle>Workflow order (13 stages)</SectionTitle>
        {WORKFLOW_STAGES.map((stage, i) => (
          <View key={stage} style={styles.stageRow}>
            <Text style={styles.stageIndex}>{i + 1}</Text>
            <Text style={styles.stageName}>{stage}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontWeight: '800', fontSize: 17, color: colors.text },
  sub: { color: colors.muted, fontSize: 13, marginTop: 3 },
  summary: { color: colors.text, fontSize: 14, marginTop: 8, lineHeight: 20 },
  bullet: { color: colors.text, fontSize: 14, marginVertical: 3, lineHeight: 20 },
  stageDuty: { marginBottom: 10, gap: 4 },
  dutyText: { color: colors.text, fontSize: 13, marginTop: 4 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  stageIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 26,
    textAlignVertical: 'center',
    overflow: 'hidden',
  },
  stageName: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
