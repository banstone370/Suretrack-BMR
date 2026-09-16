# SureTech Medical — eBMR

Electronic Batch Manufacturing Record / Batch Record Management System (MERN).

**Working flow (detailed diagrams):** see [`WORKFLOW.md`](./WORKFLOW.md)

## Prerequisites

- Node.js 20+
- MongoDB running locally (`mongodb://127.0.0.1:27017`)

## Setup

```bash
npm install
npm install --prefix server
npm install --prefix client
cp server/.env.example server/.env
npm run seed
```

## Run

```bash
npm run dev
```

- API: http://localhost:5000
- App: http://localhost:5173

## Default logins

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@suretech.local | Admin@12345 |
| Production | production@suretech.local | Demo@12345 |
| QC | qc@suretech.local | Demo@12345 |
| Packing | packing@suretech.local | Demo@12345 |
| Sterilization | sterilization@suretech.local | Demo@12345 |
| QA | qa@suretech.local | Demo@12345 |
| Dispatch | dispatch@suretech.local | Demo@12345 |

Seed also creates **INTRODUCER NEEDLE** (`IN-001`) with the BMR process template.

## Phase status

- **Phase 1–9 MVP:** Auth, RBAC, batches through dispatch, audit, SOPs, PDF, reports
- **Add-ons:** Add Product, mobile responsive shell
- **Gap closures:** Corrections/unlock + revision, batch hold/resume/cancel/archive, Users create/edit, Settings, file attachments (lab + SOP), Inbox/notifications, report CSV export, richer BMR PDF
