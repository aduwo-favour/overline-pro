import { useState, useRef, useEffect } from "react";

// ─── DESIGN TOKENS ──────────────────────────────────────────────────────────
const C = {
  bg: "#070B12",
  surface: "#0D1520",
  card: "#111D2E",
  border: "#1A2840",
  borderHi: "#243856",
  accent: "#F0B429",
  accentDim: "#F0B42920",
  green: "#10D06E",
  greenDim: "#10D06E18",
  red: "#F0413C",
  redDim: "#F0413C18",
  yellow: "#F0B429",
  yellowDim: "#F0B42918",
  text: "#E2EAF4",
  dim: "#4A6080",
  dimMid: "#6B8299",
  mono: "'IBM Plex Mono', monospace",
  sans: "'DM Sans', sans-serif",
};

// ─── MULTI-SOURCE SYSTEM PROMPT ─────────────────────────────────────────────
const SYSTEM = `You are OVERLINE PRO — the world's most rigorous 1st Half basketball betting analyst.

Your mandate: produce deterministic, source-locked analysis. The SAME game analyzed twice MUST produce the SAME conclusion. You achieve this by:
1. Searching EACH data source SEPARATELY with precise queries
2. Cross-referencing every stat across sources — flag conflicts
3. Scoring each factor on a fixed 1–10 rubric (defined below)
4. Using a weighted formula to produce a final confidence score

═══ DATA SOURCE PROTOCOL ═══
Search these sources IN ORDER, with the EXACT query types listed:

SOURCE 1 — NBA.COM / Official Stats:
  Query: "[team] 1st half points per game 2025 NBA stats"
  Query: "[team] first half pace offensive rating official"
  Collect: 1H PPG, 1H OPPG, pace rank, off/def rating

SOURCE 2 — ESPN:
  Query: "[team1] vs [team2] ESPN preview 2025"
  Query: "[team] ESPN recent game scores 2025"
  Collect: injury report, recent form last 5 games, starting lineup

SOURCE 3 — Basketball-Reference:
  Query: "[team1] vs [team2] basketball-reference game log 2025"
  Query: "[team] 1st quarter 2nd quarter points allowed basketball reference"
  Collect: H2H last 5 meetings and their 1H totals, season averages

SOURCE 4 — Rotowire:
  Query: "rotowire [team] injury report [today's date]"
  Query: "rotowire [team1] [team2] starting lineup"
  Collect: ALL injuries (questionable/out/probable), confirmed starters

═══ SCORING RUBRIC (each factor 1–10) ═══

FACTOR 1 — FIRST HALF PACE (weight: 20%)
10 = Both teams top-10 pace, 15+ fast break pts/game each
7  = One fast, one avg
4  = Both average pace
1  = Both bottom-10 slowest teams

FACTOR 2 — 1H OFFENSIVE OUTPUT (weight: 20%)
Score based on combined avg 1H points per game:
70+ combined = 10, 65-69 = 8, 60-64 = 6, 55-59 = 4, <55 = 2

FACTOR 3 — DEFENSIVE VULNERABILITY (weight: 20%)
10 = Both teams bottom-10 defense (120+ DRTG)
7  = One poor defense
4  = One strong defense
1  = Both elite defenses (sub-108 DRTG)

FACTOR 4 — INJURY IMPACT (weight: 15%)
10 = Key defenders missing for both teams
7  = One key defender out
5  = No significant injuries
2  = Key scorers missing (lowers total)
0  = Multiple scorers out (strongly lowers total)

FACTOR 5 — H2H FIRST HALF HISTORY (weight: 10%)
Score: (avg H2H 1H total - 50) / 3, capped 1-10
If no H2H data available, score = 5

FACTOR 6 — RECENT 1H FORM (weight: 10%)
Count how many of last 5 games each team's 1H total went OVER their season avg:
Both teams 4-5 of 5 = 10, 3 of 5 = 7, 2 of 5 = 4, 0-1 of 5 = 1

FACTOR 7 — LINE VALUE (weight: 5%)
If market line is below the calculated projection = 10 (value)
If market line matches projection = 5
If market line is above projection = 1

═══ CALCULATION ═══
Weighted Score = (F1×0.20)+(F2×0.20)+(F3×0.20)+(F4×0.15)+(F5×0.10)+(F6×0.10)+(F7×0.05)
Confidence % = Weighted Score × 10

VERDICT:
85-100% = STRONG OVER
70-84%  = LEAN OVER
50-69%  = NEUTRAL
35-49%  = LEAN UNDER
0-34%   = STRONG UNDER

═══ SOURCE CONFLICT PROTOCOL ═══
If two sources give different stats for the same metric:
- Use the more specific/recent source
- FLAG it: [CONFLICT: ESPN says X, BBRef says Y — using X]

═══ OUTPUT FORMAT ═══
Respond ONLY with a valid JSON object. No markdown, no preamble. Exact structure:

{
  "game": "[Team1] vs [Team2]",
  "market": "1st Half Over/Under",
  "line": "[line]",
  "analysisDate": "[today]",
  "sources": {
    "nba_official": "[what was found or 'not available']",
    "espn": "[what was found or 'not available']",
    "basketball_reference": "[what was found or 'not available']",
    "rotowire": "[what was found or 'not available']"
  },
  "conflicts": ["list any source conflicts, or empty array"],
  "factors": {
    "pace":        { "score": 0, "max": 10, "weight": 0.20, "detail": "explanation" },
    "offense":     { "score": 0, "max": 10, "weight": 0.20, "detail": "explanation" },
    "defense":     { "score": 0, "max": 10, "weight": 0.20, "detail": "explanation" },
    "injuries":    { "score": 0, "max": 10, "weight": 0.15, "detail": "explanation" },
    "h2h":         { "score": 0, "max": 10, "weight": 0.10, "detail": "explanation" },
    "recent_form": { "score": 0, "max": 10, "weight": 0.10, "detail": "explanation" },
    "line_value":  { "score": 0, "max": 10, "weight": 0.05, "detail": "explanation" }
  },
  "weighted_score": 0.0,
  "confidence_pct": 0,
  "projected_1h_total": 0,
  "verdict": "STRONG OVER | LEAN OVER | NEUTRAL | LEAN UNDER | STRONG UNDER",
  "safe_to_bet": true,
  "summary": "2-3 sentence executive summary",
  "key_edges": ["top 3 reasons to bet this", "..."],
  "key_risks": ["top 3 reasons it fails", "..."],
  "data_quality": "HIGH | MEDIUM | LOW",
  "data_quality_reason": "explanation of confidence in data found"
}`;

