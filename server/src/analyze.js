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

/** Lazy init after env is loaded (`loadEnv.js` runs before this module evaluates; callers also safe if env loads later). */
let anthropicClient = undefined;

function getAnthropic() {
  if (anthropicClient !== undefined) return anthropicClient;
  const key = (process.env.ANTHROPIC_API_KEY || "").trim();
  anthropicClient = key ? new Anthropic({ apiKey: key }) : null;
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
  const isRestaurant = /restaurant|hospitality/.test(pt);
  const isNewConstruction = /new construction|ground.up/.test(pt);
  const multiplier = isNewark ? 1.3 : 1.0;
  let base = cc > 0 ? cc * 0.02 : 10000;
  let extra = 0;
  if (isRestaurant) extra += 13000;
  if (isNewConstruction) extra += 20000;
  const lo = Math.round((base * 0.75 + extra) * multiplier);
  const hi = Math.round((base * 1.5 + extra) * multiplier);
  return "$" + lo.toLocaleString() + " - $" + hi.toLocaleString();
}

function calculateRisk(projectDetails) {
  const pt = (projectDetails.projectType || "").toLowerCase();
  const mun = (projectDetails.municipality || "").toLowerCase();
  const isRestaurant = /restaurant|hospitality/.test(pt);
  const isNewConstruction = /new construction|ground.up/.test(pt);
  const isNewark = mun === "newark";
  let score = 1;
  if (isRestaurant) score += 2;
  if (isNewConstruction) score += 2;
  if (isNewark) score += 1;
  if (projectDetails.wetlandsProximity) score += 1;
  if (projectDetails.highlandsRegion === "preservation") score += 2;
  if (projectDetails.highlandsRegion === "planning") score += 1;
  return score >= 5 ? "High" : score >= 3 ? "Medium" : "Low";
}

function calculateTimeline(riskLevel) {
  if (riskLevel === "High") return "6-12+ months";
  if (riskLevel === "Medium") return "3-6 months";
  return "4-10 weeks";
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
    if (name === "Soil Erosion" && /new construction|ground.up|site work|grading/.test(scope)) { needed = true; reason = "Land disturbance or substantial site work often requires soil erosion certification."; }
    if (name === "PVSC" && pvscRequired) { needed = true; reason = "Sewer connection review may require PVSC referral and approval before filing or issuance."; }
    if (name === "Highlands" && projectDetails.highlandsRegion !== "none") { needed = true; reason = projectDetails.highlandsRegion === "preservation" ? "Highlands Preservation Area projects face the strictest screening and approval burden." : "Highlands Planning Area location warrants additional regional screening before advancing."; }
    if (name === "Pinelands" && /pinelands/.test(scope)) { needed = true; reason = "The intake references a Pinelands-sensitive location or condition."; }
    return { name, needed, reason };
  });
}

function extractJson(text) {
  let raw = text.trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) raw = fenced[1].trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Model response did not include JSON.");
  return JSON.parse(match[0]);
}

export async function analyzeProject(projectDetails) {
  const isNewark = (projectDetails.municipality || "").toLowerCase() === "newark";
  const riskLevel = calculateRisk(projectDetails);
  const permitCost = calculateCost(projectDetails);
  const timeline = calculateTimeline(riskLevel);

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
      max_tokens: 1800,
      system: `You are ApprovalNJ.ai, an institutional-grade New Jersey permit intelligence engine. Return ONLY valid JSON with this exact shape: {"riskLevel":"Low"|"Medium"|"High","metrics":{"overallRisk":"string","estimatedTimeline":"string","estimatedPermitCost":"string"},"analysis":"string","pathToPermit":[{"title":"string","description":"string"}],"dealKillers":[{"label":"string","status":"green"|"yellow"|"red","detail":"string"}],"requiredForms":[{"code":"string","name":"string","required":true|false,"reason":"string"}],"priorApprovals":[{"name":"string","needed":true|false,"reason":"string"}],"newarkRoutingGuide":["string"],"disclaimer":"string"}`,
      messages: [{ role: "user", content: userPrompt }],
    });

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