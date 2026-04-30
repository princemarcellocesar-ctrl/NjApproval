export const requiredForms = [
  {
    id: "f100",
    code: "F100",
    name: "Construction Permit Application",
    appliesWhen: "Required for every NJ UCC permit filing.",
  },
  {
    id: "f110",
    code: "F110",
    name: "Building Subcode Technical Section",
    appliesWhen: "Required when building, shell, structural, occupancy, or architectural work is involved.",
  },
  {
    id: "f120",
    code: "F120",
    name: "Electrical Subcode Technical Section",
    appliesWhen: "Required when electrical work, service upgrades, lighting, panels, or tenant fit-out wiring is involved.",
  },
  {
    id: "f130",
    code: "F130",
    name: "Plumbing Subcode Technical Section",
    appliesWhen: "Required when fixtures, domestic water, sanitary, gas piping, or plumbing systems are modified.",
  },
  {
    id: "f140",
    code: "F140",
    name: "Fire Protection Subcode Technical Section",
    appliesWhen: "Required when sprinklers, alarms, standpipes, suppression, or fire protection systems are part of scope.",
  },
  {
    id: "pvsc",
    code: "PVSC",
    name: "PVSC Municipal Referral Form",
    appliesWhen: "Required when sewer connection or PVSC review is triggered in applicable service areas.",
  },
];

export const priorApprovalOptions = [
  "NJ DEP",
  "Zoning",
  "Soil Erosion",
  "PVSC",
  "Highlands",
  "Pinelands",
];

export const newarkRoutingGuide = [
  "Start at Room 412 Engineering for Site Plan Review and Water/Sewer approval before filing any commercial UCC package.",
  "Go to Room B1 Code Enforcement when a C.O. inspection or change-of-use review is required.",
  "File the UCC permit package at Room B23 only after obtaining the Room 412 Water/Sewer receipt.",
  "Clear the Tax Collector hold before expecting final permit issuance.",
];

export const newarkPromptInjection = `
Newark-specific intake and routing knowledge:
- All commercial projects start at Room 412 Engineering for Site Plan Review and Water/Sewer approval before filing at Room B23.
- Code Enforcement C.O. inspection is handled in Room B1 and is required for change of use scenarios.
- Building Division UCC filing desk is Room B23 and rejects filings without the Water/Sewer receipt from Room 412.
- Property taxes must be current before final permit issuance.
- Newark commercial submissions require City of Newark Contractor License, two sets of signed and sealed architectural drawings, COMcheck 90.1 for commercial energy compliance, zoning approval at 973-733-6333, and PVSC approval when connecting to sewer.
`;

export const commonRoadmap = [
  {
    title: "Scope and zoning intake",
    description: "Define project type, use group, occupancy implications, and local zoning fit before UCC filing.",
  },
  {
    title: "Outside-agency screening",
    description: "Screen for NJ DEP, wetlands, flood hazard, CAFRA, Highlands, Pinelands, PVSC, and soil erosion triggers.",
  },
  {
    title: "Technical package assembly",
    description: "Prepare F100 and applicable subcode technical sections with signed and sealed plans and trade licenses.",
  },
  {
    title: "Municipal review and resubmittals",
    description: "Submit to municipal departments, address plan review comments, and clear prerequisite approvals.",
  },
  {
    title: "Permit issuance and inspections",
    description: "Pay permit fees, pull the permit, complete inspections, and secure any needed certificate or final approval.",
  },
];
