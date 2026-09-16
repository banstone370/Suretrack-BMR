import type { Role } from '../../types';

export interface RoleGuide {
  role: Role;
  title: string;
  department: string;
  summary: string;
  responsibilities: string[];
  howToOperate: string[];
  focusAreas: string[];
  /** Mermaid flowchart — open-source diagram syntax rendered in the UI */
  workflowMermaid: string;
  relatedAbbr: string[];
  tourSteps: Array<{ element: string; title: string; description: string }>;
}
export const ROLE_GUIDES: Record<Role, RoleGuide> = {
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
    focusAreas: ['Products', 'Users', 'Settings', 'Audit Trail', 'Reports'],
    workflowMermaid: `
flowchart TB
  subgraph Admin["Administrator focus"]
    P[Products and templates]
    U[Users and roles]
    S[SOPs and settings]
    R[Reports and audit]
  end
  P --> BatchFlow[Batch manufacturing lifecycle]
  U --> BatchFlow
  S --> BatchFlow
  BatchFlow --> R
  BatchFlow --> Stages[RM QC → Production → Pack → ETO → Lab → QA → Dispatch]
`,
    relatedAbbr: ['eBMR', 'SOP', 'QA', 'QC', 'CSV', 'PDF'],
    tourSteps: [
      {
        element: '[data-tour="nav-dashboard"]',
        title: 'Dashboard',
        description: 'Plant overview: active batches, pending QC, and release status at a glance.',
      },
      {
        element: '[data-tour="nav-products"]',
        title: 'Products',
        description: 'Define what you manufacture and the stage sequence for each catalogue item.',
      },
      {
        element: '[data-tour="nav-users"]',
        title: 'Users',
        description: 'Create accounts and assign roles so each person only sees the actions they need.',
      },
      {
        element: '[data-tour="nav-settings"]',
        title: 'Settings',
        description: 'Configure system-wide options used across batches and reports.',
      },
      {
        element: '[data-tour="nav-audit-logs"]',
        title: 'Audit Trail',
        description: 'Immutable log of who did what and when — essential for GMP accountability.',
      },
    ],
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
    focusAreas: ['Inbox', 'Batches', 'Products'],
    workflowMermaid: `
flowchart LR
  A[Create Batch] --> B[RM QC by QC]
  B --> C{{Issue Material<br/>YOU}}
  C --> D{{Manufacture<br/>YOU}}
  D --> E[IPQC by QC]
  E --> F[Packing onward…]
  style C fill:#0f766e,color:#fff
  style D fill:#0f766e,color:#fff
`,
    relatedAbbr: ['eBMR', 'RM', 'QC', 'IPQC', 'SOP'],
    tourSteps: [
      {
        element: '[data-tour="nav-inbox"]',
        title: 'Inbox',
        description: 'Your work queue — batches waiting for material issue or manufacturing.',
      },
      {
        element: '[data-tour="nav-batches"]',
        title: 'Batches',
        description: 'Create batches and open each eBMR to record production steps.',
      },
      {
        element: '[data-tour="nav-products"]',
        title: 'Products',
        description: 'Reference catalogue numbers and default batch sizes before creating a batch.',
      },
      {
        element: '[data-tour="nav-dashboard"]',
        title: 'Dashboard',
        description: 'See how many batches are active across the plant.',
      },
    ],
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
    focusAreas: ['Inbox', 'Batches', 'Audit Trail'],
    workflowMermaid: `
flowchart LR
  A[Batch created] --> B{{RM QC<br/>YOU}}
  B --> C[Production]
  C --> D{{IPQC / Visual<br/>YOU}}
  D --> E[Pack / Sterilize]
  E --> F{{Sterility / BET<br/>YOU}}
  F --> G[QA Review]
  style B fill:#0369a1,color:#fff
  style D fill:#0369a1,color:#fff
  style F fill:#0369a1,color:#fff
`,
    relatedAbbr: ['QC', 'RM', 'IPQC', 'BET', 'QA', 'SOP', 'eBMR'],
    tourSteps: [
      {
        element: '[data-tour="nav-inbox"]',
        title: 'Inbox',
        description: 'QC tasks waiting for your inspection or lab entry.',
      },
      {
        element: '[data-tour="nav-batches"]',
        title: 'Batches',
        description: 'Open a batch eBMR to complete RM QC, IPQC, visual, sterility, or BET stages.',
      },
      {
        element: '[data-tour="nav-audit-logs"]',
        title: 'Audit Trail',
        description: 'Trace who signed each quality decision for compliance.',
      },
      {
        element: '[data-tour="nav-sops"]',
        title: 'SOPs',
        description: 'Standard Operating Procedures that define how each QC test is performed.',
      },
    ],
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
    focusAreas: ['Inbox', 'Batches', 'SOPs'],
    workflowMermaid: `
flowchart LR
  A[Visual QC done] --> B{{Packing<br/>YOU}}
  B --> C{{Sealing<br/>YOU}}
  C --> D[ETO Sterilization]
  D --> E{{Labelling<br/>YOU}}
  E --> F[Lab tests → QA]
  style B fill:#b45309,color:#fff
  style C fill:#b45309,color:#fff
  style E fill:#b45309,color:#fff
`,
    relatedAbbr: ['SOP', 'ETO', 'QC', 'eBMR'],
    tourSteps: [
      {
        element: '[data-tour="nav-inbox"]',
        title: 'Inbox',
        description: 'Batches ready for packing, sealing, or labelling.',
      },
      {
        element: '[data-tour="nav-batches"]',
        title: 'Batches',
        description: 'Enter packing counts, sealing parameters, and labelling details on the eBMR.',
      },
      {
        element: '[data-tour="nav-sops"]',
        title: 'SOPs',
        description: 'Confirm sealing and packing procedures before you sign the stage.',
      },
    ],
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
    focusAreas: ['Inbox', 'Batches', 'ETO Cartridges'],
    workflowMermaid: `
flowchart LR
  A[Sealed product] --> B{{ETO Sterilization<br/>YOU}}
  B --> C[Labelling]
  C --> D[Sterility / BET]
  E[ETO Cartridge stock] --> B
  style B fill:#7c3aed,color:#fff
  style E fill:#7c3aed,color:#fff
`,
    relatedAbbr: ['ETO', 'SOP', 'BET', 'eBMR'],
    tourSteps: [
      {
        element: '[data-tour="nav-eto-cartridges"]',
        title: 'ETO Cartridges',
        description: 'Manage cartridge batches, remaining grams, and expiry before a cycle.',
      },
      {
        element: '[data-tour="nav-inbox"]',
        title: 'Inbox',
        description: 'Batches waiting for sterilization.',
      },
      {
        element: '[data-tour="nav-batches"]',
        title: 'Batches',
        description: 'Record the ETO cycle against the electronic batch record.',
      },
    ],
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
    focusAreas: ['Inbox', 'Batches', 'Finished Goods', 'Audit Trail'],
    workflowMermaid: `
flowchart LR
  A[Lab tests complete] --> B{{QA Review<br/>YOU}}
  B -->|Release| C{{Finished Goods<br/>YOU}}
  B -->|Issue| D[Correction / Hold]
  C --> E[Dispatch]
  style B fill:#be123c,color:#fff
  style C fill:#be123c,color:#fff
`,
    relatedAbbr: ['QA', 'QC', 'FG', 'eBMR', 'SOP', 'BET'],
    tourSteps: [
      {
        element: '[data-tour="nav-inbox"]',
        title: 'Inbox',
        description: 'Batches awaiting QA review, release, or hold resolution.',
      },
      {
        element: '[data-tour="nav-batches"]',
        title: 'Batches',
        description: 'Open the full eBMR, review every stage, then release or hold.',
      },
      {
        element: '[data-tour="nav-inventory"]',
        title: 'Finished Goods',
        description: 'Confirm stock after release transfer before dispatch.',
      },
      {
        element: '[data-tour="nav-audit-logs"]',
        title: 'Audit Trail',
        description: 'Evidence of release and hold decisions for inspectors.',
      },
    ],
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
    focusAreas: ['Inbox', 'Finished Goods', 'Customers', 'Dispatch'],
    workflowMermaid: `
flowchart LR
  A[QA Released + FG] --> B{{Create Dispatch<br/>YOU}}
  B --> C{{Confirm Dispatch<br/>YOU}}
  C --> D[Batch Dispatched]
  E[Customers] --> B
  style B fill:#15803d,color:#fff
  style C fill:#15803d,color:#fff
`,
    relatedAbbr: ['FG', 'QA', 'eBMR', 'PDF'],
    tourSteps: [
      {
        element: '[data-tour="nav-inventory"]',
        title: 'Finished Goods',
        description: 'See released stock available to ship.',
      },
      {
        element: '[data-tour="nav-customers"]',
        title: 'Customers',
        description: 'Maintain ship-to accounts before creating a dispatch.',
      },
      {
        element: '[data-tour="nav-dispatches"]',
        title: 'Dispatch',
        description: 'Create and confirm outbound shipments linked to batches.',
      },
      {
        element: '[data-tour="nav-inbox"]',
        title: 'Inbox',
        description: 'Batches waiting in the Finished Goods / dispatch stage.',
      },
    ],
  },
};

export function getRoleGuide(role: Role): RoleGuide {
  return ROLE_GUIDES[role];
}