// ─── HELPERS ────────────────────────────────────────────────────────────────
const FACTOR_META = {
  pace:        { label: "Pace & Tempo",        icon: "⚡", color: "#60CFFF" },
  offense:     { label: "1H Offensive Output", icon: "🏀", color: "#F0B429" },
  defense:     { label: "Defensive Weakness",  icon: "🛡️", color: "#A78BFA" },
  injuries:    { label: "Injury Impact",       icon: "🤕", color: "#FF6B6B" },
  h2h:         { label: "H2H 1H History",      icon: "📊", color: "#34D399" },
  recent_form: { label: "Recent 1H Form",      icon: "🔥", color: "#F97316" },
  line_value:  { label: "Line Value",          icon: "💰", color: "#10D06E" },
};

const verdictStyle = (v) => {
  if (!v) return { color: C.dim, bg: C.card };
  const u = v.toUpperCase();
  if (u.includes("STRONG OVER"))  return { color: C.green,   bg: C.greenDim,  label: "STRONG OVER ✅" };
  if (u.includes("LEAN OVER"))    return { color: C.yellow,  bg: C.yellowDim, label: "LEAN OVER 🟡" };
  if (u.includes("NEUTRAL"))      return { color: C.dimMid,  bg: C.card,      label: "NEUTRAL ⚪" };
  if (u.includes("LEAN UNDER"))   return { color: "#F97316", bg: "#F9731618", label: "LEAN UNDER 🟠" };
  if (u.includes("STRONG UNDER")) return { color: C.red,     bg: C.redDim,    label: "STRONG UNDER ❌" };
  return { color: C.dim, bg: C.card, label: v };
};

const dqColor = (q) => q === "HIGH" ? C.green : q === "MEDIUM" ? C.yellow : C.red;

