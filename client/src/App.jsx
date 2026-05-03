import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileStack,
  Landmark,
  MapPinned,
  Route,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { njMunicipalities } from "./data/njMunicipalities.js";
import { njZoneOptions } from "./data/njZoneOptions.js";

const projectTypes = [
  "Ground-Up New Construction",
  "Addition",
  "Tenant Fit-Out",
  "Change of Use",
  "Core and Shell",
  "Warehouse / Industrial Improvement",
  "Restaurant / Hospitality",
  "Office Renovation",
  "Mixed-Use Development",
  "Façade / Envelope Work",
];

const highlandsOptions = [
  { value: "none", label: "Outside Highlands" },
  { value: "preservation", label: "Highlands Preservation Area" },
  { value: "planning", label: "Highlands Planning Area" },
];

const occupancyGroups = [
  "A-1 Assembly Large",
  "A-2 Assembly Food/Drink",
  "A-3 Assembly Other",
  "B Business/Office",
  "E Educational",
  "F-1 Factory Moderate",
  "F-2 Factory Low",
  "M Mercantile/Retail",
  "R-1 Residential Transient",
  "R-2 Residential Multifamily",
  "S-1 Storage Moderate",
  "S-2 Storage Low",
  "I Institutional",
  "H Hazardous",
  "U Utility",
];

const buildingStatusOptions = [
  "Existing Building",
  "New Construction",
  "Shell Building",
];

const statusTone = {
  green: "bg-emerald-500/12 text-emerald-900 ring-1 ring-emerald-700/20",
  yellow: "bg-amber-500/12 text-amber-900 ring-1 ring-amber-700/20",
  red: "bg-rose-500/12 text-rose-900 ring-1 ring-rose-700/20",
};

const riskTone = {
  Low: "bg-emerald-600 text-white",
  Medium: "bg-amber-500 text-slate-950",
  High: "bg-rose-600 text-white",
};

const initialForm = {
  projectType: projectTypes[0],
  municipality: "Newark",
  zoningDistrict: "CBD Central Business District",
  squareFootage: "",
  constructionCost: "",
  wetlandsProximity: false,
  highlandsRegion: "none",
  occupancyGroup: "",
  numberOfStories: "",
  buildingStatus: "",
  additionalDetails: "",
};

function MetricCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-3xl border border-slate-900/10 bg-white/90 p-5 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.5)]">
      <div className="mb-4 flex items-center gap-3 text-slate-500">
        <div className="rounded-2xl bg-[#0a5c3e]/10 p-2 text-[#0a5c3e]">
          <Icon size={18} />
        </div>
        <span className="text-xs uppercase tracking-[0.18em]">{label}</span>
      </div>
      <div className="text-xl text-slate-900">{value}</div>
    </div>
  );
}

