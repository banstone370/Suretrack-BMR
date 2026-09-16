# SureTech eBMR — Client System Working Guide

This is the same content as `docs/SureTech-eBMR-Client-System-Guide.pdf`, written for a business audience.

## What this system is

SureTech eBMR replaces paper Batch Manufacturing Records with a **controlled digital workflow**. Every manufacturing batch moves through defined stages. Only the right department can act at each stage. Critical actions need an **electronic signature** (password re-entry). Every important change is stored in an **audit trail**, and a printable **BMR PDF** can be generated anytime.

## Who uses it

| Role | Responsibility |
|------|----------------|
| Admin | Products, users, SOPs, settings; full oversight |
| Production Chemist | Create/start batch, issue materials, manufacture |
| QC Officer | Material & product checks; sterility & BET |
| Packing Operator | Pack, seal, label |
| Sterilization Operator | ETO cycle + cartridge |
| QA Approver | Final release, FG transfer, hold/cancel |
| Dispatch User | Ship released stock to customers |

## Normal path (Pass all the way)

1. Admin sets up product (optional for each new product)  
2. Production creates batch → Start  
3. QC Raw Material QC → Approve  
4. Production consumption → Manufacturing  
5. QC IPQC → Visual inspection  
6. Packing → Sealing  
7. Sterilization (ETO)  
8. Labelling  
9. QC Sterility → BET  
10. QA Release → Finished Goods  
11. Dispatch confirm → Dispatched (when qty remaining = 0)

## All other possibilities

- **Fail / Reject** — batch stops as Rejected  
- **Hold** — pause for investigation; QA can Resume  
- **Cancel** — close without completing  
- **Archive** — store Rejected/Cancelled historically  
- **Correction unlock** — request + QA/Admin approve; revision bumps (R1→R2); stage reopens for controlled re-entry  
- **Partial dispatch** — ship part of FG; remaining stays in Finished Goods  

## Documents you get

- **BMR PDF** per batch (electronic paper BMR equivalent)  
- **Reports** + **CSV export**  
- **SOP** metadata + file attachments  
- **Lab attachments** on sterility/BET  

## Training logins

- Admin: `admin@suretech.local` / `Admin@12345`  
- Other roles: `*@suretech.local` / `Demo@12345`