// ─── SUB-COMPONENTS ─────────────────────────────────────────────────────────
function ScoreBar({ score, max = 10, color }) {
  const pct = Math.min(100, (score / max) * 100);
  return (
    <div style={{ background: C.surface, borderRadius: 4, height: 6, width: "100%", overflow: "hidden" }}>
      <div style={{
        width: `${pct}%`, height: "100%",
        background: `linear-gradient(90deg, ${color}99, ${color})`,
        borderRadius: 4,
        transition: "width 1s cubic-bezier(.4,0,.2,1)",
      }} />
    </div>
  );
}

function FactorCard({ fkey, data }) {
  const meta = FACTOR_META[fkey];
  if (!meta || !data) return null;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>{meta.icon}</span>
          <span style={{ fontFamily: C.mono, fontSize: 10, color: meta.color, letterSpacing: 1.5 }}>{meta.label.toUpperCase()}</span>
          <span style={{ fontFamily: C.mono, fontSize: 9, color: C.dim, background: C.surface, padding: "2px 6px", borderRadius: 4 }}>
            W: {Math.round(data.weight * 100)}%
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontFamily: C.mono, fontSize: 20, fontWeight: 700, color: meta.color }}>{data.score}</span>
          <span style={{ fontFamily: C.mono, fontSize: 11, color: C.dim }}>/10</span>
        </div>
      </div>
      <ScoreBar score={data.score} max={data.max} color={meta.color} />
      <p style={{ color: C.dimMid, fontSize: 12, margin: "8px 0 0", lineHeight: 1.6 }}>{data.detail}</p>
    </div>
  );
}

function SourceBadge({ label, value, icon }) {
  const avail = value && !value.toLowerCase().includes("not available");
  return (
    <div style={{ background: C.surface, border: `1px solid ${avail ? C.borderHi : C.border}`, borderRadius: 8, padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: C.mono, fontSize: 9, color: avail ? C.accent : C.dim, letterSpacing: 2, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 11, color: avail ? C.dimMid : C.dim, lineHeight: 1.5, wordBreak: "break-word" }}>{value || "—"}</div>
      </div>
      <div style={{ flexShrink: 0, width: 8, height: 8, borderRadius: "50%", marginTop: 2, background: avail ? C.green : C.dim, boxShadow: avail ? `0 0 6px ${C.green}` : "none" }} />
    </div>
  );
}

function ConfidenceRing({ pct }) {
  const r = 54, circ = 2 * Math.PI * r;
  const fill = (pct / 100) * circ;
  const color = pct >= 70 ? C.green : pct >= 50 ? C.yellow : C.red;
  return (
    <svg width={130} height={130} viewBox="0 0 130 130">
      <circle cx={65} cy={65} r={r} fill="none" stroke={C.border} strokeWidth={10} />
      <circle cx={65} cy={65} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 65 65)"
        style={{ transition: "stroke-dasharray 1.5s cubic-bezier(.4,0,.2,1)", filter: `drop-shadow(0 0 8px ${color})` }}
      />
      <text x={65} y={60} textAnchor="middle" fill={color} fontSize={22} fontFamily={C.mono} fontWeight={700}>{pct}%</text>
      <text x={65} y={80} textAnchor="middle" fill={C.dim} fontSize={9} fontFamily={C.mono} letterSpacing={2}>CONFIDENCE</text>
    </svg>
  );
}

const STEPS = [
  { id: "nba",   label: "NBA Official Stats",   icon: "🏀" },
  { id: "espn",  label: "ESPN Live Data",        icon: "📡" },
  { id: "bbref", label: "Basketball-Reference", icon: "📊" },
  { id: "roto",  label: "Rotowire Injuries",     icon: "🤕" },
  { id: "calc",  label: "Cross-Referencing",     icon: "🔗" },
  { id: "score", label: "Scoring All Factors",   icon: "⚖️" },
  { id: "final", label: "Finalizing Verdict",    icon: "✅" },
];