function App() {
  const [formData, setFormData] = useState(initialForm);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const municipalityOptions = useMemo(
    () => njMunicipalities.map((item) => `${item.name} (${item.county})`),
    []
  );

  const selectedMunicipalityName = formData.municipality.replace(/\s+\(.+\)$/, "");
  const isNewark = selectedMunicipalityName.toLowerCase() === "newark";

  function updateField(field, value) {
    setFormData((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          municipality: selectedMunicipalityName,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || payload.error || "Analysis request failed.");
      }

      setResult(payload);
    } catch (submissionError) {
      setError(submissionError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f9f8f5] text-slate-800">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        <header className="mb-8 flex flex-col gap-6 rounded-[2rem] border border-slate-900/10 bg-white/75 p-6 shadow-[0_30px_100px_-60px_rgba(10,92,62,0.35)] backdrop-blur md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#0a5c3e]/15 bg-[#0a5c3e]/7 px-3 py-1 text-xs uppercase tracking-[0.2em] text-[#0a5c3e]">
              <Sparkles size={14} />
              ApprovalNJ.ai
            </div>
            <h1 className="font-display text-4xl text-slate-950 md:text-5xl">
              NJ permit intelligence for serious commercial projects.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
              Institution-grade underwriting for New Jersey municipal approvals, NJ UCC filings,
              and pre-permit risk. Newark is loaded deeply first, with statewide municipality
              coverage already in the intake layer.
            </p>
          </div>
          <div className="grid gap-3 text-xs uppercase tracking-[0.16em] text-slate-500">
            <div className="rounded-2xl border border-slate-900/10 bg-[#0a5c3e] px-4 py-3 text-white">
              564 NJ municipalities seeded
            </div>
            <div className="rounded-2xl border border-slate-900/10 bg-slate-900 px-4 py-3 text-white">
              NJ UCC-first analysis engine
            </div>
          </div>
        </header>

        {!result ? (
          <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <form
              onSubmit={handleSubmit}
              className="rounded-[2rem] border border-slate-900/10 bg-white/90 p-6 shadow-[0_30px_120px_-70px_rgba(15,23,42,0.45)] md:p-8"
            >
              <div className="mb-8 flex items-center gap-3">
                <Building2 className="text-[#0a5c3e]" />
                <div>
                  <h2 className="font-display text-3xl text-slate-950">Run NJ Permit Analysis</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Enter the project facts that most affect timing, approvals, and filing risk.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Project Type">
                  <select
                    value={formData.projectType}
                    onChange={(e) => updateField("projectType", e.target.value)}
                  >
                    {projectTypes.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </Field>

                <Field label="NJ Municipality">
                  <select
                    value={formData.municipality}
                    onChange={(e) => updateField("municipality", e.target.value)}
                  >
                    {municipalityOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Zoning District">
                  <select
                    value={formData.zoningDistrict}
                    onChange={(e) => updateField("zoningDistrict", e.target.value)}
                  >
                    {njZoneOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Square Footage">
                  <input
                    type="number"
                    min="0"
                    placeholder="150000"
                    value={formData.squareFootage}
                    onChange={(e) => updateField("squareFootage", e.target.value)}
                  />
                </Field>

                <Field label="Construction Cost">
                  <input
                    type="number"
                    min="0"
                    placeholder="25000000"
                    value={formData.constructionCost}
                    onChange={(e) => updateField("constructionCost", e.target.value)}
                  />
                </Field>

                <Field label="Highlands Region">
                  <select
                    value={formData.highlandsRegion}
                    onChange={(e) => updateField("highlandsRegion", e.target.value)}
                  >
                    {highlandsOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Occupancy Group">
                  <select
                    value={formData.occupancyGroup}
                    onChange={(e) => updateField("occupancyGroup", e.target.value)}
                  >
                    <option value="">— Select occupancy —</option>
                    {occupancyGroups.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Building Status">
                  <select
                    value={formData.buildingStatus}
                    onChange={(e) => updateField("buildingStatus", e.target.value)}
                  >
                    <option value="">— Select status —</option>
                    {buildingStatusOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Number of Stories">
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 4"
                    value={formData.numberOfStories}
                    onChange={(e) => updateField("numberOfStories", e.target.value)}
                  />
                </Field>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <ToggleCard
                  title="Wetlands / Waterway Proximity"
                  checked={formData.wetlandsProximity}
                  onChange={(checked) => updateField("wetlandsProximity", checked)}
                />
                <div className="rounded-3xl border border-slate-900/10 bg-[#f9f8f5] p-4">
                  <div className="flex items-start gap-3">
                    <MapPinned className="mt-1 text-[#0a5c3e]" size={18} />
                    <div>
                      <div className="text-sm uppercase tracking-[0.16em] text-slate-500">
                        Municipality Coverage
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Statewide intake spans all 564 NJ municipalities. Newark unlocks an
                        additional routing intelligence panel on the results screen.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Field label="Additional Details" className="mt-5">
                <textarea
                  rows="5"
                  placeholder="Describe use, tenant type, utility needs, site constraints, environmental context, and any known approvals."
                  value={formData.additionalDetails}
                  onChange={(e) => updateField("additionalDetails", e.target.value)}
                />
              </Field>

              {error ? (
                <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[#0a5c3e] px-5 py-4 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-[#084a32] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Sparkles size={18} />
                {loading ? "Running analysis..." : "Run NJ Permit Analysis"}
              </button>
            </form>

            <aside className="space-y-5">
              <Panel icon={Landmark} title="What the engine weighs">
                NJ UCC permit sequencing, local zoning controls, DEP wetlands and flood hazard
                triggers, Highlands and Pinelands overlays, subcode sheet applicability, sewer
                referrals, and municipality-specific filing friction.
              </Panel>
              <Panel icon={ShieldAlert} title="Newark is deeply loaded">
                Newark analysis layers in Room 412 engineering routing, Room B1 C.O. checks, Room
                B23 UCC filing prerequisites, tax clearance issues, and checklist-driven submission
                completeness risk.
              </Panel>
              <Panel icon={FileStack} title="Form logic included">
                The engine flags F100 through F140 and PVSC referral requirements as applicable so
                underwriting can see likely filing burden before design teams package the permit set.
              </Panel>
            </aside>
          </section>
        ) : (
          <section className="space-y-8">
            <div className="flex flex-col gap-4 rounded-[2rem] border border-slate-900/10 bg-white/90 p-6 shadow-[0_30px_120px_-70px_rgba(15,23,42,0.45)] md:flex-row md:items-center md:justify-between">
              <div>
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-900"
                >
                  <ArrowLeft size={16} />
                  Back to intake
                </button>
                <h2 className="font-display text-3xl text-slate-950">
                  {selectedMunicipalityName} permit analysis
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                  {formData.projectType} in {formData.zoningDistrict}. Analysis is tuned for NJ UCC
                  permit sequencing and local approval friction.
                </p>
              </div>
              <div
                className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm uppercase tracking-[0.18em] ${riskTone[result.riskLevel]}`}
              >
                {result.riskLevel} Risk
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <MetricCard icon={ShieldAlert} label="Overall Risk" value={result.metrics.overallRisk} />
              <MetricCard icon={Clock3} label="Est. Timeline" value={result.metrics.estimatedTimeline} />
              <MetricCard
                icon={CircleDollarSign}
                label="Est. Permit Cost"
                value={result.metrics.estimatedPermitCost}
              />
            </div>

            <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-8">
                <section className="rounded-[2rem] border border-slate-900/10 bg-white/90 p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)]">
                  <div className="mb-4 flex items-center gap-3">
                    <Sparkles className="text-[#0a5c3e]" />
                    <h3 className="font-display text-2xl text-slate-950">AI Analysis</h3>
                  </div>
                  <p className="leading-8 text-slate-700">{result.analysis}</p>
                </section>

                <section className="rounded-[2rem] border border-slate-900/10 bg-white/90 p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)]">
                  <div className="mb-6 flex items-center gap-3">
                    <Route className="text-[#0a5c3e]" />
                    <h3 className="font-display text-2xl text-slate-950">Path to Permit</h3>
                  </div>
                  <div className="space-y-4">
                    {result.pathToPermit.map((step, index) => (
                      <div key={`${step.title}-${index}`} className="flex gap-4 rounded-3xl bg-[#f9f8f5] p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0a5c3e] text-sm text-white">
                          {index + 1}
                        </div>
                        <div>
                          <div className="text-lg text-slate-950">{step.title}</div>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{step.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[2rem] border border-slate-900/10 bg-white/90 p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)]">
                  <div className="mb-6 flex items-center gap-3">
                    <AlertTriangle className="text-[#0a5c3e]" />
                    <h3 className="font-display text-2xl text-slate-950">Deal-Killer Risk Scan</h3>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {result.dealKillers.map((item) => (
                      <div key={item.label} className="rounded-3xl border border-slate-900/10 p-4">
                        <div
                          className={`mb-3 inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${statusTone[item.status]}`}
                        >
                          {item.status}
                        </div>
                        <div className="text-lg text-slate-950">{item.label}</div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="space-y-8">
                <section className="rounded-[2rem] border border-slate-900/10 bg-white/90 p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)]">
                  <div className="mb-6 flex items-center gap-3">
                    <FileStack className="text-[#0a5c3e]" />
                    <h3 className="font-display text-2xl text-slate-950">Required NJ Forms</h3>
                  </div>
                  <div className="space-y-3">
                    {result.requiredForms.map((form) => (
                      <div
                        key={form.code}
                        className="flex gap-3 rounded-3xl border border-slate-900/10 px-4 py-4"
                      >
                        <div className="pt-1 text-[#0a5c3e]">
                          {form.required ? <CheckCircle2 size={18} /> : <BadgeCheck size={18} />}
                        </div>
                        <div>
                          <div className="text-sm uppercase tracking-[0.16em] text-slate-500">
                            {form.code}
                          </div>
                          <div className="text-base text-slate-950">{form.name}</div>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{form.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[2rem] border border-slate-900/10 bg-white/90 p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)]">
                  <div className="mb-6 flex items-center gap-3">
                    <Landmark className="text-[#0a5c3e]" />
                    <h3 className="font-display text-2xl text-slate-950">Prior Approvals Needed</h3>
                  </div>
                  <div className="space-y-3">
                    {result.priorApprovals.map((item) => (
                      <div
                        key={item.name}
                        className="rounded-3xl border border-slate-900/10 px-4 py-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-base text-slate-950">{item.name}</div>
                          <div
                            className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${
                              item.needed ? statusTone.red : statusTone.green
                            }`}
                          >
                            {item.needed ? "Needed" : "Not primary"}
                          </div>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {isNewark && result.newarkRoutingGuide?.length ? (
                  <section className="rounded-[2rem] border border-[#0a5c3e]/15 bg-[#0a5c3e] p-6 text-white shadow-[0_24px_80px_-48px_rgba(10,92,62,0.6)]">
                    <div className="mb-6 flex items-center gap-3">
                      <Building2 />
                      <h3 className="font-display text-2xl">City Hall Routing Guide</h3>
                    </div>
                    <div className="space-y-3">
                      {result.newarkRoutingGuide.map((step) => (
                        <div key={step} className="rounded-3xl bg-white/10 px-4 py-4">
                          {step}
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            </div>

            <p className="px-2 text-sm text-slate-500">{result.disclaimer}</p>
          </section>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <div className="[&_input]:w-full [&_input]:rounded-2xl [&_input]:border [&_input]:border-slate-900/10 [&_input]:bg-[#f9f8f5] [&_input]:px-4 [&_input]:py-3 [&_input]:outline-none [&_input]:transition [&_input]:focus:border-[#0a5c3e] [&_select]:w-full [&_select]:rounded-2xl [&_select]:border [&_select]:border-slate-900/10 [&_select]:bg-[#f9f8f5] [&_select]:px-4 [&_select]:py-3 [&_select]:outline-none [&_select]:transition [&_select]:focus:border-[#0a5c3e] [&_textarea]:w-full [&_textarea]:rounded-3xl [&_textarea]:border [&_textarea]:border-slate-900/10 [&_textarea]:bg-[#f9f8f5] [&_textarea]:px-4 [&_textarea]:py-3 [&_textarea]:outline-none [&_textarea]:transition [&_textarea]:focus:border-[#0a5c3e]">
        {children}
      </div>
    </label>
  );
}

function Panel({ icon: Icon, title, children }) {
  return (
    <div className="rounded-[2rem] border border-slate-900/10 bg-white/80 p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)]">
      <div className="mb-4 flex items-center gap-3">
        <Icon className="text-[#0a5c3e]" />
        <h3 className="font-display text-2xl text-slate-950">{title}</h3>
      </div>
      <p className="text-sm leading-7 text-slate-600">{children}</p>
    </div>
  );
}

function ToggleCard({ title, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="rounded-3xl border border-slate-900/10 bg-[#f9f8f5] p-4 text-left"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{title}</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Flag sites near wetlands, floodways, tidelands, or regulated waterways.
          </p>
        </div>
        <div
          className={`flex h-8 w-14 items-center rounded-full p-1 transition ${
            checked ? "bg-[#0a5c3e]" : "bg-slate-300"
          }`}
        >
          <span
            className={`h-6 w-6 rounded-full bg-white transition ${checked ? "translate-x-6" : ""}`}
          />
        </div>
      </div>
    </button>
  );
}

export default App;
