# SureTech Medical — eBMR

Electronic Batch Manufacturing Record / Batch Record Management System (MERN).

**Working flow:** [`WORKFLOW.md`](./WORKFLOW.md) · **Deploy:** [`DEPLOY.md`](./DEPLOY.md) · **Client guide:** [`CLIENT_GUIDE.md`](./CLIENT_GUIDE.md)

## Live links

| Service | URL |
|---------|-----|
| **GitHub** | https://github.com/banstone370/Suretrack-BMR |
| **Frontend (Vercel)** | https://suretrack-ebmr.vercel.app |
| **Backend (Railway)** | Pending — connect repo + Atlas URI (see `DEPLOY.md`) |
| **Database** | MongoDB Atlas DB `Suretrack-eBMR` (Cluster0) |

## Local setup

```bash
npm install
npm install --prefix server
npm install --prefix client
cp server/.env.example server/.env
npm run seed
npm run dev
```

- API: http://localhost:5000  
- App: http://localhost:5173  

## Default logins

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@suretech.local | Admin@12345 |
| Other roles | `*@suretech.local` | Demo@12345 |

## Status

MVP complete: full batch workflow, RBAC, audit, PDF, reports, corrections, attachments, inbox, mobile UI, deploy configs for Vercel + Railway.
