# SureTech Medical — eBMR Technical Specification

**Product:** Electronic Batch Manufacturing Record / Batch Record Management System  
**Reference BMR:** INTRODUCER NEEDLE (5-page paper BMR)  
**Stack:** MERN (MongoDB, Express, React, Node.js) + TypeScript  
**Version:** 1.0  
**Status:** Implementation-ready specification

---

## 1. Goals & Non-Goals

### Goals
- Workflow-driven eBMR for medical-device batch manufacturing
- Role-based stage ownership with approvals and audit trail
- Product-template driven (Introducer Needle first; extensible)
- Generate printable BMR PDF resembling the source document
- Full batch genealogy (raw material → FG → dispatch)

### Non-Goals (v1)
- Multi-tenant SaaS
- ERP/accounting integration
- Barcode/QR hardware integration (v2)
- WhatsApp/SMS notifications (v2)
- Hard-delete of batch records

---

## 2. Monorepo Folder Structure

```
Suretrack-BMR/
├── client/                          # React + Vite + TypeScript
│   ├── public/
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.tsx
│   │   │   ├── router.tsx
│   │   │   └── providers.tsx
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── ui/                  # shadcn/ui primitives
│   │   │   ├── layout/
│   │   │   │   ├── AppShell.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── TopBar.tsx
│   │   │   ├── batch/
│   │   │   │   ├── BatchStatusBadge.tsx
│   │   │   │   ├── BatchProgress.tsx
│   │   │   │   ├── ProcessTimeline.tsx
│   │   │   │   └── StageGate.tsx
│   │   │   ├── forms/
│   │   │   │   ├── ElectronicSignature.tsx
│   │   │   │   └── ApprovalActions.tsx
│   │   │   ├── tables/
│   │   │   └── common/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── batches/
│   │   │   ├── production/
│   │   │   ├── qc/
│   │   │   ├── packing/
│   │   │   ├── sterilization/
│   │   │   ├── labelling/
│   │   │   ├── lab/
│   │   │   ├── qa/
│   │   │   ├── inventory/
│   │   │   ├── dispatch/
│   │   │   ├── products/
│   │   │   ├── raw-materials/
│   │   │   ├── eto-cartridges/
│   │   │   ├── sops/
│   │   │   ├── customers/
│   │   │   ├── users/
│   │   │   ├── reports/
│   │   │   ├── audit/
│   │   │   └── settings/
│   │   ├── hooks/
│   │   ├── lib/
│   │   │   ├── api.ts               # Axios instance
│   │   │   ├── queryClient.ts
│   │   │   ├── auth.ts
│   │   │   └── utils.ts
│   │   ├── types/
│   │   ├── schemas/                 # Zod schemas (shared with forms)
│   │   ├── styles/
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.ts
│
├── server/                          # Node + Express + TypeScript
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.ts
│   │   │   ├── db.ts
│   │   │   └── constants.ts
│   │   ├── models/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── routes/
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── rbac.ts
│   │   │   ├── validate.ts
│   │   │   ├── audit.ts
│   │   │   ├── rateLimit.ts
│   │   │   └── errorHandler.ts
│   │   ├── validators/
│   │   ├── workflow/
│   │   │   ├── batchStateMachine.ts
│   │   │   ├── stageGuards.ts
│   │   │   └── permissions.ts
│   │   ├── audit/
│   │   │   └── auditLogger.ts
│   │   ├── pdf/
│   │   │   └── bmrGenerator.ts
│   │   ├── utils/
│   │   ├── types/
│   │   ├── app.ts
│   │   └── server.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── shared/                          # Optional shared types/enums
│   ├── src/
│   │   ├── enums.ts
│   │   ├── statuses.ts
│   │   └── permissions.ts
│   └── package.json
│
├── TECHNICAL_SPECIFICATION.md
├── package.json                     # Workspaces root (optional)
└── README.md
```

---

## 3. Roles & Permissions Matrix

### 3.1 Roles

| Role Code | Display Name |
|-----------|--------------|
| `ADMIN` | Admin |
| `PRODUCTION_CHEMIST` | Production Chemist |
| `QC_OFFICER` | QC Officer |
| `PACKING_OPERATOR` | Packing Operator |
| `STERILIZATION_OPERATOR` | Sterilization Operator |
| `QA_APPROVER` | QA / Approver |
| `DISPATCH_USER` | Dispatch User |

### 3.2 Permission Keys

```
users:manage
products:manage
sops:manage
rawMaterials:manage
system:configure
audit:view
batches:view_all
batches:create
batches:edit_production
batches:submit_production
rm_qc:edit
rm_qc:approve
rm_consumption:edit
manufacturing:edit
ipqc:edit
visual_inspection:edit
packing:edit
sealing:edit
sterilization:edit
eto_cartridge:manage
labelling:edit
sterility:edit
bet:edit
qa:review
qa:release
finished_goods:transfer
dispatch:create
dispatch:confirm
batch:hold
batch:cancel
batch:request_correction
reports:view
pdf:generate
```

### 3.3 Role → Permission Map

