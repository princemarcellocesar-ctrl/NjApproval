import "./loadEnv.js";
import cors from "cors";
import express from "express";
import { analyzeProject } from "./src/analyze.js";

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "ApprovalNJ.ai API" });
});

app.post("/api/analyze", async (req, res) => {
  const {
    projectType,
    municipality,
    zoningDistrict,
    squareFootage,
    constructionCost,
    wetlandsProximity,
    highlandsRegion,
    additionalDetails,
  } = req.body ?? {};

  if (!projectType || !municipality || !zoningDistrict) {
    return res.status(400).json({
      error: "Missing required fields.",
      required: ["projectType", "municipality", "zoningDistrict"],
    });
  }

  try {
    const result = await analyzeProject({
      projectType,
      municipality,
      zoningDistrict,
      squareFootage: Number(squareFootage || 0),
      constructionCost: Number(constructionCost || 0),
      wetlandsProximity: Boolean(wetlandsProximity),
      highlandsRegion: highlandsRegion || "none",
      additionalDetails: additionalDetails || "",
    });

    return res.json(result);
  } catch (error) {
    console.error("Analysis failed:", error);
    return res.status(500).json({
      error: "Unable to generate permit analysis.",
      detail: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`ApprovalNJ.ai API listening on http://localhost:${port}`);
});
