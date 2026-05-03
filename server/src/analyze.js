import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import {
  commonRoadmap,
  newarkPromptInjection,
  newarkRoutingGuide,
  priorApprovalOptions,
  requiredForms,
} from "./data/knowledgeBase.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../../");

/** Lazy init and resilient to late env loading/key changes. */
let anthropicClient = null;
let anthropicClientKey = "";

function getAnthropic() {
  const key = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!key) {
    anthropicClient = null;
    anthropicClientKey = "";
    return null;
  }
  if (!anthropicClient || anthropicClientKey !== key) {
    anthropicClient = new Anthropic({ apiKey: key });
    anthropicClientKey = key;
  }
  return anthropicClient;
}

let cachedPdfKnowledge = null;

async function loadPdfKnowledge() {
  if (cachedPdfKnowledge) return cachedPdfKnowledge;
  const pdfFiles = fs.readdirSync(ROOT_DIR).filter((f) => f.endsWith(".pdf"));
  let combined = "";
  for (const file of pdfFiles) {
    try {
      const buffer = fs.readFileSync(path.join(ROOT_DIR, file));
      const data = await pdfParse(buffer);
      combined += `\n\n--- ${file} ---\n${data.text.slice(0, 2000)}`;
    } catch { }
  }
  cachedPdfKnowledge = combined.slice(0, 15000);
  return cachedPdfKnowledge;
}

function calculateCost(projectDetails) {
  const pt = (projectDetails.projectType || "").toLowerCase();
  const mun = (projectDetails.municipality || "").toLowerCase();
  const cc = projectDetails.constructionCost || 0;
  const isNewark = mun === "newark";
  const multiplier = isNewark ? 1.3 : 1.0;

  // Realistic minimums per project type (statewide baseline before Newark multiplier)
  let floorLo, floorHi;
  if (/new construction|ground.up/.test(pt))  { floorLo = 40000; floorHi = 150000; }
  else if (/mixed.use/.test(pt))              { floorLo = 50000; floorHi = 200000; }
  else if (/restaurant|hospitality/.test(pt)) { floorLo = 15000; floorHi = 45000; }
  else if (/change of use/.test(pt))          { floorLo = 10000; floorHi = 35000; }
  else if (/warehouse|industrial/.test(pt))   { floorLo = 12000; floorHi = 50000; }
  else if (/office/.test(pt))                 { floorLo = 8000;  floorHi = 25000; }
  else                                        { floorLo = 8000;  floorHi = 20000; }

  // Scale off construction cost when provided, but never go below the type floor
  const scaledLo = cc > 0 ? Math.round(cc * 0.015) : 0;
  const scaledHi = cc > 0 ? Math.round(cc * 0.03) : 0;
  const lo = Math.round(Math.max(floorLo, scaledLo) * multiplier);
  const hi = Math.round(Math.max(floorHi, scaledHi) * multiplier);
  return "$" + lo.toLocaleString() + " - $" + hi.toLocaleString();
}

function calculateRisk(projectDetails) {
  const pt = (projectDetails.projectType || "").toLowerCase();
  const mun = (projectDetails.municipality || "").toLowerCase();
  const isRestaurant = /restaurant|hospitality/.test(pt);
  const isNewConstruction = /new construction|ground.up/.test(pt);
  const isChangeOfUse = /change of use/.test(pt);
  const isNewark = mun === "newark";

  // Hard minimums — these always win regardless of other factors
  if (isNewConstruction) return "High";
  if (projectDetails.wetlandsProximity) return "High";
  if (projectDetails.highlandsRegion === "preservation") return "High";

  let score = 1;
  if (isRestaurant) score += 2;  // guarantees Medium minimum (1+2=3)
  if (isChangeOfUse) score += 2; // guarantees Medium minimum (1+2=3)
  if (isNewark) score += 1;
  if (projectDetails.highlandsRegion === "planning") score += 1;
  return score >= 5 ? "High" : score >= 3 ? "Medium" : "Low";
}

function calculateTimeline(riskLevel, projectDetails) {
  const pt = (projectDetails?.projectType || "").toLowerCase();
  if (/new construction|ground.up/.test(pt)) return "9-18 months";
  if (/mixed.use/.test(pt)) return "12-24 months";
  if (/restaurant|hospitality/.test(pt)) return "3-6 months";
  if (/change of use/.test(pt)) return "2-4 months";
  if (riskLevel === "High") return "6-12+ months";
  if (riskLevel === "Medium") return "3-6 months";
  return "6-12 weeks";
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
      if (pvscNeeded) form.reason = "Sewer connection or utility review may trigger PVSC referral.";
    }
  });
  return forms;
}

function buildPriorApprovals(projectDetails) {
  const scope = `${projectDetails.projectType} ${projectDetails.additionalDetails}`.toLowerCase();
  const pvscRequired = buildRequiredForms(projectDetails).some((f) => f.code === "PVSC" && f.required);
  return priorApprovalOptions.map((name) => {
    let needed = false;
    let reason = "No primary trigger detected from intake.";
    if (name === "Zoning") { needed = true; reason = "Most NJ commercial filings should confirm zoning compliance before UCC submission."; }
    if (name === "NJ DEP" && projectDetails.wetlandsProximity) { needed = true; reason = "Wetlands or waterway proximity can trigger DEP flood hazard or wetlands review."; }
    if (name === "Soil Erosion") {
      const outdoorTrigger = /new construction|ground.up|site work|grading/.test(scope);
      const interiorOverride = /\binterior\b|fit[\s-]?out|no site work/.test(scope);
      if (outdoorTrigger && !interiorOverride) { needed = true; reason = "Land disturbance or substantial site work often requires soil erosion certification."; }
    }
    if (name === "PVSC" && pvscRequired) { needed = true; reason = "Sewer connection review may require PVSC referral and approval before filing or issuance."; }
    if (name === "Highlands" && projectDetails.highlandsRegion !== "none") { needed = true; reason = projectDetails.highlandsRegion === "preservation" ? "Highlands Preservation Area projects face the strictest screening and approval burden." : "Highlands Planning Area location warrants additional regional screening before advancing."; }
    if (name === "Pinelands" && /pinelands/.test(scope)) { needed = true; reason = "The intake references a Pinelands-sensitive location or condition."; }
    return { name, needed, reason };
  });
}