| Permission | ADMIN | PROD | QC | PACK | STER | QA | DISP |
|------------|:-----:|:----:|:--:|:----:|:----:|:--:|:----:|
| users:manage | ✓ | | | | | | |
| products:manage | ✓ | | | | | | |
| sops:manage | ✓ | | | | | | |
| rawMaterials:manage | ✓ | | | | | | |
| system:configure | ✓ | | | | | | |
| audit:view | ✓ | | ✓ | | | ✓ | |
| batches:view_all | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| batches:create | ✓ | ✓ | | | | | |
| batches:edit_production | ✓ | ✓ | | | | | |
| batches:submit_production | ✓ | ✓ | | | | | |
| rm_qc:edit | ✓ | | ✓ | | | | |
| rm_qc:approve | ✓ | | ✓ | | | | |
| rm_consumption:edit | ✓ | ✓ | | | | | |
| manufacturing:edit | ✓ | ✓ | | | | | |
| ipqc:edit | ✓ | | ✓ | | | | |
| visual_inspection:edit | ✓ | | ✓ | | | | |
| packing:edit | ✓ | | | ✓ | | | |
| sealing:edit | ✓ | | | ✓ | | | |
| sterilization:edit | ✓ | | | | ✓ | | |
| eto_cartridge:manage | ✓ | | | | ✓ | | |
| labelling:edit | ✓ | | | ✓ | | | |
| sterility:edit | ✓ | | ✓ | | | | |
| bet:edit | ✓ | | ✓ | | | | |
| qa:review | ✓ | | | | | ✓ | |
| qa:release | ✓ | | | | | ✓ | |
| finished_goods:transfer | ✓ | | | | | ✓ | |
| dispatch:create | ✓ | | | | | | ✓ |
| dispatch:confirm | ✓ | | | | | | ✓ |
| batch:hold | ✓ | | ✓ | | | ✓ | |
| batch:cancel | ✓ | | | | | ✓ | |
| batch:request_correction | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| reports:view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| pdf:generate | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

**Rule:** Frontend hides unauthorized actions; backend enforces every mutation with RBAC middleware. Hiding a button is not security.

---

## 4. Batch Status State Machine

### 4.1 Primary States (ordered)

```
DRAFT
RAW_MATERIAL_QC
RAW_MATERIAL_APPROVED
MATERIAL_ISSUED
MANUFACTURING
IN_PROCESS_QC
VISUAL_INSPECTION
PACKING
SEALING
STERILIZATION
LABELLING
STERILITY_TEST
BET_TEST
QA_REVIEW
RELEASED
FINISHED_GOODS
DISPATCHED
```

### 4.2 Exception States

```
ON_HOLD
REJECTED
CANCELLED
ARCHIVED
```

### 4.3 Allowed Transitions

| From | To | Trigger | Required Role |
|------|-----|---------|---------------|
| DRAFT | RAW_MATERIAL_QC | Start production | PRODUCTION_CHEMIST, ADMIN |
| RAW_MATERIAL_QC | RAW_MATERIAL_APPROVED | RM QC approve (all checks Pass) | QC_OFFICER, ADMIN |
| RAW_MATERIAL_QC | REJECTED | RM QC reject | QC_OFFICER, ADMIN |
| RAW_MATERIAL_APPROVED | MATERIAL_ISSUED | Consumption submitted | PRODUCTION_CHEMIST, ADMIN |
| MATERIAL_ISSUED | MANUFACTURING | Manufacturing started | PRODUCTION_CHEMIST, ADMIN |
| MANUFACTURING | IN_PROCESS_QC | Manufacturing verified | PRODUCTION_CHEMIST, ADMIN |
| IN_PROCESS_QC | VISUAL_INSPECTION | IPQC approved | QC_OFFICER, ADMIN |
| VISUAL_INSPECTION | PACKING | Inspection completed | QC_OFFICER, ADMIN |
| PACKING | SEALING | Packing completed | PACKING_OPERATOR, ADMIN |
| SEALING | STERILIZATION | Sealing completed | PACKING_OPERATOR, ADMIN |
| STERILIZATION | LABELLING | Sterilization completed + checked | STERILIZATION_OPERATOR, ADMIN |
| LABELLING | STERILITY_TEST | Labelling completed | PACKING_OPERATOR, ADMIN |
| STERILITY_TEST | BET_TEST | Sterility Pass | QC_OFFICER, ADMIN |
| STERILITY_TEST | REJECTED | Sterility Fail | QC_OFFICER, ADMIN |
| BET_TEST | QA_REVIEW | BET Pass | QC_OFFICER, ADMIN |
| BET_TEST | REJECTED | BET Fail | QC_OFFICER, ADMIN |
| QA_REVIEW | RELEASED | QA release | QA_APPROVER, ADMIN |
| QA_REVIEW | ON_HOLD | QA hold | QA_APPROVER, ADMIN |
| QA_REVIEW | REJECTED | QA reject | QA_APPROVER, ADMIN |
| RELEASED | FINISHED_GOODS | FG transfer | QA_APPROVER, ADMIN |
| FINISHED_GOODS | DISPATCHED | Full/partial dispatch (when qty=0 remaining → DISPATCHED; partial stays FINISHED_GOODS) | DISPATCH_USER, ADMIN |
| * (non-terminal) | ON_HOLD | Hold | QC_OFFICER, QA_APPROVER, ADMIN |
| ON_HOLD | *(previous)* | Resume | QA_APPROVER, ADMIN |
| * (non-terminal, non-DISPATCHED) | CANCELLED | Cancel | ADMIN, QA_APPROVER |
| REJECTED / CANCELLED | ARCHIVED | Archive | ADMIN |

