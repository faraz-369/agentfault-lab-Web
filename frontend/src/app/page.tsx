"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Atom,
  Bell,
  BookOpen,
  Braces,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Command,
  Download,
  ExternalLink,
  FileCode2,
  FlaskConical,
  Gauge,
  GitBranch,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Menu,
  Play,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ExecutionEvent, RunResult, Scenario } from "@/lib/types";

const POLICIES = [
  { id: "none", label: "No recovery", note: "Fail fast" },
  { id: "retry", label: "Blind retry", note: "Retry on error" },
  { id: "state_aware", label: "State-aware", note: "Verify before retry" },
] as const;

type Notice = { tone: "error" | "success"; text: string } | null;

function prettyPolicy(policy: string) {
  return POLICIES.find((item) => item.id === policy)?.label ?? policy.replaceAll("_", " ");
}

function prettyEvent(event: ExecutionEvent) {
  return event.event_type.replaceAll("_", " ");
}

function formatDuration(value: number) {
  return value < 1 ? `${value.toFixed(2)} ms` : `${value.toFixed(1)} ms`;
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState("");
  const [selectedPolicies, setSelectedPolicies] = useState<string[]>(["none", "retry", "state_aware"]);
  const [trials, setTrials] = useState(3);
  const [results, setResults] = useState<RunResult[]>([]);
  const [activeResult, setActiveResult] = useState<RunResult | null>(null);
  const [loadingScenarios, setLoadingScenarios] = useState(true);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [activeNav, setActiveNav] = useState("Overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [search, setSearch] = useState("");

  const loadScenarios = useCallback(async () => {
    setLoadingScenarios(true);
    try {
      const response = await fetch("/api/backend/scenarios", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail ?? "Could not load scenarios.");
      const items = payload as Scenario[];
      setScenarios(items);
      setSelectedScenario((current) => current || items[0]?.scenario_id || "");
      setNotice(null);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not connect to the API.",
      });
    } finally {
      setLoadingScenarios(false);
    }
  }, []);

  useEffect(() => {
    void loadScenarios();
  }, [loadScenarios]);

  const selectedScenarioDetails = scenarios.find((item) => item.scenario_id === selectedScenario);
  const filteredScenarios = scenarios.filter((scenario) => {
    const searchable = `${scenario.name} ${scenario.description} ${scenario.tags.join(" ")}`.toLowerCase();
    return searchable.includes(search.toLowerCase());
  });

  const successRate = results.length
    ? Math.round((results.filter((result) => result.success).length / results.length) * 100)
    : 0;
  const violations = results.reduce((sum, result) => sum + result.invariant_violations.length, 0);
  const retries = results.reduce((sum, result) => sum + result.retries, 0);
  const totalEvents = results.reduce((sum, result) => sum + result.event_count, 0);

  const policyStats = useMemo(() => POLICIES.map((policy) => {
    const rows = results.filter((result) => result.policy === policy.id);
    const success = rows.length ? Math.round((rows.filter((row) => row.success).length / rows.length) * 100) : 0;
    const violationCount = rows.reduce((sum, row) => sum + row.invariant_violations.length, 0);
    return { ...policy, count: rows.length, success, violationCount };
  }), [results]);

  async function runExperiment() {
    if (!selectedScenario) {
      setNotice({ tone: "error", text: "Choose a scenario before running an experiment." });
      return;
    }
    if (!selectedPolicies.length) {
      setNotice({ tone: "error", text: "Select at least one recovery policy." });
      return;
    }
    setRunning(true);
    setNotice(null);
    setResults([]);
    setActiveResult(null);
    try {
      const response = await fetch("/api/backend/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario_ids: [selectedScenario], policies: selectedPolicies, trials }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail ?? "Experiment failed to run.");

      const experimentRows = (payload.runs as Omit<RunResult, "events">[]).map((row) => ({
        ...row,
        events: [],
      }));

      // Load a real event stream for the selected policy so the trace explorer
      // displays recorded events rather than inferred or fabricated rows.
      const tracePolicy = selectedPolicies.includes("state_aware")
        ? "state_aware"
        : selectedPolicies[0];
      const traceResponse = await fetch("/api/backend/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario_id: selectedScenario, policy: tracePolicy, seed: 7 }),
      });
      const tracePayload = await traceResponse.json();
      if (!traceResponse.ok) throw new Error(tracePayload.detail ?? "Experiment ran, but trace loading failed.");

      setResults(experimentRows);
      setActiveResult(tracePayload as RunResult);
      setNotice({ tone: "success", text: `Experiment completed. Report ID: ${payload.report?.experiment_id ?? "saved"}.` });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Experiment failed." });
    } finally {
      setRunning(false);
    }
  }

  const navItems = [
    { label: "Overview", icon: Layers3 },
    { label: "Experiments", icon: FlaskConical },
    { label: "Trace explorer", icon: Activity },
    { label: "Scenarios", icon: Braces },
  ];

  function navigate(label: string) {
    setActiveNav(label);
    setMobileNav(false);
    if (label === "Scenarios") document.getElementById("scenario-library")?.scrollIntoView({ behavior: "smooth" });
    else if (label === "Trace explorer") document.getElementById("trace-explorer")?.scrollIntoView({ behavior: "smooth" });
    else if (label === "Experiments") document.getElementById("experiment-builder")?.scrollIntoView({ behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Atom size={23} strokeWidth={1.8} /></div>
          <div><div className="brand-name">agentfault<span>.</span></div><div className="brand-caption">RELIABILITY LAB</div></div>
          <button className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>

        <div className="workspace-picker">
          <div className="workspace-avatar">AF</div>
          <div className="workspace-copy"><strong>Research workspace</strong><span>Personal environment</span></div>
          <ChevronDown size={15} className="muted-icon" />
        </div>

        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${activeNav === label ? "active" : ""}`} onClick={() => navigate(label)}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>{label === "Experiments" && <span className="nav-count">{results.length ? 1 : 0}</span>}
            </button>
          ))}
        </nav>

        <div className="nav-label nav-label-spaced">TOOLS</div>
        <div className="main-nav">
          <a className="nav-item" href="/api/backend/health" target="_blank" rel="noreferrer"><Radio size={17} /><span>API status</span><ExternalLink size={12} className="nav-external" /></a>
          <a className="nav-item" href="https://github.com/faraz-369/agentfault-lab" target="_blank" rel="noreferrer"><GitBranch size={17} /><span>GitHub repository</span><ExternalLink size={12} className="nav-external" /></a>
          <a className="nav-item" href="https://fastapi.tiangolo.com/" target="_blank" rel="noreferrer"><BookOpen size={17} /><span>API documentation</span><ExternalLink size={12} className="nav-external" /></a>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-status"><span className="status-dot" /><span>Simulation engine</span><span className="status-live">READY</span></div>
          <div className="user-card"><div className="user-avatar">F</div><div className="user-copy"><strong>Researcher</strong><span>Community edition</span></div><button className="icon-button" aria-label="Account options"><ChevronDown size={15} /></button></div>
        </div>
      </aside>

      {mobileNav && <button className="mobile-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation overlay" />}

      <section className="main-panel">
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={20} /></button><span className="breadcrumb">Workspace</span><span className="breadcrumb-slash">/</span><strong>{activeNav}</strong></div>
          <div className="topbar-right"><div className="command-hint"><Command size={13} /><span>Research mode</span></div><button className="icon-button notification-button" aria-label="Notifications"><Bell size={17} /><span /></button><div className="topbar-divider" /><div className="mini-avatar">F</div></div>
        </header>

        <div className="content-wrap">
          <section className="welcome-row">
            <div><div className="eyebrow"><span className="eyebrow-line" /> AGENT RELIABILITY / LAB 01</div><h1>Make failure <span>measurable.</span></h1><p className="welcome-copy">Stress-test agent workflows, compare recovery strategies, and find the failure modes before production does.</p></div>
            <div className="welcome-actions"><div className="build-badge"><span className="status-dot" /> ENGINE ONLINE <span className="badge-divider" /> v0.1.0</div><a className="text-link" href="https://github.com/faraz-369/agentfault-lab" target="_blank" rel="noreferrer"><GitBranch size={15} /> View source <ArrowUpRight size={14} /></a></div>
          </section>

          {notice && <div className={`notice ${notice.tone}`} role="status"><div className="notice-icon">{notice.tone === "success" ? <Check size={16} /> : <ShieldAlert size={16} />}</div><div>{notice.text}</div><button className="icon-button" onClick={() => setNotice(null)} aria-label="Dismiss message"><X size={16} /></button></div>}

          <section className="metrics-grid" aria-label="Experiment metrics">
            <MetricCard label="TASK SUCCESS RATE" value={`${successRate}%`} caption={results.length ? `${results.filter((row) => row.success).length} successful runs` : "Waiting for first experiment"} icon={<Gauge size={17} />} trend={results.length ? "LIVE DATA" : "NO DATA YET"} trendUp={results.length > 0} />
            <MetricCard label="INVARIANT VIOLATIONS" value={String(violations)} caption="Across displayed runs" icon={<ShieldAlert size={17} />} trend={violations ? "NEEDS ATTENTION" : "GUARDRAILS READY"} trendUp={!violations} />
            <MetricCard label="RECOVERY ACTIONS" value={String(retries)} caption="Retries observed in runs" icon={<RefreshCw size={17} />} trend={results.length ? "RUN COMPLETE" : "AWAITING RUN"} trendUp={results.length > 0} />
            <MetricCard label="TRACE EVENTS" value={String(totalEvents)} caption="Recorded execution events" icon={<Activity size={17} />} trend={activeResult ? "TRACE AVAILABLE" : "NO TRACE YET"} trendUp={!!activeResult} />
          </section>

          <section className="workspace-grid">
            <div className="panel experiment-panel" id="experiment-builder">
              <div className="panel-heading"><div><div className="section-kicker"><Sparkles size={13} /> EXPERIMENT STUDIO</div><h2>Configure a run</h2><p>Choose a fault scenario and put recovery policies to the test.</p></div><div className="panel-icon"><FlaskConical size={19} /></div></div>
              <div className="form-divider" />
              <label className="field-label" htmlFor="scenario-select">SCENARIO</label>
              <div className="select-wrap"><select id="scenario-select" value={selectedScenario} onChange={(event) => setSelectedScenario(event.target.value)} disabled={loadingScenarios || !scenarios.length}><option value="">{loadingScenarios ? "Loading scenarios…" : "Select a scenario"}</option>{scenarios.map((scenario) => <option value={scenario.scenario_id} key={scenario.scenario_id}>{scenario.name}</option>)}</select><ChevronDown size={16} /></div>
              <div className="selected-scenario-note">{selectedScenarioDetails?.description ?? (loadingScenarios ? "Fetching scenarios from the API…" : "Choose one of the available scenarios.")}</div>
              <div className="field-label policy-label">RECOVERY POLICIES <span>Select one or more</span></div>
              <div className="policy-options">{POLICIES.map((policy, index) => <button key={policy.id} className={`policy-option ${selectedPolicies.includes(policy.id) ? "selected" : ""}`} onClick={() => setSelectedPolicies((current) => current.includes(policy.id) ? current.filter((item) => item !== policy.id) : [...current, policy.id])} aria-pressed={selectedPolicies.includes(policy.id)}><span className={`policy-symbol symbol-${index}`}>{index === 0 ? <X size={15} /> : index === 1 ? <RefreshCw size={15} /> : <ShieldCheck size={15} />}</span><span className="policy-text"><strong>{policy.label}</strong><small>{policy.note}</small></span><span className="policy-check">{selectedPolicies.includes(policy.id) && <Check size={12} />}</span></button>)}</div>
              <div className="trial-row"><div><label className="field-label" htmlFor="trial-count">TRIALS PER POLICY</label><p>Repeat each policy for comparison.</p></div><div className="stepper"><button onClick={() => setTrials((value) => Math.max(1, value - 1))} disabled={trials <= 1} aria-label="Decrease trials">−</button><span>{trials}</span><button onClick={() => setTrials((value) => Math.min(10, value + 1))} disabled={trials >= 10} aria-label="Increase trials">+</button></div></div>
              <button className="primary-button run-button" onClick={runExperiment} disabled={running || loadingScenarios || !scenarios.length}><span>{running ? <LoaderCircle size={17} className="spin" /> : <Play size={16} fill="currentColor" />}</span>{running ? "Running experiment…" : "Run experiment"}<ArrowRight size={16} className="button-arrow" /></button>
              <div className="run-footnote"><LockKeyhole size={12} /> Runs execute on the configured AgentFault API.</div>
            </div>

            <div className="panel performance-panel">
              <div className="panel-heading compact"><div><div className="section-kicker"><Activity size={13} /> PERFORMANCE SNAPSHOT</div><h2>Policy comparison</h2><p>Success and invariant health by strategy.</p></div><button className="icon-button" onClick={() => setResults([])} title="Clear displayed results" aria-label="Clear displayed results"><RefreshCw size={15} /></button></div>
              <div className="comparison-legend"><span><i className="legend-success" /> Task success</span><span><i className="legend-violation" /> Invariant health</span></div>
              <div className="policy-chart">{policyStats.map((policy, index) => <div className="chart-row" key={policy.id}><div className="chart-label"><span className={`chart-dot chart-dot-${index}`} /><span>{policy.label}</span><small>{policy.count ? `${policy.count} runs` : "No runs"}</small></div><div className="chart-bars"><div className="bar-track"><div className={`bar-fill fill-${index}`} style={{ width: `${policy.count ? policy.success : 0}%` }} /></div><div className="bar-meta"><strong>{policy.count ? `${policy.success}%` : "—"}</strong><span>{policy.count ? `${policy.violationCount} violations` : "Awaiting data"}</span></div></div></div>)}</div>
              <div className="chart-insight"><div className="insight-icon"><Zap size={15} /></div><div><strong>{results.length ? "Experiment data loaded" : "Your next insight starts here"}</strong><p>{results.length ? "Use the trace explorer below to inspect the recorded execution." : "Run the same scenario under multiple policies to compare their behavior."}</p></div></div>
              <div className="panel-bottom-meta"><span><span className="tiny-status" /> Deterministic simulator</span><span>Trials: {results.length ? trials : "—"}</span><span>Seed: 7</span></div>
            </div>
          </section>

          <section className="panel scenarios-panel" id="scenario-library">
            <div className="panel-heading scenario-heading"><div><div className="section-kicker"><Braces size={13} /> SCENARIO LIBRARY</div><h2>Fault scenarios</h2><p>Controlled failure modes shipped with AgentFault Lab.</p></div><div className="scenario-heading-actions"><div className="search-box"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter scenarios" aria-label="Filter scenarios" /></div><button className="icon-button" onClick={loadScenarios} disabled={loadingScenarios} title="Refresh scenarios" aria-label="Refresh scenarios"><RefreshCw size={15} className={loadingScenarios ? "spin" : ""} /></button></div></div>
            {loadingScenarios ? <div className="empty-state"><LoaderCircle size={20} className="spin" /> Loading scenarios from your API…</div> : filteredScenarios.length ? <div className="scenario-list">{filteredScenarios.map((scenario, index) => <button className={`scenario-row ${selectedScenario === scenario.scenario_id ? "scenario-selected" : ""}`} key={scenario.scenario_id} onClick={() => { setSelectedScenario(scenario.scenario_id); document.getElementById("experiment-builder")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}><div className={`scenario-icon scenario-icon-${index % 3}`}>{index % 3 === 0 ? <Radio size={18} /> : index % 3 === 1 ? <FileCode2 size={18} /> : <Clock3 size={18} />}</div><div className="scenario-info"><div className="scenario-title-line"><strong>{scenario.name}</strong><span className="scenario-id">{scenario.scenario_id}</span></div><p>{scenario.description}</p><div className="tag-row">{scenario.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div></div><div className="scenario-state"><span className="scenario-ready"><span /> READY</span><ArrowRight size={16} /></div></button>)}</div> : <div className="empty-state"><Search size={18} /> No scenarios match “{search}”.</div>}
            <div className="scenario-footer"><span><span className="tiny-status" /> {scenarios.length} scenarios available from API</span><span>Click a scenario to configure it <ArrowRight size={13} /></span></div>
          </section>

          <section className="panel trace-panel" id="trace-explorer">
            <div className="panel-heading scenario-heading"><div><div className="section-kicker"><Terminal size={13} /> EXECUTION TELEMETRY</div><h2>Trace explorer</h2><p>Inspect the event stream from the most recent individual run.</p></div>{activeResult && <button className="secondary-button" onClick={() => downloadJson(`agentfault-trace-${activeResult.run_id}.json`, activeResult)}><Download size={14} /> Export trace</button>}</div>
            {!activeResult ? <div className="trace-empty"><div className="trace-empty-icon"><Activity size={21} /></div><div><strong>No trace selected</strong><p>Run an experiment to inspect tool calls, fault injection, recovery and invariant events.</p></div><button className="text-link-button" onClick={() => document.getElementById("experiment-builder")?.scrollIntoView({ behavior: "smooth", block: "center" })}>Configure a run <ArrowRight size={14} /></button></div> : <><div className="trace-summary"><div><span>RUN ID</span><strong>{activeResult.run_id.slice(0, 18)}…</strong></div><div><span>POLICY</span><strong>{prettyPolicy(activeResult.policy)}</strong></div><div><span>DURATION</span><strong>{formatDuration(activeResult.duration_ms)}</strong></div><div><span>OUTCOME</span><strong className={activeResult.success ? "outcome-good" : "outcome-bad"}>{activeResult.success ? "SUCCESS" : "FAILED"}</strong></div></div><div className="trace-table-wrap"><table className="trace-table"><thead><tr><th>SEQ</th><th>EVENT</th><th>NAME</th><th>DETAILS</th><th>TIME</th></tr></thead><tbody>{activeResult.events.slice(0, 30).map((event) => <tr key={event.event_id}><td className="sequence-cell">{String(event.sequence).padStart(3, "0")}</td><td><EventBadge type={event.event_type} /></td><td className="trace-name">{event.name || "—"}</td><td className="trace-details">{JSON.stringify(event.details).slice(0, 100) || "—"}</td><td className="trace-time">{new Date(event.timestamp).toLocaleTimeString()}</td></tr>)}</tbody></table></div><div className="trace-footer"><span>{activeResult.events.length} events recorded{activeResult.events.length > 30 ? " · showing first 30" : ""}</span><span>{activeResult.tool_calls} tool calls · {activeResult.retries} retries</span></div></>}
          </section>

          <footer className="app-footer"><div className="footer-brand"><div className="brand-mark small"><Atom size={16} /></div><span>agentfault<span className="brand-period">.</span></span><span className="footer-version">v0.1.0 · Community edition</span></div><div className="footer-links"><span><ShieldCheck size={13} /> Built for reproducibility</span><a href="https://github.com/faraz-369/agentfault-lab" target="_blank" rel="noreferrer">Open source <ArrowUpRight size={12} /></a><a href="https://github.com/faraz-369/agentfault-lab/issues" target="_blank" rel="noreferrer"><CircleHelp size={13} /> Feedback</a></div></footer>
        </div>
      </section>
    </main>
  );
}

function MetricCard({ label, value, caption, icon, trend, trendUp }: { label: string; value: string; caption: string; icon: ReactNode; trend: string; trendUp: boolean }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><div className="metric-icon">{icon}</div></div><div className="metric-value-row"><strong>{value}</strong><span className={`metric-trend ${trendUp ? "trend-positive" : "trend-neutral"}`}>{trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{trend}</span></div><p>{caption}</p><div className="metric-sparkline"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div></article>;
}

function EventBadge({ type }: { type: string }) {
  const isGood = ["run_started", "run_finished", "tool_result", "state_changed"].includes(type);
  const isBad = ["tool_error", "invariant_violation", "fault_injected"].includes(type);
  return <span className={`event-badge ${isGood ? "event-good" : isBad ? "event-bad" : "event-neutral"}`}><span />{prettyEvent({ event_type: type } as ExecutionEvent)}</span>;
}