function repairJson(text) {
  // Replace literal newlines/tabs inside JSON strings with their escape equivalents.
  // LLMs occasionally emit these even when instructed not to.
  let result = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { result += ch; escaped = false; continue; }
    if (ch === "\\" && inString) { result += ch; escaped = true; continue; }
    if (ch === '"') { result += ch; inString = !inString; continue; }
    if (inString && ch === "\n") { result += "\\n"; continue; }
    if (inString && ch === "\r") { result += "\\r"; continue; }
    if (inString && ch === "\t") { result += "\\t"; continue; }
    result += ch;
  }
  return result;
}

function extractJson(text) {
  let raw = text.trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) raw = fenced[1].trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Model response did not include JSON.");
  try {
    return JSON.parse(match[0]);
  } catch {
    const repaired = repairJson(match[0]);
    return JSON.parse(repaired);
  }
}

export async function analyzeProject(projectDetails) {
  const isNewark = (projectDetails.municipality || "").toLowerCase() === "newark";
  const riskLevel = calculateRisk(projectDetails);
  const permitCost = calculateCost(projectDetails);
  const timeline = calculateTimeline(riskLevel, projectDetails);

  const metrics = {
    overallRisk: `${riskLevel} municipal + UCC complexity`,
    estimatedTimeline: timeline,
    estimatedPermitCost: permitCost,
  };

  function heuristicEnvelope(analysisBody) {
    return {
      riskLevel,
      metrics,
      analysis: analysisBody,
      pathToPermit: commonRoadmap,
      dealKillers: [],
      requiredForms: buildRequiredForms(projectDetails),
      priorApprovals: buildPriorApprovals(projectDetails),
      newarkRoutingGuide: isNewark ? newarkRoutingGuide : [],
      disclaimer: "Advisory output only.",
    };
  }

  const anthropic = getAnthropic();
  if (!anthropic) {
    return heuristicEnvelope(
      `${projectDetails.municipality} should be analyzed as an NJ UCC filing first.`,
    );
  }

  try {
    const pdfKnowledge = await loadPdfKnowledge();

    const userPrompt = `
Project intake:
${JSON.stringify(projectDetails, null, 2)}

Required forms baseline: ${JSON.stringify(buildRequiredForms(projectDetails))}
Prior approvals baseline: ${JSON.stringify(buildPriorApprovals(projectDetails))}
Default roadmap: ${JSON.stringify(commonRoadmap)}
${isNewark ? newarkPromptInjection : ""}
Reference knowledge from NJ regulatory documents:
${pdfKnowledge}
`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 5000,
      system: `You are ApprovalNJ.ai, an institutional-grade New Jersey permit intelligence engine.

Important: every string value in the JSON must be a single line. Never include a literal newline, carriage return, or tab character inside any JSON string value — use \\n only if a line break is truly needed.

The "analysis" field must be a specific, substantive 3-4 sentence paragraph written for this exact project. Rules:
- Name the project type and municipality in the first sentence.
- Identify the primary permit sequence drivers for this project: which UCC subcodes apply, which outside agencies are triggered, and what makes this project more or less complex than a typical filing.
- Call out any environmental, zoning, or municipal-specific friction that applies (wetlands, Highlands, Newark room routing, PVSC, health department, etc.) only if relevant to this intake.
- Every sentence must reference a specific detail from the intake. Do not write a generic paragraph that could apply to any project.

Return ONLY valid JSON with this exact shape: {"riskLevel":"Low"|"Medium"|"High","metrics":{"overallRisk":"string","estimatedTimeline":"string","estimatedPermitCost":"string"},"analysis":"string","pathToPermit":[{"title":"string","description":"string"}],"dealKillers":[{"label":"string","status":"green"|"yellow"|"red","detail":"string"}],"requiredForms":[{"code":"string","name":"string","required":true|false,"reason":"string"}],"priorApprovals":[{"name":"string","needed":true|false,"reason":"string"}],"newarkRoutingGuide":["string"],"disclaimer":"string"}`,
      messages: [{ role: "user", content: userPrompt }],
    });

    if (response.stop_reason === "max_tokens") {
      throw new Error("Response truncated by max_tokens limit — increase max_tokens");
    }

    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const parsed = extractJson(text);

    parsed.riskLevel = riskLevel;
    parsed.metrics = metrics;

    if (isNewark && (!Array.isArray(parsed.newarkRoutingGuide) || parsed.newarkRoutingGuide.length === 0)) {
      parsed.newarkRoutingGuide = newarkRoutingGuide;
    }

    return parsed;
  } catch (err) {
    console.error("analyzeProject Claude path failed:", err.message ?? err);
    return heuristicEnvelope(
      `${projectDetails.municipality} should be analyzed as an NJ UCC filing first. ${
        err.message ? `\n\n(Model step skipped: ${err.message})` : ""
      }`.trim(),
    );
  }
}