### 4.4 Locking Rules
- After stage **Approve/Submit**, stage document becomes `locked: true`.
- Corrections require `requestCorrection` → authorized unlock → new `revision` + audit entry.
- Hard delete of batches is forbidden. Use `CANCELLED` / `ARCHIVED` / `VOID` on related records.

### 4.5 Progress Percent (UI)

```
progressPercent = (completedPrimaryStages / 16) * 100
```

Primary stages for progress: DRAFT→…→DISPATCHED path excluding exception states (16 transitions / 17 statuses — use index of current status in primary list).

---

## 5. MongoDB Collections & Schemas

### 5.1 Design Notes
- **Batch** is the aggregate root.
- Stage data may be **embedded** in `batches` for MVP speed, or **referenced** collections for scale. Spec below uses **hybrid**: core identity on `batches`; each stage as subdocument OR separate collection with `batchId`. Recommended for Phase 1–3: **embedded stage subdocuments** on `batches` + separate collections for master data, audit, inventory, ETO cartridges.
- All timestamps: ISO Date (UTC). Display locale: `dd-MM-yyyy` / `HH:mm`.
- Soft fields on all domain docs: `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `isDeleted` (false only; prefer status over delete).

### 5.2 Enums

```ts
enum Role {
  ADMIN = 'ADMIN',
  PRODUCTION_CHEMIST = 'PRODUCTION_CHEMIST',
  QC_OFFICER = 'QC_OFFICER',
  PACKING_OPERATOR = 'PACKING_OPERATOR',
  STERILIZATION_OPERATOR = 'STERILIZATION_OPERATOR',
  QA_APPROVER = 'QA_APPROVER',
  DISPATCH_USER = 'DISPATCH_USER',
}

enum BatchStatus {
  DRAFT = 'DRAFT',
  RAW_MATERIAL_QC = 'RAW_MATERIAL_QC',
  RAW_MATERIAL_APPROVED = 'RAW_MATERIAL_APPROVED',
  MATERIAL_ISSUED = 'MATERIAL_ISSUED',
  MANUFACTURING = 'MANUFACTURING',
  IN_PROCESS_QC = 'IN_PROCESS_QC',
  VISUAL_INSPECTION = 'VISUAL_INSPECTION',
  PACKING = 'PACKING',
  SEALING = 'SEALING',
  STERILIZATION = 'STERILIZATION',
  LABELLING = 'LABELLING',
  STERILITY_TEST = 'STERILITY_TEST',
  BET_TEST = 'BET_TEST',
  QA_REVIEW = 'QA_REVIEW',
  RELEASED = 'RELEASED',
  FINISHED_GOODS = 'FINISHED_GOODS',
  DISPATCHED = 'DISPATCHED',
  ON_HOLD = 'ON_HOLD',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  ARCHIVED = 'ARCHIVED',
}

enum CheckResult { PASS = 'PASS', FAIL = 'FAIL', NA = 'NA' }
enum TestResult { PASS = 'PASS', FAIL = 'FAIL', PENDING = 'PENDING' }
enum ProcessStatus { NOT_STARTED = 'NOT_STARTED', IN_PROGRESS = 'IN_PROGRESS', COMPLETED = 'COMPLETED', VERIFIED = 'VERIFIED' }
enum ApprovalDecision { APPROVED = 'APPROVED', REJECTED = 'REJECTED', HOLD = 'HOLD' }
enum RecordLockState { OPEN = 'OPEN', SUBMITTED = 'SUBMITTED', APPROVED = 'APPROVED', LOCKED = 'LOCKED' }
```

### 5.3 `users`

| Field | Type | Notes |
|-------|------|-------|
| _id | ObjectId | |
| employeeId | string | unique, e.g. `QC-014` |
| name | string | |
| email | string | unique |
| passwordHash | string | argon2/bcrypt |
| role | Role | |
| department | string | optional |
| isActive | boolean | default true |
| lastLoginAt | Date | |
| createdAt / updatedAt | Date | |

Indexes: `email`, `employeeId`, `role`

### 5.4 `products`

| Field | Type | Notes |
|-------|------|-------|
| _id | ObjectId | |
| name | string | e.g. INTRODUCER NEEDLE |
| catalogueNo | string | unique, e.g. IN-001 |
| description | string | |
| defaultBatchSize | number | optional |
| shelfLifeMonths | number | e.g. 60 for 5 years |
| processTemplateId | ObjectId | ref processTemplates |
| isActive | boolean | |
| createdAt / updatedAt | Date | |

### 5.5 `processTemplates` (product-template driven)

| Field | Type | Notes |
|-------|------|-------|
| _id | ObjectId | |
| productId | ObjectId | |
| name | string | |
| version | number | |
| stages | StageTemplate[] | ordered |
| sealingParams | { temperatureC: number, sopRef: string, allowedRange?: {min,max} } | from SOP |
| sterilizationParams | { temperatureC, durationHours, etoCartridgeGrams, sopRef } | e.g. 55°C, 4h, 40g, SOP/MF/008 |
| storageCondition | string | e.g. Store at Room Temperature |
| rmQcChecks | string[] | Hub checking, Bevel checking, … |
| ipqcChecks | string[] | Dust free, Burr free, … |
| isActive | boolean | |

**Introducer Needle seed template values:**
- Sealing: `200°C`, SOP/MF/011
- ETO: `55°C`, `4` hours, `40` g cartridge, SOP/MF/008
- Sterility SOP: SOP/QC/004
- BET SOP: SOP/QC/005
- RM QC processes: Hub checking, Bevel checking, Guide wire passing, Visual inspection for dust/burrs/foreign particles
- IPQC: Dust free, Burr free, Foreign particle free

### 5.6 `batches` (central document)

| Field | Type | Notes |
|-------|------|-------|
| _id | ObjectId | |
| batchNo | string | unique, e.g. IN26091401 |
| productId | ObjectId | |
| productName | string | denormalized |
| catalogueNo | string | denormalized |
| batchSize | number | |
| manufacturingDate | Date | |
| expiryDate | Date | |
| status | BatchStatus | |
| previousStatus | BatchStatus | for resume from ON_HOLD |
| statusHistory | { status, at, by, reason? }[] | |
| templateVersion | number | snapshot |
| processParamsSnapshot | object | sealing/sterilization params frozen at creation |
| stages | BatchStages | embedded (see below) |
| currentRevision | number | default 1 |
| holdReason | string | |
| rejectReason | string | |
| createdBy | ObjectId | |
| createdAt / updatedAt | Date | |

**Indexes:** `batchNo` unique, `status`, `productId`, `manufacturingDate`, text index on `batchNo`, `catalogueNo`, `productName`

#### Embedded `stages` shape

```ts
interface SignatureBlock {
  userId: ObjectId;
  name: string;
  employeeId: string;
  signedAt: Date;
  method: 'PASSWORD' | 'PIN'; // auth confirmation
  statement?: string;
}

