# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

ApprovalNJ.ai — a New Jersey commercial permit intelligence platform. Users enter project details (type, municipality, zoning district, cost, environmental flags) and receive an AI-generated analysis covering required NJ UCC forms, prior approvals, deal-killer risks, timeline, cost estimates, and a step-by-step path to permit. Newark has deeper routing logic than other municipalities.

## Commands

```bash
# Install dependencies
npm install

# Start both server and client in dev mode (runs concurrently)
npm run dev

# Start only the Express API server (port 3001)
npm run dev:server

# Start only the Vite frontend (port 5173)
npm run dev:client

# Production build (frontend only)
npm run build

# Run production server
npm start
```

## Environment

Copy `.env.example` to `.env` and set:
```
ANTHROPIC_API_KEY=...
PORT=3001   # optional, defaults to 3001
```

The `.env` file lives at the project root. `server/loadEnv.js` resolves it relative to itself using an absolute path — it must be loaded before any Anthropic client is created.

## Architecture

The project is a full-stack monorepo: an Express API server (`server/`) and a React/Vite SPA (`client/`). In dev, Vite proxies `/api/*` to `localhost:3001`.

### Server (`server/`)

- `index.js` — Express entry point. Imports `loadEnv.js` first, then exposes `GET /api/health` and `POST /api/analyze`.
- `loadEnv.js` — Loads `.env` from the project root using an absolute path.
- `src/analyze.js` — Core analysis engine. Flow:
  1. Runs heuristic functions (`calculateRisk`, `calculateCost`, `calculateTimeline`, `buildRequiredForms`, `buildPriorApprovals`) to produce a deterministic baseline.
  2. Loads and caches PDF text from all `.pdf` files in the project root (first 2000 chars per file, capped at 15,000 chars total). This is NJ regulatory reference material.
  3. Sends the baseline + PDF knowledge to `claude-sonnet-4-6` with a strict JSON schema in the system prompt.
  4. Falls back to `heuristicEnvelope()` (baseline only, no Claude call) if the API key is missing or the Claude call fails.
  5. Always overrides the model's `riskLevel` and `metrics` with the deterministic heuristic values.
- `src/data/knowledgeBase.js` — Static NJ permit knowledge: UCC form definitions (`requiredForms`), prior approval checklist (`priorApprovalOptions`), Newark room-by-room routing (`newarkRoutingGuide`), Newark-specific prompt injection text, and the standard five-step permit roadmap (`commonRoadmap`).

### Client (`client/`)

- `src/App.jsx` — Single-component SPA (no router). Two views:
  - Intake form: collects project details and POSTs to `/api/analyze`.
  - Results screen: renders the JSON response into panels (AI analysis, path to permit, deal-killers, required forms, prior approvals, Newark routing guide).
- `src/data/njMunicipalities.js` — All 564 NJ municipalities with county.
- `src/data/njZoneOptions.js` — Common NJ zoning district options for the select.

### PDF reference documents

The root directory contains ~30 NJ regulatory PDFs (NJAC codes, UCC forms, DEP documents, CCC course catalogs, municipal process manuals). These are loaded at startup and injected into every Claude prompt as background knowledge. Adding a new PDF to the root automatically includes it.

## Key design decisions

- **Risk, cost, and timeline are always heuristic-computed** — the Claude model cannot override them. This keeps these figures stable and auditable regardless of model behavior.
- **Heuristic fallback** — if `ANTHROPIC_API_KEY` is absent or Claude fails, the API still returns a complete (heuristic-only) response rather than an error to the user.
- **Newark special-casing** — Newark triggers both a prompt injection (additional context in the user message) and a guaranteed `newarkRoutingGuide` in the response. The `isNewark` flag flows through both server and client.
- **PDF caching** — PDF text is parsed once per server process and cached in memory (`cachedPdfKnowledge`). Restart the server to pick up new or modified PDFs.

## Known bugs