function StepTracker({ current }) {
  return (
    <div style={{ padding: "0 4px" }}>
      {STEPS.map((s, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: done ? C.green : active ? C.accent : C.surface,
                border: `2px solid ${done ? C.green : active ? C.accent : C.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, flexShrink: 0,
                boxShadow: active ? `0 0 16px ${C.accent}60` : done ? `0 0 8px ${C.green}40` : "none",
                transition: "all 0.4s ease",
              }}>
                {done ? "✓" : s.icon}
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ width: 2, height: 20, margin: "3px 0", background: done ? C.green : C.border, transition: "background 0.4s ease" }} />
              )}
            </div>
            <div style={{ paddingBottom: i < STEPS.length - 1 ? 20 : 0 }}>
              <div style={{ fontFamily: C.mono, fontSize: 11, color: done ? C.green : active ? C.accent : C.dim, letterSpacing: 1, transition: "color 0.4s ease" }}>
                {s.label}{active && <span style={{ animation: "blink 1s infinite" }}> ●</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [team1,   setTeam1]   = useState("");
  const [team2,   setTeam2]   = useState("");
  const [line,    setLine]    = useState("");
  const [extra,   setExtra]   = useState("");
  const [loading, setLoading] = useState(false);
  const [step,    setStep]    = useState(-1);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState("");
  const topRef = useRef(null);

  useEffect(() => {
    if (!loading) { setStep(-1); return; }
    setStep(0);
    const timings = [6000, 14000, 22000, 30000, 36000, 42000, 48000];
    const timers = timings.map((t, i) => setTimeout(() => setStep(i + 1), t));
    return () => timers.forEach(clearTimeout);
  }, [loading]);

  async function analyze() {
    if (!team1.trim() || !team2.trim() || !line.trim()) {
      setError("Please enter both team names and the 1H over/under line.");
      return;
    }
    setError("");
    setResult(null);
    setLoading(true);

    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const userMsg = `Analyze the 1st Half Over/Under for this NBA game:

Teams: ${team1.trim()} vs ${team2.trim()}
1st Half O/U Line: ${line.trim()}
Date: ${today}
${extra.trim() ? `Additional context: ${extra.trim()}` : ""}

CRITICAL INSTRUCTIONS:
- Search ALL FOUR sources in order: NBA official stats, ESPN, Basketball-Reference, Rotowire
- Use the EXACT search queries specified in your instructions for each source
- Score every factor using the exact rubric provided
- Calculate the weighted score precisely
- Respond ONLY with the JSON object — no markdown, no explanation outside the JSON`;

    try {
      // Calls our serverless proxy at /api/analyze — API key stays safe on the server
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          system: SYSTEM,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: userMsg }],
        }),
      });

      const data = await resp.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

      const raw   = (data.content || []).map(b => b.type === "text" ? b.text : "").filter(Boolean).join("\n");
      const clean = raw.replace(/```json|```/g, "").trim();
      const match = clean.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Could not parse response — check your API key is set correctly in Vercel.");
      const parsed = JSON.parse(match[0]);
      setResult(parsed);
      setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      setError("Analysis error: " + e.message);
    }
    setLoading(false);
  }

  const vs = verdictStyle(result?.verdict);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: C.sans, paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, textarea { font-family: inherit; outline: none; }
        input::placeholder, textarea::placeholder { color: #243856; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
        @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .inp:focus { border-color: ${C.accent} !important; }
        .btn-main:hover:not(:disabled) { background: #E6A820 !important; transform: translateY(-1px); box-shadow: 0 8px 32px #F0B42940; }
        .btn-main:active:not(:disabled) { transform: translateY(0); }
        .btn-reset:hover { border-color: ${C.dimMid} !important; color: ${C.text} !important; }
      `}</style>

      {/* HEADER */}
      <div style={{ background: `linear-gradient(180deg, #0D1828 0%, ${C.bg} 100%)`, borderBottom: `1px solid ${C.border}`, padding: "36px 24px 30px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(ellipse 60% 50% at 50% 0%, #F0B42910 0%, transparent 70%)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontFamily: C.mono, fontSize: 9, color: C.accent, letterSpacing: 5, marginBottom: 14, opacity: 0.9 }}>
            MULTI-SOURCE · 1ST HALF ANALYSIS · AI-POWERED
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 10 }}>
            <span style={{ fontSize: 36 }}>🏀</span>
            <h1 style={{ fontFamily: C.mono, fontSize: 32, fontWeight: 700, color: "#fff", letterSpacing: -1, lineHeight: 1 }}>
              OVERLINE<span style={{ color: C.accent }}> PRO</span>
            </h1>
          </div>
          <p style={{ color: C.dim, fontSize: 13, maxWidth: 420, margin: "0 auto", lineHeight: 1.6 }}>
            Four-source cross-referenced 1st Half prediction engine.<br />
            NBA API · ESPN · Basketball-Reference · Rotowire
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "32px 16px 0" }} ref={topRef}>

        {/* INPUT CARD */}
        {!result && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "28px 24px", marginBottom: 24, animation: "fadeUp 0.5s ease" }}>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.accent, letterSpacing: 3, marginBottom: 22 }}>GAME INPUT</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              {[
                { label: "HOME TEAM", val: team1, set: setTeam1, ph: "e.g. Boston Celtics" },
                { label: "AWAY TEAM", val: team2, set: setTeam2, ph: "e.g. Miami Heat" },
              ].map(({ label, val, set, ph }) => (
                <div key={label}>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.dim, letterSpacing: 2, marginBottom: 6 }}>{label}</div>
                  <input className="inp" value={val} onChange={e => set(e.target.value)} placeholder={ph}
                    style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", color: C.text, fontSize: 14, transition: "border-color 0.2s" }} />
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: C.mono, fontSize: 9, color: C.dim, letterSpacing: 2, marginBottom: 6 }}>1ST HALF OVER/UNDER LINE</div>
              <input className="inp" value={line} onChange={e => setLine(e.target.value)} placeholder="e.g. 112.5"
                style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", color: C.accent, fontSize: 20, fontFamily: C.mono, fontWeight: 700, transition: "border-color 0.2s" }} />
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: C.mono, fontSize: 9, color: C.dim, letterSpacing: 2, marginBottom: 6 }}>EXTRA CONTEXT (OPTIONAL)</div>
              <textarea className="inp" value={extra} onChange={e => setExtra(e.target.value)} rows={2}
                placeholder="e.g. LeBron questionable, back-to-back for home team, playoff game..."
                style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", color: C.text, fontSize: 13, resize: "none", transition: "border-color 0.2s", lineHeight: 1.5 }} />
            </div>

            {error && (
              <div style={{ background: C.redDim, border: `1px solid ${C.red}`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: C.red, fontSize: 13 }}>⚠️ {error}</div>
            )}

            <button className="btn-main" onClick={analyze} disabled={loading}
              style={{ width: "100%", background: loading ? C.surface : C.accent, color: loading ? C.dim : C.bg, border: "none", borderRadius: 10, padding: "15px", fontFamily: C.mono, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: loading ? "not-allowed" : "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              {loading
                ? <><div style={{ width: 16, height: 16, border: `2px solid ${C.accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />DEEP ANALYSIS IN PROGRESS...</>
                : "⚡ ANALYZE 1ST HALF"}
            </button>
          </div>
        )}

        {/* STEP TRACKER */}
        {loading && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "28px 24px", marginBottom: 24, animation: "fadeUp 0.3s ease" }}>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.accent, letterSpacing: 3, marginBottom: 24 }}>ANALYSIS PIPELINE</div>
            <StepTracker current={step} />
            <div style={{ marginTop: 24, background: C.surface, borderRadius: 8, padding: "12px 16px" }}>
              <div style={{ fontFamily: C.mono, fontSize: 10, color: C.dim, letterSpacing: 1, animation: "pulse 1.5s infinite" }}>
                {step < 4 ? "🔍 Searching all data sources for accurate stats..." : step < 6 ? "🔗 Cross-referencing sources & detecting conflicts..." : "📐 Applying weighted scoring formula..."}
              </div>
            </div>
          </div>
        )}

        {/* RESULTS */}
        {result && (
          <div style={{ animation: "fadeUp 0.5s ease" }}>

            {/* Verdict Banner */}
            <div style={{ background: vs.bg, border: `2px solid ${vs.color}`, borderRadius: 16, padding: "28px", marginBottom: 16, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: `${vs.color}08` }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.dim, letterSpacing: 3, marginBottom: 8 }}>{result.game} — {result.market}</div>
                  <div style={{ fontFamily: C.mono, fontSize: 10, color: C.dim, marginBottom: 6 }}>
                    LINE: <span style={{ color: C.accent }}>{result.line}</span>
                    {result.projected_1h_total > 0 && <span> · PROJ: <span style={{ color: C.text }}>{result.projected_1h_total}</span></span>}
                  </div>
                  <div style={{ fontFamily: C.mono, fontSize: 26, fontWeight: 700, color: vs.color, marginBottom: 12, letterSpacing: -0.5 }}>{vs.label}</div>
                  <p style={{ color: C.text, fontSize: 13, lineHeight: 1.7 }}>{result.summary}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <ConfidenceRing pct={result.confidence_pct || 0} />
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.dim, letterSpacing: 1 }}>
                    SCORE: {typeof result.weighted_score === "number" ? result.weighted_score.toFixed(2) : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Data Quality */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: dqColor(result.data_quality), flexShrink: 0, boxShadow: `0 0 10px ${dqColor(result.data_quality)}` }} />
              <div>
                <span style={{ fontFamily: C.mono, fontSize: 10, color: dqColor(result.data_quality), letterSpacing: 2 }}>DATA QUALITY: {result.data_quality}</span>
                <span style={{ color: C.dim, fontSize: 12, marginLeft: 10 }}>{result.data_quality_reason}</span>
              </div>
            </div>

            {/* Sources */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px", marginBottom: 16 }}>
              <div style={{ fontFamily: C.mono, fontSize: 9, color: C.accent, letterSpacing: 3, marginBottom: 14 }}>DATA SOURCES</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <SourceBadge icon="🏀" label="NBA OFFICIAL"   value={result.sources?.nba_official} />
                <SourceBadge icon="📡" label="ESPN"           value={result.sources?.espn} />
                <SourceBadge icon="📊" label="BASKETBALL-REF" value={result.sources?.basketball_reference} />
                <SourceBadge icon="🤕" label="ROTOWIRE"       value={result.sources?.rotowire} />
              </div>
              {result.conflicts?.length > 0 && (
                <div style={{ marginTop: 12, background: "#F0B42910", border: "1px solid #F0B42940", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.accent, letterSpacing: 2, marginBottom: 6 }}>⚠️ SOURCE CONFLICTS DETECTED</div>
                  {result.conflicts.map((c, i) => <div key={i} style={{ color: C.dimMid, fontSize: 12, marginBottom: 4 }}>• {c}</div>)}
                </div>
              )}
            </div>

            {/* Factor Breakdown */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px", marginBottom: 16 }}>
              <div style={{ fontFamily: C.mono, fontSize: 9, color: C.accent, letterSpacing: 3, marginBottom: 14 }}>FACTOR BREAKDOWN</div>
              {result.factors && Object.entries(result.factors).map(([k, v]) => <FactorCard key={k} fkey={k} data={v} />)}
            </div>

            {/* Edges & Risks */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              {[
                { label: "KEY EDGES", items: result.key_edges, color: C.green,  icon: "✅" },
                { label: "KEY RISKS", items: result.key_risks, color: C.red,    icon: "⚠️" },
              ].map(({ label, items, color, icon }) => (
                <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px" }}>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color, letterSpacing: 2, marginBottom: 12 }}>{icon} {label}</div>
                  {(items || []).map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: color, marginTop: 6, flexShrink: 0 }} />
                      <span style={{ color: C.dimMid, fontSize: 12, lineHeight: 1.5 }}>{item}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Disclaimer */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10 }}>
              <span>⚠️</span>
              <span style={{ color: C.dim, fontSize: 11, lineHeight: 1.6 }}>For informational purposes only. AI analysis can be wrong. Always verify injury reports before betting. Bet responsibly — never more than you can afford to lose.</span>
            </div>

            <button className="btn-reset" onClick={() => { setResult(null); setTeam1(""); setTeam2(""); setLine(""); setExtra(""); }}
              style={{ width: "100%", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10, padding: "13px", color: C.dim, fontFamily: C.mono, fontSize: 10, letterSpacing: 2, cursor: "pointer", transition: "all 0.2s" }}>
              ← NEW ANALYSIS
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