interface BatchStages {
  rawMaterialQc: RawMaterialQcStage;
  rawMaterialConsumption: MaterialConsumptionStage;
  manufacturing: ManufacturingStage;
  inProcessQc: InProcessQcStage;
  visualInspection: VisualInspectionStage;
  packing: PackingStage;
  sealing: SealingStage;
  sterilization: SterilizationStage;
  labelling: LabellingStage;
  sterilityTest: SterilityTestStage;
  betTest: BetTestStage;
  qaReview: QaReviewStage;
  finishedGoods: FinishedGoodsStage;
}
```

### 5.7 Stage Field Specifications (exact form fields)

#### A. Raw Material QC (`stages.rawMaterialQc`)

| Field | Type | Validation |
|-------|------|------------|
| lockState | RecordLockState | |
| checks | array | min 1 |
| checks[].process | string | from template |
| checks[].processDate | Date | required on submit |
| checks[].startTime | string (HH:mm) | |
| checks[].endTime | string (HH:mm) | end ≥ start same day or documented |
| checks[].observation | string | |
| checks[].result | CheckResult | PASS/FAIL/NA (app enhancement) |
| checks[].doneBy | SignatureBlock | |
| checks[].checkedBy | SignatureBlock | |
| overallResult | CheckResult | derived |
| submittedAt | Date | |
| approvedAt | Date | |
| approvedBy | SignatureBlock | |

#### B. Raw Material Consumption (`stages.rawMaterialConsumption`)

| Field | Type | Validation |
|-------|------|------------|
| lockState | RecordLockState | |
| lines | array | |
| lines[].rawMaterialId | ObjectId | |
| lines[].rawMaterialName | string | |
| lines[].supplierBatchNo | string | |
| lines[].qualityCheckedDate | Date | |
| lines[].quantityWithdrawn | number | > 0 |
| lines[].unit | string | |
| lines[].requirementSlipNo | string | |
| lines[].doneBy | SignatureBlock | |
| lines[].checkedBy | SignatureBlock | |
| submittedAt | Date | |

Also mirrored to collection `materialConsumptions` for genealogy queries.

#### C. Manufacturing (`stages.manufacturing`)

| Field | Type | Validation |
|-------|------|------------|
| lockState | RecordLockState | |
| process | string | default: "Needles made Ready for Sterilization" |
| processDate | Date | |
| startTime | string | |
| endTime | string | |
| status | ProcessStatus | |
| operator | SignatureBlock | |
| remarks | string | |
| verifiedBy | SignatureBlock | optional |

#### D. In-Process QC (`stages.inProcessQc`)

| Field | Type | Validation |
|-------|------|------------|
| lockState | RecordLockState | |
| dustFree | boolean | |
| burrFree | boolean | |
| foreignParticleFree | boolean | |
| observation | string | |
| doneBy | SignatureBlock | |
| qcCheckedBy | SignatureBlock | |
| result | CheckResult | |

#### E. Visual Inspection (`stages.visualInspection`)

| Field | Type | Validation |
|-------|------|------------|
| lockState | RecordLockState | |
| unitsChecked | number | ≥ 0 integer |
| particlesFound | number | ≥ 0; **≤ unitsChecked** |
| particlesFoundPercent | number | computed server-side |
| inspectionDate | Date | |
| startTime | string | |
| endTime | string | |
| doneBy | SignatureBlock | |
| checkedBy | SignatureBlock | |

```
particlesFoundPercent = (particlesFound / unitsChecked) * 100
```

#### F. Packing (`stages.packing`)

| Field | Type | Validation |
|-------|------|------------|
| lockState | RecordLockState | |
| pouchesTaken | number | ≥ 0 |
| devicesPacked | number | ≥ 0 |
| pouchesDamaged | number | ≥ 0; ≤ pouchesTaken |
| goodPouches | number | computed: pouchesTaken - pouchesDamaged |
| packingDate | Date | |
| operator | SignatureBlock | |
| checker | SignatureBlock | |
| remarks | string | |

#### G. Sealing (`stages.sealing`)

| Field | Type | Validation |
|-------|------|------------|
| lockState | RecordLockState | |
| configuredTemperatureC | number | from template snapshot; **read-only UI** |
| actualTemperatureC | number | operator records actual |
| sopRef | string | e.g. SOP/MF/011; read-only from snapshot |
| devicesSealed | number | ≥ 0 |
| sealingDate | Date | |
| startTime | string | |
| endTime | string | |
| operator | SignatureBlock | |
| checker | SignatureBlock | |

If template defines `allowedRange`, validate `actualTemperatureC` within range; else warn / require reason for deviation (configurable).

#### H. Sterilization / ETO (`stages.sterilization`)

| Field | Type | Validation |
|-------|------|------------|
| lockState | RecordLockState | |
| configuredTemperatureC | number | 55 (snapshot) |
| requiredDurationHours | number | 4 |
| etoCartridgeGrams | number | 40 |
| sopRef | string | SOP/MF/008 |
| quantity | number | |
| startDate | Date | |
| startTime | string | |
| endDate | Date | |
| endTime | string | |
| expectedEndAt | Date | computed: start + duration |
| machineId | string | |
| etoCartridgeId | ObjectId | ref etoCartridges |
| operator | SignatureBlock | |
| checkedBy | SignatureBlock | |
| remarks | string | |
| cycleStatus | ProcessStatus | |

#### I. Labelling (`stages.labelling`)

| Field | Type | Validation |
|-------|------|------------|
| lockState | RecordLockState | |
| labelsPrinted | number | ≥ 0 |
| labelsUsed | number | ≥ 0; **≤ labelsPrinted** unless override |
| labelsDestroyed | number | ≥ 0 |
| devicesLabelled | number | ≥ 0 |
| overrideReason | string | required if labelsUsed > labelsPrinted |
| printedBy | SignatureBlock | |
| checkedBy | SignatureBlock | |
| doneOn | Date | |

#### J. Sterility Test (`stages.sterilityTest`)

| Field | Type | Validation |
|-------|------|------------|
| lockState | RecordLockState | |
| sopRef | string | SOP/QC/004 |
| testDate | Date | |
| reportNo | string | |
| result | TestResult | controlled enum |
| reportingDate | Date | |
| startTime | string | |
| endTime | string | |
| testedBy | SignatureBlock | |
| checkedBy | SignatureBlock | |
| attachmentIds | ObjectId[] | optional |

#### K. BET Test (`stages.betTest`)

Same shape as Sterility; `sopRef` = SOP/QC/005.

#### L. QA Review (`stages.qaReview`)

| Field | Type | Validation |
|-------|------|------------|
| lockState | RecordLockState | |
| decision | ApprovalDecision | |
| reviewNotes | string | |
| reviewedBy | SignatureBlock | |
| reviewedAt | Date | |
| releaseStatement | string | fixed confirmation text |

#### M. Finished Goods Transfer (`stages.finishedGoods`)

| Field | Type | Validation |
|-------|------|------------|
| lockState | RecordLockState | |
| quantity | number | ≤ batchSize / packed qty rules |
| transferDate | Date | |
| receivedOn | Date | |
| expiryDate | Date | from batch |
| storageCondition | string | from snapshot |
| transferredBy | SignatureBlock | |
| approvedBy | SignatureBlock | |
| finishedGoodsId | ObjectId | created inventory record |

### 5.8 `rawMaterials`

| Field | Type | Notes |
|-------|------|-------|
| _id | ObjectId | |
| name | string | |
| code | string | unique |
| unit | string | |
| description | string | |
| isActive | boolean | |

### 5.9 `rawMaterialLots`

| Field | Type | Notes |
|-------|------|-------|
| _id | ObjectId | |
| rawMaterialId | ObjectId | |
| supplierBatchNo | string | |
| supplierName | string | |
| receivedDate | Date | |
| expiryDate | Date | |
| quantity | number | |
| quantityRemaining | number | |
| qualityStatus | CheckResult | |
| qualityCheckedOn | Date | |

### 5.10 `materialConsumptions`

| Field | Type | Notes |
|-------|------|-------|
| batchId | ObjectId | |
| rawMaterialId | ObjectId | |
| rawMaterialLotId | ObjectId | optional |
| supplierBatchNo | string | |
| qualityCheckedDate | Date | |
| quantityWithdrawn | number | |
| unit | string | |
| requirementSlipNo | string | |
| doneBy | ObjectId | |
| checkedBy | ObjectId | |
| createdAt | Date | |

### 5.11 `etoCartridges`

| Field | Type | Notes |
|-------|------|-------|
| cartridgeBatchNo | string | unique |
| manufacturer | string | |
| receivedDate | Date | |
| expiryDate | Date | |
| quantityGrams | number | |
| quantityRemainingGrams | number | |
| status | AVAILABLE / RESERVED / USED / EXPIRED / QUARANTINE | |
| usedForBatchId | ObjectId | |
| usedDate | Date | |

### 5.12 `finishedGoods`

| Field | Type | Notes |
|-------|------|-------|
| batchId | ObjectId | unique |
| batchNo | string | |
| productId | ObjectId | |
| quantityAvailable | number | |
| quantityReserved | number | |
| quantityDispatched | number | |
| receivedOn | Date | |
| expiryDate | Date | |
| storageCondition | string | |
| status | AVAILABLE / DEPLETED / QUARANTINE | |

### 5.13 `customers`

| Field | Type | Notes |
|-------|------|-------|
| name | string | |
| code | string | |
| address | string | |
| contact | string | |
| isActive | boolean | |

### 5.14 `dispatches`

| Field | Type | Notes |
|-------|------|-------|
| batchId | ObjectId | |
| finishedGoodsId | ObjectId | |
| customerId | ObjectId | |
| customerName | string | denormalized |
| dispatchDate | Date | |
| billNo | string | |
| quantity | number | ≤ available |
| dispatchedBy | SignatureBlock | |
| checkedBy | SignatureBlock | |
| confirmedAt | Date | |
| status | DRAFT / CONFIRMED / CANCELLED | |

### 5.15 `sops`

| Field | Type | Notes |
|-------|------|-------|
| sopNo | string | e.g. SOP/MF/008 |
| title | string | |
| version | string | |
| effectiveDate | Date | |
| documentUrl | string | |
| status | DRAFT / APPROVED / SUPERSEDED | |
| approvedBy | ObjectId | |

### 5.16 `approvals`

| Field | Type | Notes |
|-------|------|-------|
| batchId | ObjectId | |
| stage | string | |
| decision | ApprovalDecision | |
| decidedBy | SignatureBlock | |
| reason | string | |
| createdAt | Date | |

### 5.17 `auditLogs`

| Field | Type | Notes |
|-------|------|-------|
| actorUserId | ObjectId | |
| actorEmployeeId | string | |
| actorName | string | |
| action | string | e.g. UPDATE_VISUAL_INSPECTION |
| entityType | string | Batch, Dispatch, … |
| entityId | ObjectId | |
| batchId | ObjectId | optional indexed |
| oldValue | Mixed | |
| newValue | Mixed | |
| reason | string | |
| ip | string | |
| userAgent | string | |
| sessionId | string | |
| createdAt | Date | |

**Never overwrite without audit.** Prefer append-only audit collection.

### 5.18 `notifications`

| Field | Type | Notes |
|-------|------|-------|
| userId | ObjectId | |
| type | string | |
| title | string | |
| body | string | |
| batchId | ObjectId | |
| isRead | boolean | |
| createdAt | Date | |

### 5.19 `correctionRequests`

| Field | Type | Notes |
|-------|------|-------|
| batchId | ObjectId | |
| stage | string | |
| requestedBy | ObjectId | |
| reason | string | required |
| status | PENDING / APPROVED / REJECTED | |
| resolvedBy | ObjectId | |
| resolvedAt | Date | |
| newRevision | number | |

---

## 6. API Endpoints

Base URL: `/api/v1`  
Auth: `Authorization: Bearer <accessToken>`  
Content-Type: `application/json`

### 6.1 Auth

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | `/auth/login` | Public | email/password → access + refresh |
| POST | `/auth/refresh` | Public (refresh cookie/token) | new access token |
| POST | `/auth/logout` | Auth | invalidate refresh |
| GET | `/auth/me` | Auth | current user + permissions |
| POST | `/auth/e-sign` | Auth | verify password/PIN for signature |

### 6.2 Users (ADMIN)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | list/filter |
| POST | `/users` | create |
| GET | `/users/:id` | detail |
| PATCH | `/users/:id` | update |
| POST | `/users/:id/deactivate` | soft deactivate |

### 6.3 Products & Templates

| Method | Path | Description |
|--------|------|-------------|
| GET | `/products` | list |
| POST | `/products` | create |
| GET | `/products/:id` | detail |
| PATCH | `/products/:id` | update |
| GET | `/products/:id/template` | process template |
| PUT | `/products/:id/template` | upsert template |

### 6.4 Batches

| Method | Path | Description |
|--------|------|-------------|
| GET | `/batches` | list + filters (product, batchNo, date, status, department, operator, customer) |
| POST | `/batches` | create (status=DRAFT) |
| GET | `/batches/:batchId` | full batch + stages |
| PATCH | `/batches/:batchId` | update header while DRAFT |
| POST | `/batches/:batchId/start` | DRAFT → RAW_MATERIAL_QC |
| POST | `/batches/:batchId/hold` | → ON_HOLD |
| POST | `/batches/:batchId/resume` | ON_HOLD → previous |
| POST | `/batches/:batchId/cancel` | → CANCELLED |
| GET | `/batches/:batchId/timeline` | process timeline |
| GET | `/batches/:batchId/audit` | audit for batch |
| GET | `/batches/:batchId/pdf` | generate BMR PDF |
| POST | `/batches/:batchId/corrections` | request correction |
| POST | `/batches/:batchId/corrections/:id/resolve` | approve/reject unlock |

### 6.5 Stage Endpoints (pattern)

For each stage key below:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/batches/:batchId/{stage}` | get stage |
| PUT | `/batches/:batchId/{stage}` | save draft (role-gated) |
| POST | `/batches/:batchId/{stage}/submit` | submit + e-sign |
| POST | `/batches/:batchId/{stage}/approve` | approve (where applicable) |
| POST | `/batches/:batchId/{stage}/reject` | reject |

