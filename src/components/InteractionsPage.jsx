import { useState } from 'react';
import { BoltIcon, CloseIcon } from '../Icons.jsx';

// ─── Interaction database ────────────────────────────────────────────────────
// severity values match existing CSS status-badge classes:
//   'critical'  → red   (Major)
//   'low-stock' → amber (Moderate)
//   'expiring'  → yellow (Minor)
const KNOWN_INTERACTIONS = [
  { a: 'Warfarin',      b: 'Aspirin',       severity: 'critical',  severityLabel: 'Major',    effect: 'Concurrent use significantly increases bleeding risk.' },
  { a: 'Warfarin',      b: 'Ibuprofen',     severity: 'critical',  severityLabel: 'Major',    effect: 'NSAIDs increase anticoagulant effect and GI bleeding risk.' },
  { a: 'Warfarin',      b: 'Naproxen',      severity: 'critical',  severityLabel: 'Major',    effect: 'Increased bleeding risk; avoid concurrent use.' },
  { a: 'Metformin',     b: 'Alcohol',       severity: 'low-stock', severityLabel: 'Moderate', effect: 'Risk of lactic acidosis; avoid heavy alcohol consumption.' },
  { a: 'Lisinopril',    b: 'Potassium',     severity: 'low-stock', severityLabel: 'Moderate', effect: 'ACE inhibitors raise potassium levels; hyperkalemia risk.' },
  { a: 'Lisinopril',    b: 'Spironolactone',severity: 'critical',  severityLabel: 'Major',    effect: 'Combination can cause life-threatening hyperkalemia.' },
  { a: 'Amlodipine',    b: 'Grapefruit',    severity: 'expiring',  severityLabel: 'Minor',    effect: 'Grapefruit inhibits metabolism, increasing drug levels.' },
  { a: 'Atorvastatin',  b: 'Erythromycin',  severity: 'critical',  severityLabel: 'Major',    effect: 'Erythromycin inhibits statin metabolism, raising myopathy risk.' },
  { a: 'Atorvastatin',  b: 'Clarithromycin',severity: 'critical',  severityLabel: 'Major',    effect: 'CYP3A4 inhibition drastically raises statin plasma levels.' },
  { a: 'Aspirin',       b: 'Ibuprofen',     severity: 'low-stock', severityLabel: 'Moderate', effect: 'Ibuprofen may blunt the antiplatelet effect of aspirin.' },
  { a: 'Clopidogrel',   b: 'Omeprazole',    severity: 'low-stock', severityLabel: 'Moderate', effect: 'Omeprazole reduces clopidogrel activation via CYP2C19.' },
  { a: 'Ciprofloxacin', b: 'Antacids',      severity: 'low-stock', severityLabel: 'Moderate', effect: 'Antacids chelate ciprofloxacin, reducing its absorption.' },
  { a: 'Methotrexate',  b: 'NSAIDs',        severity: 'critical',  severityLabel: 'Major',    effect: 'NSAIDs reduce methotrexate excretion, causing toxicity.' },
  { a: 'Digoxin',       b: 'Amiodarone',    severity: 'critical',  severityLabel: 'Major',    effect: 'Amiodarone increases digoxin levels; risk of toxicity.' },
  { a: 'Sildenafil',    b: 'Nitrates',      severity: 'critical',  severityLabel: 'Major',    effect: 'Combination causes severe, potentially fatal hypotension.' },
  { a: 'SSRIs',         b: 'MAOIs',         severity: 'critical',  severityLabel: 'Major',    effect: 'Serotonin syndrome risk; contraindicated combination.' },
  { a: 'Fluoxetine',    b: 'Tramadol',      severity: 'critical',  severityLabel: 'Major',    effect: 'Serotonin syndrome and seizure risk.' },
  { a: 'Lithium',       b: 'Ibuprofen',     severity: 'critical',  severityLabel: 'Major',    effect: 'NSAIDs raise lithium levels; toxicity risk.' },
  { a: 'Amoxicillin',   b: 'Methotrexate',  severity: 'low-stock', severityLabel: 'Moderate', effect: 'Penicillins may reduce renal clearance of methotrexate.' },
  { a: 'Azithromycin',  b: 'Warfarin',      severity: 'low-stock', severityLabel: 'Moderate', effect: 'May enhance anticoagulant effect of warfarin.' },
];

// Build a case-insensitive lookup set
function buildLookup() {
  const map = new Map();
  KNOWN_INTERACTIONS.forEach(row => {
    const key1 = `${row.a.toLowerCase()}|${row.b.toLowerCase()}`;
    const key2 = `${row.b.toLowerCase()}|${row.a.toLowerCase()}`;
    map.set(key1, row);
    map.set(key2, row);
  });
  return map;
}
const INTERACTION_MAP = buildLookup();

