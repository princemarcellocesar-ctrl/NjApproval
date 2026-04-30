import Anthropic from "@anthropic-ai/sdk";
import {
  commonRoadmap,
  newarkPromptInjection,
  newarkRoutingGuide,
  priorApprovalOptions,
  requiredForms,
} from "./data/knowledgeBase.js";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const systemPrompt = `
You are ApprovalNJ.ai, an institutional-grade New Jersey permit intelligence engine for commercial real estate developers, architects, and contractors.

Analyze projects under New Jersey's Uniform Construction Code framework, municipal home rule authority across all 564 municipalities, and NJ-specific preconditions. You must reason from NJ UCC and NJ local approval practice, not from the International Building Code as a primary authority.

You must explicitly consider:
- NJ UCC permit filing logic and subcode coordination
- NJ municipalities' local zoning and land use authority
- NJ DEP regulatory triggers including CAFRA, Flood Hazard Area Control Act, freshwater wetlands, and related waterway constraints
- NJ Highlands Act review distinctions, especially Preservation vs Planning Area sensitivity
- NJ Pinelands review triggers where applicable
- Required forms including F100, F110, F120, F130, F140, and PVSC municipal referral process where sewer review is applicable
- Prior approvals that commonly gate filing or issuance, including zoning, DEP, soil erosion, sewer authority, Highlands, and Pinelands

Return ONLY valid JSON with this exact shape:
{
  "riskLevel": "Low" | "Medium" | "High",
  "metrics": {
    "overallRisk": "string",
    "estimatedTimeline": "string",
    "estimatedPermitCost": "string"
  },
  "analysis": "string",
  "pathToPermit": [
    { "title": "string", "description": "string" }
  ],
  "dealKillers": [
    { "label": "string", "status": "green" | "yellow" | "red", "detail": "string" }
  ],
  "requiredForms": [
    { "code": "string", "name": "string", "required": true | false, "reason": "string" }
  ],
  "priorApprovals": [
    { "name": "string", "needed": true | false, "reason": "string" }
  ],
  "newarkRoutingGuide": ["string"],
  "disclaimer": "string"
}

Be concrete, commercially realistic, and concise. Use ranges when uncertain. Avoid boilerplate.
`;

function normalizeProjectType(projectType = "") {
  return projectType.toLowerCase();
}

function buildRequiredForms(projectDetails) {
  const scope = `${projectDetails.projectType} ${projectDetails.additionalDetails}`.toLowerCase();
  const forms = requiredForms.map((form) => ({ ...form, required: false, reason: form.appliesWhen }));

  const hasElectrical = /(electric|lighting|service|panel|generator|fit[\s-]?out|tenant)/.test(scope);
  const hasPlumbing = /(plumb|fixture|restroom|kitchen|gas|sanitary|water)/.test(scope);
  const hasFire = /(sprinkler|alarm|standpipe|suppression|fire)/.test(scope);
  const hasBuilding = /(new|addition|alteration|renovation|shell|facade|roof|structure|change of use|tenant)/.test(scope);
  const pvscNeeded = projectDetails.wetlandsProximity || /sewer|restaurant|food|industrial|warehouse/.test(scope);

  forms.forEach((form) => {
    if (form.code === "F100") form.required = true;
    if (form.code === "F110") form.required = hasBuilding;
    if (form.code === "F120") form.required = hasElectrical;
    if (form.code === "F130") form.required = hasPlumbing;
    if (form.code === "F140") form.required = hasFire;
    if (form.code === "PVSC") {
      form.required = pvscNeeded;
      if (pvscNeeded) {
        form.reason = "Sewer connection or utility review may trigger PVSC referral.";
      }
    }
  });

  return forms;
}

function buildPriorApprovals(projectDetails) {
  const scope = `${projectDetails.projectType} ${projectDetails.additionalDetails}`.toLowerCase();
  const pvscRequired = buildRequiredForms(projectDetails).some((form) => form.code === "PVSC" && form.required);

  return priorApprovalOptions.map((name) => {
    let needed = false;
    let reason = "No primary trigger detected from intake.";

    if (name === "Zoning") {
      needed = true;
      reason = "Most NJ commercial filings should confirm zoning compliance before UCC submission.";
    }
    if (name === "NJ DEP" && projectDetails.wetlandsProximity) {
      needed = true;
      reason = "Wetlands or waterway proximity can trigger DEP flood hazard or wetlands review.";
    }
    if (name === "Soil Erosion" && /new|addition|site|grading|disturbance|warehouse|industrial/.test(scope)) {
      needed = true;
      reason = "Land disturbance or substantial site work often requires soil erosion certification.";
    }
    if (name === "PVSC" && pvscRequired) {
      needed = true;
      reason = "Sewer connection review may require PVSC referral and approval before filing or issuance.";
    }
    if (name === "Highlands" && projectDetails.highlandsRegion !== "none") {
      needed = true;
      reason =
        projectDetails.highlandsRegion === "preservation"
          ? "Highlands Preservation Area projects face the strictest screening and approval burden."
          : "Highlands Planning Area location warrants additional regional screening before advancing.";
    }
    if (name === "Pinelands" && /pinelands/.test(scope)) {
      needed = true;
      reason = "The intake references a Pinelands-sensitive location or condition.";
    }

    return { name, needed, reason };
  });
}