**Stage path segments:**

| Segment | Stage |
|---------|-------|
| `raw-material-qc` | Raw Material QC |
| `raw-material-consumption` | Consumption |
| `manufacturing` | Manufacturing |
| `in-process-qc` | In-Process QC |
| `visual-inspection` | Visual Inspection |
| `packing` | Packing |
| `sealing` | Sealing |
| `sterilization` | ETO Sterilization |
| `labelling` | Labelling |
| `sterility` | Sterility Test |
| `bet` | BET Test |
| `qa` | QA Review / Release |
| `finished-goods` | FG Transfer |
| `dispatch` | list dispatches for batch |

Submit/approve handlers advance the state machine when guards pass.

### 6.6 Master / Inventory / Other

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| CRUD | `/raw-materials` | ADMIN (+ view others) | master |
| CRUD | `/raw-material-lots` | ADMIN / QC | lots |
| GET/POST/PATCH | `/eto-cartridges` | ADMIN / STER | cartridge inventory |
| POST | `/eto-cartridges/:id/assign` | STER | assign to batch cycle |
| CRUD | `/sops` | ADMIN | SOP docs |
| CRUD | `/customers` | ADMIN / DISP | customers |
| GET | `/inventory/finished-goods` | Auth | FG stock |
| GET | `/inventory/finished-goods/:id` | Auth | detail |
| POST | `/dispatches` | DISP | create dispatch |
| POST | `/dispatches/:id/confirm` | DISP | confirm + decrement stock |
| GET | `/dispatches` | Auth | list/filter |
| GET | `/dashboard/summary` | Auth | KPI cards |
| GET | `/dashboard/recent-batches` | Auth | recent table |
| GET | `/search?q=` | Auth | global search |
| GET | `/reports/:type` | reports:view | production/qc/sterilization/fg/dispatch |
| GET | `/audit-logs` | audit:view | global audit |
| GET | `/notifications` | Auth | in-app |
| PATCH | `/notifications/:id/read` | Auth | mark read |

