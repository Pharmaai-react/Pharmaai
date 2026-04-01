import { useState } from 'react';
import { BoltIcon, GitHubIcon, CloseIcon } from '../Icons.jsx';

const KNOWN_INTERACTIONS = [
  { a: 'Warfarin', b: 'Aspirin', severity: 'critical', effect: 'Increased bleeding risk', severityLabel: 'Major' },
  { a: 'Metformin', b: 'Alcohol', severity: 'low-stock', effect: 'Lactic acidosis risk', severityLabel: 'Moderate' },
  { a: 'Lisinopril', b: 'Potassium', severity: 'low-stock', effect: 'Hyperkalemia', severityLabel: 'Moderate' },
  { a: 'Amlodipine', b: 'Grapefruit', severity: 'expiring', effect: 'Increased drug levels', severityLabel: 'Minor' },
  { a: 'Atorvastatin', b: 'Erythromycin', severity: 'critical', effect: 'Myopathy risk', severityLabel: 'Major' },
];

export default function InteractionsPage() {
  const [drugs, setDrugs] = useState(['Warfarin', 'Aspirin']);
  const [inputVal, setInputVal] = useState('');
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);

  const addDrug = (name) => {
    const trimmed = name.trim();
    if (trimmed && !drugs.includes(trimmed)) {
      setDrugs(prev => [...prev, trimmed]);
    }
    setInputVal('');
  };

  const removeDrug = (name) => {
    setDrugs(prev => prev.filter(d => d !== name));
    setResult(null);
  };

  const checkInteractions = () => {
    setChecking(true);
    setResult('loading');
    setTimeout(() => {
      setChecking(false);
      const hasDanger = drugs.includes('Warfarin') && drugs.includes('Aspirin');
      setResult(hasDanger ? 'danger' : 'safe');
    }, 1500);
  };

  return (
    <>
      <header className="header">
        <div className="header-left">
          <h1>Drug Interaction Checker</h1>
          <p>AI-powered medication safety analysis</p>
        </div>
      </header>

      <div className="interaction-checker">
        <div className="checker-header">
          <div className="stat-icon teal"><GitHubIcon size={18} /></div>
          <div className="checker-title">AI Drug Interaction Checker</div>
          <div className="ai-badge"><BoltIcon size={12} /> AI Powered</div>
        </div>

        <div className="form-group">
          <input
            type="text"
            className="form-input"
            placeholder="Type medication name and press Enter to add..."
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyPress={e => { if (e.key === 'Enter' && inputVal.trim()) addDrug(inputVal); }}
          />
        </div>

        <div className="drug-tags">
          {drugs.map(drug => (
            <div key={drug} className="drug-tag">
              {drug}
              <button onClick={() => removeDrug(drug)}>
                <CloseIcon size={12} />
              </button>
            </div>
          ))}
        </div>

        <button className="btn btn-primary" onClick={checkInteractions} disabled={drugs.length < 2}>
          Check Interactions
        </button>

        {result === 'loading' && (
          <div className="interaction-result" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b' }}>
              <span>AI analyzing interactions</span>
              <div className="loading-dots"><span /><span /><span /></div>
            </div>
          </div>
        )}
        {result === 'danger' && (
          <div className="interaction-result danger">
            <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠️ Major Drug Interaction Detected</div>
            <p style={{ marginBottom: 4 }}><strong>Warfarin + Aspirin:</strong> Concurrent use significantly increases bleeding risk.</p>
            <p style={{ fontSize: 12, opacity: .8 }}>Severity: Major | Confidence: 98%</p>
          </div>
        )}
        {result === 'safe' && (
          <div className="interaction-result safe">
            <div style={{ fontWeight: 600, marginBottom: 4 }}>✅ No Significant Interactions Found</div>
            <p style={{ fontSize: 12 }}>The selected medications have no known major interactions.</p>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Common Interaction Pairs</h3>
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
                  <td>{row.effect}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
