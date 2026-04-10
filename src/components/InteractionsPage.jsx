import { useState } from 'react';
import { BoltIcon, CloseIcon } from '../Icons.jsx';

// ─── Groq API helper (free, OpenAI-compatible) ───────────────────────────────
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_MODEL   = 'llama-3.3-70b-versatile';
const GROQ_URL     = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Asks ChatGPT to analyse drug interactions.
 * Returns { interactions: Array, modelUsed: string }
 */
async function analyseWithGroq(drugs) {
  const systemPrompt =
    'You are a clinical pharmacology expert. You always respond with valid JSON only — no explanations, no markdown, no extra text.';

  const userPrompt = `
Analyse ALL possible pairwise drug interactions among these medications:
${drugs.map((d, i) => `${i + 1}. ${d}`).join('\n')}

Return a JSON object with a single key "interactions" whose value is an array:
{
  "interactions": [
    {
      "drugA": "Name of drug A exactly as provided",
      "drugB": "Name of drug B exactly as provided",
      "severity": "Major" | "Moderate" | "Minor",
      "mechanism": "Brief pharmacokinetic/pharmacodynamic mechanism (≤2 sentences)",
      "effect": "Clinical effect or consequence (≤2 sentences)",
      "management": "Recommended clinical management or monitoring (≤2 sentences)",
      "avoid": true | false
    }
  ]
}

If NO interactions exist, return: { "interactions": [] }

Rules:
- Only include clinically documented, evidence-based interactions.
- Use the drug names exactly as provided.
`.trim();

  const res = await fetch(GROQ_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model:           GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
      temperature:     0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.error?.message || `Groq API error ${res.status}`,
    );
  }

  const data   = await res.json();
  const text   = data?.choices?.[0]?.message?.content ?? '{"interactions":[]}';
  const parsed = JSON.parse(text);

  return {
    interactions: parsed.interactions ?? [],
    modelUsed:    data?.model ?? GROQ_MODEL,
  };
}

// ─── Severity helpers ─────────────────────────────────────────────────────────
const SEVERITY_CSS = {
  Major:    'critical',
  Moderate: 'low-stock',
  Minor:    'expiring',
};
const SEVERITY_ICON = { Major: '🚨', Moderate: '⚠️', Minor: 'ℹ️' };
const SEVERITY_ORDER = { Major: 0, Moderate: 1, Minor: 2 };
const BORDER_COLOR   = { Major: '#ef4444', Moderate: '#f59e0b', Minor: '#eab308' };