### 6.7 Standard Response Shape

```json
{
  "success": true,
  "data": {},
  "meta": { "page": 1, "limit": 20, "total": 100 }
}
```

Errors:

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions",
    "details": []
  }
}
```

---

## 7. Workflow Guards (Server)

Implemented in `workflow/stageGuards.ts`:

1. User has permission for stage action.
2. Batch status matches expected status for that stage.
3. Stage `lockState` is OPEN (or unlocked via approved correction).
4. Zod schema validation passes.
5. Business rules:
   - Visual: `particlesFound ≤ unitsChecked`
   - Packing: `pouchesDamaged ≤ pouchesTaken`
   - Labelling: `labelsUsed ≤ labelsPrinted` OR `overrideReason` present + elevated permission
   - Sterilization: cartridge available, not expired; duration/temperature config from snapshot
   - Dispatch: `quantity ≤ finishedGoods.quantityAvailable`
6. E-sign verification succeeds for submit/approve.
7. Transition recorded in `statusHistory` + `auditLogs`.
8. Notifications emitted to next-role inbox.

---

## 8. Electronic Signature Contract

Request body for submit/approve:

```json
{
  "payload": { /* stage fields */ },
  "signature": {
    "password": "••••••",
    "statement": "I confirm that I have reviewed this record."
  },
  "reason": "optional change reason"
}
```

Server verifies credentials, stamps:

```json
{
  "userId": "...",
  "name": "Rahul Sharma",
  "employeeId": "QC-014",
  "signedAt": "2026-09-14T11:45:23.000Z",
  "method": "PASSWORD",
  "statement": "I confirm that I have reviewed this record."
}
```

**Note:** Validate e-signature requirements against applicable regulations/SOPs before production go-live. This design is application-ready scaffolding, not a compliance certification.

---

## 9. Frontend Page Structure

### 9.1 Routes

| Path | Page | Roles |
|------|------|-------|
| `/login` | Login | Public |
| `/dashboard` | Dashboard KPIs + recent batches | All |
| `/batches` | Batch list + filters | All |
| `/batches/create` | Create batch | PROD, ADMIN |
| `/batches/:batchId` | Batch detail (tabs) | All |
| `/batches/:batchId/raw-material` | RM QC + consumption | QC / PROD |
| `/batches/:batchId/manufacturing` | Manufacturing | PROD |
| `/batches/:batchId/qc` | IPQC | QC |
| `/batches/:batchId/inspection` | Visual inspection | QC |
| `/batches/:batchId/packing` | Packing | PACK |
| `/batches/:batchId/sealing` | Sealing | PACK |
| `/batches/:batchId/sterilization` | ETO | STER |
| `/batches/:batchId/labelling` | Labelling | PACK |
| `/batches/:batchId/sterility` | Sterility | QC |
| `/batches/:batchId/bet` | BET | QC |
| `/batches/:batchId/qa` | QA review | QA |
| `/batches/:batchId/finished-goods` | FG transfer | QA |
| `/batches/:batchId/dispatch` | Dispatch | DISP |
| `/batches/:batchId/audit` | Batch audit | audit:view |
| `/products` | Products | ADMIN |
| `/raw-materials` | Raw materials | ADMIN |
| `/eto-cartridges` | ETO inventory | ADMIN, STER |
| `/sops` | SOP management | ADMIN |
| `/customers` | Customers | ADMIN, DISP |
| `/inventory` | Finished goods | All relevant |
| `/reports` | Reports hub | reports:view |
| `/audit-logs` | Global audit | audit:view |
| `/users` | User management | ADMIN |
| `/settings` | System settings | ADMIN |

### 9.2 Batch Detail Tabs

`Overview | Production | QC | Packing | Sterilization | Testing | Documents | Audit`

Overview shows: header fields, status badge, progress bar, process timeline.

### 9.3 Dashboard Cards

| Card | Query logic |
|------|-------------|
| Active Batches | status not in DISPATCHED, CANCELLED, ARCHIVED, REJECTED |
| Pending QC | status in RAW_MATERIAL_QC, IN_PROCESS_QC, VISUAL_INSPECTION, STERILITY_TEST, BET_TEST |
| Ready FG | status = FINISHED_GOODS OR RELEASED |
| Pending Approvals | status = QA_REVIEW |
| Sterilization | status = STERILIZATION |
| Dispatch | status = FINISHED_GOODS with qtyAvailable > 0 |

Filters: Product, Batch number, Date, Status, Department, Operator, Customer.

### 9.4 Sidebar

```
Dashboard
Batches
Production
Quality Control
Sterilization
Packing
Finished Goods
Dispatch
Reports
SOPs
Audit Trail
Users
Settings
```

### 9.5 UI Stack

- React 18+ / Vite / TypeScript
- Tailwind CSS + shadcn/ui
- React Router
- TanStack Query + Axios
- React Hook Form + Zod
- TanStack Table
- Recharts
- PDF: client download from `GET /batches/:id/pdf` (server-generated)

### 9.6 UX Principles
- Medical-manufacturing dashboard (not accounting ERP)
- Visual batch timeline on every batch page
- Controlled parameters (sealing temp, ETO setpoints) displayed read-only from template snapshot
- E-sign modal on submit/approve

---

## 10. Seed Data (Introducer Needle)

```json
{
  "product": {
    "name": "INTRODUCER NEEDLE",
    "catalogueNo": "IN-001",
    "shelfLifeMonths": 60
  },
  "exampleBatch": {
    "batchNo": "IN26091401",
    "batchSize": 10000,
    "manufacturingDate": "2026-09-14",
    "expiryDate": "2031-09-14"
  },
  "sealing": { "temperatureC": 200, "sopRef": "SOP/MF/011" },
  "sterilization": {
    "temperatureC": 55,
    "durationHours": 4,
    "etoCartridgeGrams": 40,
    "sopRef": "SOP/MF/008"
  },
  "sterilitySop": "SOP/QC/004",
  "betSop": "SOP/QC/005",
  "storageCondition": "Store at Room Temperature"
}
```

---

## 11. Security Requirements

| Control | Implementation |
|---------|----------------|
| Transport | HTTPS in production |
| Auth | JWT access (short-lived) + refresh tokens (httpOnly cookie preferred) |
| Passwords | argon2 or bcrypt |
| RBAC | middleware on every protected route |
| Validation | Zod on all inputs |
| Rate limit | auth + write endpoints |
| CORS | allowlist frontend origin |
| Cookies | Secure, HttpOnly, SameSite |
| Audit | all mutations on batches/stages |
| No hard delete | cancel/archive/void only |
| Frontend RBAC | UX only; backend authoritative |

---

## 12. PDF BMR Generation

Endpoint: `GET /batches/:batchId/pdf`  
Library suggestion: PDFKit or Puppeteer on server.

Sections (mirror paper BMR):
1. Header — SureTech Medical Inc., product, catalogue, batch, size, mfg/expiry
2. Raw Material QC table
3. Raw Material Consumption
4. Manufacturing
5. In-Process QC
6. Visual Inspection
7. Packing / Sealing
8. ETO Sterilization + cartridge details
9. Labelling
10. Sterility / BET
11. Storage / FG / Dispatch
12. Signatures / release

---

## 13. Development Phases (Implementation Order)

| Phase | Deliverables |
|-------|----------------|
| **1 Foundation** | Monorepo scaffold, auth, roles, users, dashboard shell, products |
| **2 Batch Mgmt** | Create batch, status, detail page, timeline |
| **3 Production** | RM QC, consumption, manufacturing, IPQC, visual inspection |
| **4 Packing & Sterilization** | Packing, sealing, ETO, cartridge tracking, labelling |
| **5 Lab/QC** | Sterility, BET, attachments |
| **6 QA & Release** | QA review, e-sign approvals, release, FG transfer |
| **7 Inventory & Dispatch** | FG stock, customers, dispatch, inventory decrement |
| **8 Audit & Documents** | Audit trail, corrections/revisions, SOPs, PDF BMR |
| **9 Reports** | Production/QC/sterilization/inventory/dispatch reports |

### MVP Scope (ship first)
Login → Dashboard → Create Batch → all stages through Dispatch + RBAC + Audit + PDF + Search.

---

## 14. Example Batch Number Rule

Configurable; default for Introducer Needle:

```
IN + YYMMDD + sequential(2)
→ IN26091401
```

Server generates; uniqueness enforced by index.

---

## 15. Open Compliance Notes

- Pass/Fail/N/A on RM QC rows: **application enhancement** (not explicitly mandated by paper BMR checkboxes).
- Checkbox UI for IPQC: UI representation of dust/burr/particle criteria.
- E-signature mechanism must be validated against applicable regulations/SOPs before production deployment.
- Process setpoints (200°C, 55°C, 4h, 40g) come from approved SOP/template configuration, not hard-coded business logic scattered in UI.

---

## 16. Next Implementation Step

Scaffold Phase 1:
1. Initialize `client/` (Vite React TS) and `server/` (Express TS)
2. Connect MongoDB + User model + JWT auth
3. Seed Admin user + Introducer Needle product template
4. Build AppShell + Dashboard + Batch create/list/detail skeleton

---

*End of Technical Specification v1.0*
