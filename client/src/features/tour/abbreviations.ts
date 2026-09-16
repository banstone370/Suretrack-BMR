/** Full forms for abbreviations used across the eBMR system. */
export const ABBREVIATIONS: Record<string, string> = {
  eBMR: 'Electronic Batch Manufacturing Record',
  BMR: 'Batch Manufacturing Record',
  QC: 'Quality Control',
  QA: 'Quality Assurance',
  RM: 'Raw Material',
  IPQC: 'In-Process Quality Control',
  ETO: 'Ethylene Oxide',
  BET: 'Bacterial Endotoxin Test',
  SOP: 'Standard Operating Procedure',
  FG: 'Finished Goods',
  ADM: 'Administrator (employee ID prefix)',
  CSV: 'Comma-Separated Values (export format)',
  PDF: 'Portable Document Format',
  API: 'Application Programming Interface',
};

export const ABBREVIATION_LIST = Object.entries(ABBREVIATIONS).map(([abbr, fullForm]) => ({
  abbr,
  fullForm,
}));