1. ~~**Restaurant/Hospitality risk/cost/timeline**~~ — **Fixed.** `calculateRisk` now has hard-minimum rules: New Construction always returns High; wetlands proximity always returns High; Highlands Preservation always returns High. Restaurant and Change of Use each add +2 to the score, guaranteeing a Medium floor. `calculateCost` now uses project-type-specific cost floors (e.g. Restaurant $15k–$45k, New Construction $40k–$150k) instead of the flat $10k default; construction cost scales the range upward but never below the floor. `calculateTimeline` now accepts `projectDetails` and returns project-type-specific ranges (e.g. Restaurant 3–6 months, New Construction 9–18 months) before falling back to risk level.
2. ~~**Highlands dropdown value mismatch**~~ — **Not a bug.** `highlandsOptions` uses `<option key={option.value} value={option.value}>` so `e.target.value` always returns `"none"` / `"preservation"` / `"planning"`, never the label string. `initialForm` defaults to `"none"`. Server-side checks (`=== "preservation"`, `!== "none"`) are consistent. No change needed.
3. ~~**Soil Erosion false trigger**~~ — **Fixed.** `buildPriorApprovals` now splits the check into `outdoorTrigger` (existing regex) and `interiorOverride` (`/\binterior\b|fit[\s-]?out|no site work/`). Soil Erosion only fires when the outdoor trigger matches AND the interior override does not. Because `scope` includes both project type and additional details, a "Tenant Fit-Out" project type suppresses the trigger via "fit-out" even if outdoor keywords appear in the description.
4. ~~**AI analysis text is generic**~~ — **Fixed.** The system prompt now includes explicit instructions for the `analysis` field: name the project type and municipality in the first sentence; identify which UCC subcodes and outside agencies apply; call out environmental/municipal friction only when relevant to the intake; every sentence must reference a specific intake detail. The JSON schema line is unchanged.
5. ~~**Vite caching**~~ — **Fixed.** Two changes to `vite.config.js`: `server.watch.ignored` now excludes `server/`, `node_modules/`, and `dist/` so server-side file changes don't trigger spurious client cache invalidations; `optimizeDeps.entries` points Vite at `client/src/main.jsx` so all deps are discovered upfront and the pre-bundle cache stays valid across restarts. A `dev:fresh` script (`vite --force`) was added to `package.json` as an escape hatch when the cache needs a hard reset without forcing `--force` on every normal startup.

## New fields to add

These fields need to be added to both the intake form (`client/src/App.jsx`) and passed through `server/index.js` → `analyzeProject()`:

1. **Occupancy Group** — select: A-Assembly, B-Business, E-Educational, F-Factory, M-Mercantile, R-Residential, S-Storage
2. **Number of stories** — numeric input
3. **Existing vs. new building** — toggle/select
4. **ADA compliance scope** — select: Full, Partial, Path of travel only, Not applicable
5. **Parking requirements** — numeric or text input
6. **Health Department approval** — boolean toggle; auto-enable when project type is Restaurant/Hospitality

## Planned features

1. PDF report download — generate a client-facing summary PDF from the analysis result
2. Newark permit fee calculator — replace the heuristic cost range with a calculation based on the actual Newark fee schedule
3. Save/load analyses — persist results (localStorage or backend) so users can return to prior runs
4. Email results to client — send the analysis JSON/PDF to an email address from the results screen
5. Newark-specific zoning district dropdown — swap the generic `njZoneOptions` list for Newark's actual zoning districts when Newark is selected
6. Building addresses per approval stop — add the physical address for each stop in the Newark routing guide
7. Newark Health Department routing — add a routing step for restaurant and food service projects (currently missing from `newarkRoutingGuide`)

## Newark permit knowledge — 920 Broad Street, Newark NJ 07102

All commercial projects in Newark follow this sequence. Skipping or reordering stops causes rejections.

| Stop | Room | Purpose |
|------|------|---------|
| 1 — ALWAYS FIRST | Room 412 Engineering | Site Plan Review and Water/Sewer approval. No UCC filing is accepted without the receipt from this step. |
| 2 | Zoning Division | Call 973-733-6333 to confirm use is permitted before spending money on drawings. |
| 3 | Room B23 Building Division | UCC permit filing desk. Rejects packages without the Room 412 Water/Sewer receipt. |
| 4 | Room B1 Code Enforcement | C.O. inspections and change-of-use review. |
| 5 | Tax Collector | Property taxes must be current before final permit issuance. |

**Required for all Newark commercial filings:**
- City of Newark Contractor License
- Two sets of signed and sealed architectural drawings
- COMcheck 90.1 energy compliance report
- PVSC approval for restaurant, medical, food service, and industrial projects
- Newark Health Department approval for restaurants and food service

## Realistic Newark permit costs

| Project type | Cost range |
|---|---|
| Simple tenant fit-out | $8,000–$20,000 |
| Restaurant / Hospitality | $15,000–$45,000 |
| Change of Use | $10,000–$35,000 |
| Office Renovation | $8,000–$25,000 |
| Warehouse / Industrial | $12,000–$50,000 |
| New Construction | $40,000–$150,000+ |
| Mixed-Use Development | $50,000–$200,000+ |

## Realistic Newark timelines

| Project type | Timeline |
|---|---|
| Simple tenant fit-out | 6–12 weeks |
| Restaurant / Hospitality | 3–6 months |
| Change of Use | 2–4 months |
| New Construction | 9–18 months |
| Mixed-Use Development | 12–24 months |

## Risk scoring rules

When updating `calculateRisk` in `server/src/analyze.js`, enforce these minimums:

- Restaurant/Hospitality in Newark → always Medium or High (never Low)
- New Construction → always High
- Change of Use → always Medium minimum
- Wetlands proximity → always High
- Highlands Preservation Area → always High
- Simple interior renovation, no food service, no fire suppression → Low acceptable

## Key contacts

- Zoning confirmation: 973-733-6333
- City Hall / all permit stops: 920 Broad Street, Newark NJ 07102
- PVSC: pvsc.com