// ─── Component ────────────────────────────────────────────────────────────────
export default function InteractionsPage({ onInteractionChecked }) {
  const [drugs,    setDrugs]    = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [results,  setResults]  = useState(null);   // null | 'loading' | Array | Error
  const [checked,  setChecked]  = useState(false);
  const [aiModel,  setAiModel]  = useState('');

  const apiKeyMissing = !GROQ_API_KEY || GROQ_API_KEY === 'your_groq_api_key_here';

  // ── Drug list management ──────────────────────────────────────────────────
  const addDrug = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const normalised = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    if (!drugs.includes(normalised)) {
      setDrugs(prev => [...prev, normalised]);
      setResults(null);
      setChecked(false);
    }
    setInputVal('');
  };

  const removeDrug = (name) => {
    setDrugs(prev => prev.filter(d => d !== name));
    setResults(null);
    setChecked(false);
  };

  // ── Main check ──────────────────────────────────────────────────────────
  const checkInteractions = async () => {
    if (drugs.length < 2) return;
    setResults('loading');
    setChecked(false);
    setAiModel('');

    try {
      if (apiKeyMissing) throw new Error('no_key');

      const { interactions, modelUsed } = await analyseWithGroq(drugs);

      // Sort by severity
      interactions.sort(
        (a, b) =>
          (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3),
      );

      setResults(interactions);
      setAiModel(modelUsed);
      setChecked(true);
      if (onInteractionChecked) onInteractionChecked(drugs, interactions.length);
    } catch (err) {
      setResults({ error: err.message });
      setChecked(true);
    }
  };

  const hasCritical = Array.isArray(results) && results.some(r => r.severity === 'Major');
  const hasAny      = Array.isArray(results) && results.length > 0;
  const isError     = results && typeof results === 'object' && !Array.isArray(results) && results.error;

  return (
    <>
      <header className="header">
        <div className="header-left">
          <h1>Drug Interaction Checker</h1>
          <p>Real-time AI-powered medication safety analysis via Groq AI</p>
        </div>
      </header>

      {/* ── API key warning ──────────────────────────────────────────────────── */}
      {apiKeyMissing && (
        <div
          className="interaction-result"
          style={{ background: '#fef3c7', border: '1px solid #f59e0b', marginBottom: 16 }}
        >
          <strong>⚙️ Groq API Key Required</strong>
          <p style={{ fontSize: 13, margin: '6px 0 0' }}>
            Add your Groq API key to <code>.env.local</code>:<br />
            <code style={{ fontSize: 12 }}>VITE_GROQ_API_KEY=your_key_here</code>
            <br />
            Get a <strong>free</strong> key at{' '}
            <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
              console.groq.com/keys
            </a>
            . Restart the dev server after saving.
          </p>
        </div>
      )}

      {/* ── Checker card ────────────────────────────────────────────────────── */}
      <div className="interaction-checker">
        <div className="checker-header">
          <div className="stat-icon teal">
            <BoltIcon size={18} />
          </div>
          <div className="checker-title">AI Drug Interaction Checker</div>
          <div className="ai-badge">
            <BoltIcon size={12} /> Groq AI
          </div>
        </div>

        {/* Input */}
        <div className="form-group">
          <input
            type="text"
            id="drug-input"
            className="form-input"
            placeholder="Type a medication name and press Enter to add…"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && inputVal.trim()) addDrug(inputVal);
            }}
          />
        </div>

        {/* Drug tags */}
        {drugs.length > 0 && (
          <div className="drug-tags">
            {drugs.map(drug => (
              <div key={drug} className="drug-tag">
                {drug}
                <button
                  id={`remove-${drug.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => removeDrug(drug)}
                  aria-label={`Remove ${drug}`}
                >
                  <CloseIcon size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {drugs.length < 2 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            Add at least 2 medications to check for interactions.
          </p>
        )}

        <button
          id="check-interactions-btn"
          className="btn btn-primary"
          onClick={checkInteractions}
          disabled={drugs.length < 2 || results === 'loading'}
        >
          {results === 'loading' ? 'Analyzing with Groq AI…' : '✦ Check Interactions'}
        </button>

        {/* ── Loading ──────────────────────────────────────────────────────── */}
        {results === 'loading' && (
          <div
            className="interaction-result"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', marginTop: 16 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)' }}>
              <BoltIcon size={16} />
              <span>Groq AI is analyzing drug interactions…</span>
              <div className="loading-dots"><span /><span /><span /></div>
            </div>
            <p style={{ fontSize: 12, marginTop: 8, opacity: 0.7, marginBottom: 0 }}>
              Querying live pharmacology knowledge — this may take a few seconds.
            </p>
          </div>
        )}

        {/* ── API Key / Network Error ───────────────────────────────────────── */}
        {checked && isError && (
          <div
            className="interaction-result danger"
            style={{ marginTop: 16 }}
          >
            <strong>
              {results.error === 'no_key' ? '🔑 Missing API Key' : '❌ API Error'}
            </strong>
            <p style={{ fontSize: 13, margin: '6px 0 0' }}>
              {results.error === 'no_key'
                ? 'Please set VITE_GEMINI_API_KEY in your .env.local file and restart the dev server.'
                : results.error}
            </p>
          </div>
        )}

        {/* ── Safe ─────────────────────────────────────────────────────────── */}
        {checked && !isError && !hasAny && (
          <div className="interaction-result safe" style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
              ✅ No Clinically Significant Interactions Found
            </div>
            <p style={{ fontSize: 13, opacity: 0.85, marginBottom: 8 }}>
              Gemini found no documented clinically significant interactions among{' '}
              <strong>{drugs.join(', ')}</strong>.
            </p>
            <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 0 }}>
              Always consult a licensed pharmacist or physician before dispensing.
            </p>
            {aiModel && (
              <div style={{ marginTop: 10, fontSize: 11, opacity: 0.55 }}>
                Powered by {aiModel}
              </div>
            )}
          </div>
        )}

        {/* ── Interactions Found ────────────────────────────────────────────── */}
        {checked && !isError && hasAny && (
          <div
            className={`interaction-result ${hasCritical ? 'danger' : ''}`}
            style={
              !hasCritical
                ? { background: '#fffbeb', border: '1px solid #f59e0b', marginTop: 16 }
                : { marginTop: 16 }
            }
          >
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>
              {hasCritical
                ? `🚨 ${results.filter(r => r.severity === 'Major').length} Critical Interaction(s) Detected`
                : `⚠️ ${results.length} Potential Interaction(s) Found`}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {results.map((r, i) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(255,255,255,0.6)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    borderLeft: `4px solid ${BORDER_COLOR[r.severity] ?? '#94a3b8'}`,
                  }}
                >
                  {/* Header row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{SEVERITY_ICON[r.severity]}</span>
                    <strong style={{ fontSize: 14, flex: 1 }}>
                      {r.drugA} ↔ {r.drugB}
                    </strong>
                    <span
                      className={`status-badge ${SEVERITY_CSS[r.severity] ?? ''}`}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {r.severity}
                    </span>
                    {r.avoid && (
                      <span
                        style={{
                          background: '#fef2f2',
                          color: '#dc2626',
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 99,
                          border: '1px solid #fca5a5',
                        }}
                      >
                        AVOID
                      </span>
                    )}
                  </div>

                  {/* Detail rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <DetailRow label="⚗️ Mechanism" text={r.mechanism} />
                    <DetailRow label="💊 Effect"    text={r.effect}    />
                    <DetailRow label="📋 Management" text={r.management} />
                  </div>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 12, marginTop: 12, opacity: 0.65, marginBottom: 0 }}>
              Always verify with a licensed pharmacist before dispensing.
            </p>
            {aiModel && (
              <div style={{ marginTop: 6, fontSize: 11, opacity: 0.5 }}>
                Powered by {aiModel}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Quick-reference pills ─────────────────────────────────────────────── */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <h3 className="card-title">High-Risk Combination Examples</h3>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Click a pair to auto-fill
          </span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {EXAMPLE_PAIRS.map((pair, idx) => (
              <button
                key={idx}
                id={`example-pair-${idx}`}
                onClick={() => {
                  setDrugs(pair.drugs);
                  setResults(null);
                  setChecked(false);
                }}
                style={{
                  background: 'var(--bg-secondary)',
                  border: `1px solid ${pair.color}`,
                  borderRadius: 20,
                  padding: '6px 14px',
                  fontSize: 13,
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = pair.color + '22')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
              >
                <span style={{ color: pair.color, fontSize: 15 }}>{pair.icon}</span>
                {pair.drugs.join(' + ')}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, marginBottom: 0 }}>
            These examples are for educational demonstration. Real interaction data is fetched live from Gemini.
          </p>
        </div>
      </div>
    </>
  );
}

// ─── Sub-component ────────────────────────────────────────────────────────────
function DetailRow({ label, text }) {
  if (!text) return null;
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'flex-start' }}>
      <span style={{ whiteSpace: 'nowrap', opacity: 0.7, minWidth: 110, fontWeight: 600 }}>
        {label}
      </span>
      <span style={{ opacity: 0.9 }}>{text}</span>
    </div>
  );
}

// ─── Example high-risk pairs ──────────────────────────────────────────────────
const EXAMPLE_PAIRS = [
  { drugs: ['Warfarin', 'Aspirin'],       icon: '🚨', color: '#ef4444' },
  { drugs: ['Sildenafil', 'Nitrates'],    icon: '🚨', color: '#ef4444' },
  { drugs: ['SSRIs', 'MAOIs'],            icon: '🚨', color: '#ef4444' },
  { drugs: ['Atorvastatin', 'Gemfibrozil'], icon: '🚨', color: '#ef4444' },
  { drugs: ['Metformin', 'Alcohol'],      icon: '⚠️', color: '#f59e0b' },
  { drugs: ['Clopidogrel', 'Omeprazole'], icon: '⚠️', color: '#f59e0b' },
  { drugs: ['Lisinopril', 'Potassium'],   icon: '⚠️', color: '#f59e0b' },
  { drugs: ['Amlodipine', 'Grapefruit'],  icon: 'ℹ️', color: '#eab308' },
];