function buildFallbackAnalysis(projectDetails) {
  const scope = normalizeProjectType(projectDetails.projectType);
  const priorApprovals = buildPriorApprovals(projectDetails);
  const requiredFormsList = buildRequiredForms(projectDetails);
  const triggeredApprovals = priorApprovals.filter((item) => item.needed).length;

  let riskScore = 1;
  if (/new construction|addition|change of use|mixed-use|industrial/.test(scope)) riskScore += 1;
  if (projectDetails.wetlandsProximity) riskScore += 1;
  if (projectDetails.highlandsRegion === "preservation") riskScore += 2;
  if (projectDetails.highlandsRegion === "planning") riskScore += 1;
  if (triggeredApprovals >= 4) riskScore += 1;
  if ((projectDetails.municipality || "").toLowerCase() === "newark") riskScore += 1;

  const riskLevel = riskScore >= 5 ? "High" : riskScore >= 3 ? "Medium" : "Low";
  const timeline =
    riskLevel === "High" ? "6-12+ months" : riskLevel === "Medium" ? "3-6 months" : "4-10 weeks";
  const permitCost =
    riskLevel === "High" ? "$25,000-$150,000+" : riskLevel === "Medium" ? "$8,000-$40,000" : "$2,500-$12,000";

  const dealKillers = [
    {
      label: "Zoning alignment",
      status: "yellow",
      detail: "Confirm the selected use and bulk standards against the municipal zoning district before permit filing.",
    },
    {
      label: "Outside-agency approvals",
      status: projectDetails.wetlandsProximity || projectDetails.highlandsRegion !== "none" ? "red" : "green",
      detail:
        projectDetails.wetlandsProximity || projectDetails.highlandsRegion !== "none"
          ? "Environmental or regional land-use approvals may become a gating item before local issuance."
          : "No major environmental trigger was identified from intake alone.",
    },
    {
      label: "Application completeness",
      status: (projectDetails.municipality || "").toLowerCase() === "newark" ? "red" : "yellow",
      detail:
        (projectDetails.municipality || "").toLowerCase() === "newark"
          ? "Newark filings are vulnerable to rejection without water/sewer receipt, zoning approval, contractor licensing, and sealed plans."
          : "Incomplete subcode sheets, missing seals, and unsupported scope statements remain common rejection points.",
    },
  ];

  return {
    riskLevel,
    metrics: {
      overallRisk: `${riskLevel} municipal + UCC complexity`,
      estimatedTimeline: timeline,
      estimatedPermitCost: permitCost,
    },
    analysis: `${projectDetails.municipality} should be analyzed as an NJ UCC filing first, but local zoning, utility, and outside-agency gating items can materially affect timing. Based on the intake, the highest leverage move is to lock zoning alignment, identify all applicable F100-F140 technical sheets, and clear environmental or sewer prerequisites before submitting plans.`,
    pathToPermit: commonRoadmap,
    dealKillers,
    requiredForms: requiredFormsList.map((form) => ({
      code: form.code,
      name: form.name,
      required: form.required,
      reason: form.reason,
    })),
    priorApprovals,
    newarkRoutingGuide:
      (projectDetails.municipality || "").toLowerCase() === "newark" ? newarkRoutingGuide : [],
    disclaimer:
      "Advisory output only. Final filing strategy should be confirmed against the current municipal ordinance, subcode review comments, and applicable NJ agency requirements.",
  };
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Model response did not include JSON.");
  return JSON.parse(match[0]);
}

export async function analyzeProject(projectDetails) {
  const isNewark = (projectDetails.municipality || "").toLowerCase() === "newark";

  if (!anthropic) {
    return buildFallbackAnalysis(projectDetails);
  }

  const userPrompt = `
Project intake:
${JSON.stringify(projectDetails, null, 2)}

Structured defaults to preserve unless better analysis requires refinement:
- Required forms baseline: ${JSON.stringify(buildRequiredForms(projectDetails))}
- Prior approvals baseline: ${JSON.stringify(buildPriorApprovals(projectDetails))}
- Default roadmap: ${JSON.stringify(commonRoadmap)}

${isNewark ? newarkPromptInjection : ""}
`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1800,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  const parsed = extractJson(text);
  if (isNewark && (!Array.isArray(parsed.newarkRoutingGuide) || parsed.newarkRoutingGuide.length === 0)) {
    parsed.newarkRoutingGuide = newarkRoutingGuide;
  }

  return parsed;
}