const SEVERITY_ORDER = { critical: 0, 'low-stock': 1, expiring: 2 };

// Check all pairs among selected drugs
function findInteractions(drugs) {
  const hits = [];
  for (let i = 0; i < drugs.length; i++) {
    for (let j = i + 1; j < drugs.length; j++) {
      const key = `${drugs[i].toLowerCase()}|${drugs[j].toLowerCase()}`;
      const match = INTERACTION_MAP.get(key);
      if (match) {
        hits.push({ ...match, foundA: drugs[i], foundB: drugs[j] });
      }
    }
  }
  // Sort by severity
  hits.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3));
  return hits;
}

const SEVERITY_ICONS = { critical: '🚨', 'low-stock': '⚠️', expiring: 'ℹ️' };

export default function InteractionsPage({ onInteractionChecked }) {
  const [drugs, setDrugs] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [results, setResults] = useState(null); // null | 'loading' | Array
  const [checked, setChecked] = useState(false);

  const addDrug = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Capitalise first letter for better matching
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

  const checkInteractions = () => {
    setResults('loading');
    setChecked(false);
    setTimeout(() => {
      const hits = findInteractions(drugs);
      setResults(hits);
      setChecked(true);
      if (onInteractionChecked) onInteractionChecked(drugs, hits.length);
    }, 900);
  };

  const hasCritical = Array.isArray(results) && results.some(r => r.severity === 'critical');
  const hasAny      = Array.isArray(results) && results.length > 0;

  return (
    <>
      <header className="header">
        <div className="header-left">
          <h1>Drug Interaction Checker</h1>
          <p>AI-powered medication safety analysis</p>
        </div>
      </header>

      {/* ── Checker card ────────────────────────────────────────────────────── */}
      <div className="interaction-checker">
        <div className="checker-header">
          <div className="stat-icon teal">
            <BoltIcon size={18} />
          </div>
          <div className="checker-title">AI Drug Interaction Checker</div>
          <div className="ai-badge"><BoltIcon size={12} /> AI Powered</div>
        </div>

        {/* Input */}
        <div className="form-group">
          <input
            type="text"
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
                <button onClick={() => removeDrug(drug)} aria-label={`Remove ${drug}`}>
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
          className="btn btn-primary"
          onClick={checkInteractions}
          disabled={drugs.length < 2 || results === 'loading'}
        >
          {results === 'loading' ? 'Analyzing…' : 'Check Interactions'}
        </button>

        {/* ── Results ─────────────────────────────────────────────────────── */}
        {results === 'loading' && (
          <div className="interaction-result" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
              <span>AI analyzing interactions</span>
              <div className="loading-dots"><span /><span /><span /></div>
            </div>
          </div>
        )}

        {checked && !hasAny && (
          <div className="interaction-result safe">
            <div style={{ fontWeight: 600, marginBottom: 4 }}>✅ No Significant Interactions Found</div>
            <p style={{ fontSize: 13, opacity: 0.85 }}>
              No known major interactions detected among the selected medications. Always consult a pharmacist for clinical decisions.
            </p>
          </div>
        )}

        {checked && hasAny && (
          <div className={`interaction-result ${hasCritical ? 'danger' : ''}`}
            style={!hasCritical ? { background: '#fffbeb', border: '1px solid #f59e0b' } : {}}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
              {hasCritical ? '🚨 Critical Interaction(s) Detected' : '⚠️ Potential Interaction(s) Found'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {results.map((r, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.55)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  borderLeft: `3px solid ${r.severity === 'critical' ? '#ef4444' : r.severity === 'low-stock' ? '#f59e0b' : '#eab308'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span>{SEVERITY_ICONS[r.severity]}</span>
                    <strong style={{ fontSize: 14 }}>{r.foundA} + {r.foundB}</strong>
                    <span className={`status-badge ${r.severity}`} style={{ marginLeft: 'auto' }}>
                      {r.severityLabel}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, margin: 0, opacity: 0.9 }}>{r.effect}</p>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 12, marginTop: 10, opacity: 0.7 }}>
              Always verify with a licensed pharmacist before dispensing.
            </p>
          </div>
        )}
      </div>

      {/* ── Known Interaction Pairs table ────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Known Interaction Reference</h3>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {KNOWN_INTERACTIONS.length} pairs on record
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Drug A</th>
                <th>Drug B</th>
                <th>Severity</th>
                <th>Effect</th>
              </tr>
            </thead>
            <tbody>
              {KNOWN_INTERACTIONS.map((row, idx) => (
                <tr key={idx}>
                  <td><strong>{row.a}</strong></td>
                  <td><strong>{row.b}</strong></td>
                  <td><span className={`status-badge ${row.severity}`}>{row.severityLabel}</span></td>
                  <td style={{ fontSize: 13 }}>{row.effect}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
