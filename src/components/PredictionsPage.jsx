import { useState, useEffect, useRef, useMemo } from 'react';
import { Chart } from 'chart.js/auto';
import { BoltIcon, WarningIcon, CheckIcon } from '../Icons.jsx';
import {
  generateHistoricalData,
  forecastDemand,
  getWeeklyTrendAnalysis,
  getSeasonalHeatmap,
  getSupplyRecommendations,
  generateInsights,
  aggregateHistories,
} from '../forecastEngine.js';

// ─── Month names ─────────────────────────────────────────────────────────────
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Heatmap colour helper ──────────────────────────────────────────────────
function heatColor(value) {
  // value is a seasonal multiplier, typically 0.65 – 1.45
  const t = Math.max(0, Math.min(1, (value - 0.6) / 0.85)); // 0→1
  if (t < 0.35) return `hsl(166, 60%, ${85 - t * 40}%)`;    // cool teal
  if (t < 0.55) return `hsl(45, 80%, ${80 - t * 20}%)`;     // warm amber
  return `hsl(0, 70%, ${75 - t * 25}%)`;                     // hot red
}

// ─── Demand Forecast Chart ──────────────────────────────────────────────────
function DemandForecastChart({ history, forecast }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!chartRef.current || !history.length) return;
    if (chartInstance.current) chartInstance.current.destroy();

    const histLabels = history.map((h) => h.date.slice(5)); // MM-DD
    const foreLabels = forecast.map((f) => f.date.slice(5));
    const allLabels = [...histLabels, ...foreLabels];

    // Show every 4th label to avoid clutter
    const displayLabels = allLabels.map((l, i) => (i % 4 === 0 ? l : ''));

    const histData = history.map((h) => h.demand);
    const foreData = new Array(history.length - 1).fill(null).concat([history[history.length - 1].demand, ...forecast.map((f) => f.demand)]);
    const lowerData = new Array(history.length - 1).fill(null).concat([history[history.length - 1].demand, ...forecast.map((f) => f.lower)]);
    const upperData = new Array(history.length - 1).fill(null).concat([history[history.length - 1].demand, ...forecast.map((f) => f.upper)]);

    const ctx = chartRef.current.getContext('2d');

    // Gradient for historical line
    const histGradient = ctx.createLinearGradient(0, 0, 0, 300);
    histGradient.addColorStop(0, 'rgba(13,148,136,0.3)');
    histGradient.addColorStop(1, 'rgba(13,148,136,0.02)');

    // Gradient for forecast line
    const foreGradient = ctx.createLinearGradient(0, 0, 0, 300);
    foreGradient.addColorStop(0, 'rgba(59,130,246,0.2)');
    foreGradient.addColorStop(1, 'rgba(59,130,246,0.02)');

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: displayLabels,
        datasets: [
          {
            label: 'Historical Demand',
            data: histData.concat(new Array(forecast.length).fill(null)),
            borderColor: '#0d9488',
            backgroundColor: histGradient,
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 4,
            borderWidth: 2.5,
          },
          {
            label: 'Forecast',
            data: foreData,
            borderColor: '#3b82f6',
            backgroundColor: foreGradient,
            fill: true,
            tension: 0.35,
            borderDash: [6, 3],
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBackgroundColor: '#3b82f6',
            borderWidth: 2.5,
          },
          {
            label: 'Upper Bound',
            data: upperData,
            borderColor: 'rgba(59,130,246,0.15)',
            backgroundColor: 'rgba(59,130,246,0.06)',
            fill: '+1',
            tension: 0.35,
            pointRadius: 0,
            borderWidth: 1,
            borderDash: [3, 3],
          },
          {
            label: 'Lower Bound',
            data: lowerData,
            borderColor: 'rgba(59,130,246,0.15)',
            backgroundColor: 'transparent',
            fill: false,
            tension: 0.35,
            pointRadius: 0,
            borderWidth: 1,
            borderDash: [3, 3],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              color: '#64748b',
              font: { size: 11, family: 'Inter' },
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 16,
              filter: (item) => !item.text.includes('Bound'),
            },
          },
          tooltip: {
            backgroundColor: 'rgba(15,23,42,0.9)',
            titleFont: { family: 'Inter', size: 12 },
            bodyFont: { family: 'Inter', size: 11 },
            padding: 10,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              title: (ctx) => {
                const idx = ctx[0].dataIndex;
                if (idx < history.length) return `Week ${history[idx]?.week || idx + 1} — ${allLabels[idx]}`;
                return `Forecast — ${allLabels[idx]}`;
              },
              label: (ctx) => {
                if (ctx.dataset.label.includes('Bound')) return null;
                return `${ctx.dataset.label}: ${ctx.parsed.y} units`;
              },
            },
          },
          // Vertical line at forecast boundary
          annotation: undefined,
        },
        scales: {
          x: {
            grid: { color: '#f1f5f9', drawBorder: false },
            ticks: { color: '#94a3b8', font: { size: 10, family: 'Inter' }, maxRotation: 0 },
          },
          y: {
            grid: { color: '#f1f5f9', drawBorder: false },
            ticks: { color: '#94a3b8', font: { size: 10, family: 'Inter' } },
            beginAtZero: true,
          },
        },
      },
      plugins: [
        {
          id: 'forecastDivider',
          beforeDraw: (chart) => {
            const xScale = chart.scales.x;
            const yScale = chart.scales.y;
            const dividerIdx = history.length - 1;
            if (dividerIdx < 0 || dividerIdx >= xScale.ticks.length * 4) return;
            const x = xScale.getPixelForValue(dividerIdx);
            const ctx2 = chart.ctx;
            ctx2.save();
            ctx2.beginPath();
            ctx2.moveTo(x, yScale.top);
            ctx2.lineTo(x, yScale.bottom);
            ctx2.strokeStyle = 'rgba(59,130,246,0.35)';
            ctx2.lineWidth = 1.5;
            ctx2.setLineDash([5, 4]);
            ctx2.stroke();

            // Label
            ctx2.fillStyle = 'rgba(59,130,246,0.8)';
            ctx2.font = '600 10px Inter';
            ctx2.textAlign = 'center';
            ctx2.fillText('Forecast →', x + 35, yScale.top + 14);
            ctx2.restore();
          },
        },
      ],
    });

    return () => { if (chartInstance.current) chartInstance.current.destroy(); };
  }, [history, forecast]);

  return <canvas ref={chartRef} />;
}

// ─── Weekly Trend Bar Chart ─────────────────────────────────────────────────
function WeeklyTrendChart({ trendData }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!chartRef.current || !trendData.length) return;
    if (chartInstance.current) chartInstance.current.destroy();

    const ctx = chartRef.current.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(13,148,136,0.7)');
    gradient.addColorStop(1, 'rgba(13,148,136,0.15)');

    chartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: trendData.map((t) => t.shortDay),
        datasets: [
          {
            label: 'Avg Daily Demand',
            data: trendData.map((t) => t.avgDemand),
            backgroundColor: trendData.map((_, i) =>
              i === 4 ? 'rgba(59,130,246,0.8)' : 'rgba(13,148,136,0.6)'
            ),
            borderRadius: 8,
            borderSkipped: false,
            barPercentage: 0.55,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15,23,42,0.9)',
            titleFont: { family: 'Inter', size: 12 },
            bodyFont: { family: 'Inter', size: 11 },
            padding: 10,
            cornerRadius: 8,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { size: 11, family: 'Inter' } },
          },
          y: {
            grid: { color: '#f1f5f9', drawBorder: false },
            ticks: { color: '#94a3b8', font: { size: 10, family: 'Inter' } },
            beginAtZero: true,
          },
        },
      },
    });

    return () => { if (chartInstance.current) chartInstance.current.destroy(); };
  }, [trendData]);

  return <canvas ref={chartRef} />;
}

// ─── Icons ──────────────────────────────────────────────────────────────────

function TrendUpIcon({ size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={size} height={size}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function ClockIcon({ size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={size} height={size}>
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ShieldIcon({ size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={size} height={size}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function BoxIcon({ size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={size} height={size}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
  );
}

function InfoIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={size} height={size}>
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function PredictionsPage({ inventoryData = [] }) {
  const [selectedMedicine, setSelectedMedicine] = useState('__all__');
  const [supplySort, setSupplySort] = useState('urgency');

  // ── Compute all forecasting data ──────────────────────────────────────────
  const { historyMap, forecastMap, aggregatedHistory, aggregatedForecast, totalAccuracy } = useMemo(() => {
    if (!inventoryData.length) {
      return { historyMap: new Map(), forecastMap: new Map(), aggregatedHistory: [], aggregatedForecast: { forecast: [], accuracy: 0 }, totalAccuracy: 0 };
    }

    const hMap = generateHistoricalData(inventoryData);
    const fMap = new Map();
    let totalAcc = 0;
    let accCount = 0;

    for (const [name, hist] of hMap) {
      const fc = forecastDemand(hist);
      fMap.set(name, fc);
      if (fc.accuracy > 0) {
        totalAcc += fc.accuracy;
        accCount++;
      }
    }

    const aggHist = aggregateHistories(hMap);
    const aggFc = forecastDemand(aggHist);

    return {
      historyMap: hMap,
      forecastMap: fMap,
      aggregatedHistory: aggHist,
      aggregatedForecast: aggFc,
      totalAccuracy: accCount > 0 ? Math.round(totalAcc / accCount * 10) / 10 : 0,
    };
  }, [inventoryData]);

  // Active chart data
  const activeHistory = selectedMedicine === '__all__'
    ? aggregatedHistory
    : (historyMap.get(selectedMedicine) || []);

  const activeForecast = selectedMedicine === '__all__'
    ? aggregatedForecast
    : (forecastMap.get(selectedMedicine) || { forecast: [], accuracy: 0 });

  // Weekly trend
  const weeklyTrend = useMemo(() => getWeeklyTrendAnalysis(activeHistory), [activeHistory]);

  // Seasonal heatmap
  const seasonalHeatmap = useMemo(() => getSeasonalHeatmap(inventoryData), [inventoryData]);

  // Supply recommendations
  const recommendations = useMemo(
    () => getSupplyRecommendations(forecastMap, inventoryData),
    [forecastMap, inventoryData]
  );

  // Sorted supply data
  const sortedSupply = useMemo(() => {
    const sorted = [...recommendations];
    if (supplySort === 'urgency') sorted.sort((a, b) => a.weeksUntilStockout - b.weeksUntilStockout);
    else if (supplySort === 'demand') sorted.sort((a, b) => b.predicted8Week - a.predicted8Week);
    else if (supplySort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [recommendations, supplySort]);

  // AI Insights
  const insights = useMemo(
    () => generateInsights(recommendations, seasonalHeatmap),
    [recommendations, seasonalHeatmap]
  );

  // Stats
  const criticalCount = recommendations.filter((r) => r.urgency === 'critical').length;
  const totalSavings = recommendations
    .filter((r) => r.weeksUntilStockout > 12)
    .reduce((s, r) => s + Math.round(r.currentStock * 0.15), 0);

  return (
    <>
      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="header">
        <div className="header-left">
          <h1>AI Demand Forecasting</h1>
          <p>Weekly trends &amp; seasonal analysis powered by predictive modeling</p>
        </div>
        <div className="header-right">
          <div className="ai-badge" style={{ fontSize: '13px', padding: '8px 14px' }}>
            <BoltIcon size={14} /> Live AI Engine
          </div>
        </div>
      </header>

      {/* ── Stats Grid ───────────────────────────────────────────────── */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon teal"><TrendUpIcon size={20} /></div>
            <span className="stat-trend up">{totalAccuracy > 90 ? '↑ High' : '~'}</span>
          </div>
          <div className="stat-value">{totalAccuracy}%</div>
          <div className="stat-label">Forecast Accuracy</div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon blue"><ClockIcon size={20} /></div>
            <span className="stat-trend up">+{inventoryData.length}</span>
          </div>
          <div className="stat-value">{inventoryData.length}</div>
          <div className="stat-label">Active Forecasts</div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon orange"><ShieldIcon size={20} /></div>
            <span className="stat-trend up" style={criticalCount > 0 ? { color: '#ef4444' } : {}}>
              {criticalCount > 0 ? `⚠ ${criticalCount}` : '✓ Safe'}
            </span>
          </div>
          <div className="stat-value">{criticalCount}</div>
          <div className="stat-label">Stockout Risks</div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon purple"><BoxIcon size={20} /></div>
            <span className="stat-trend up">Est.</span>
          </div>
          <div className="stat-value">${totalSavings.toLocaleString()}</div>
          <div className="stat-label">Potential Savings</div>
        </div>
      </div>

      {/* ── Medicine Selector ──────────────────────────────────────── */}
      <div className="forecast-controls">
        <div className="forecast-selector">
          <label htmlFor="medicine-select">Forecasting for:</label>
          <select
            id="medicine-select"
            value={selectedMedicine}
            onChange={(e) => setSelectedMedicine(e.target.value)}
            className="forecast-dropdown"
          >
            <option value="__all__">📊 All Medicines (Aggregated)</option>
            {inventoryData.map((item) => (
              <option key={item.name} value={item.name}>💊 {item.name}</option>
            ))}
          </select>
        </div>
        {selectedMedicine !== '__all__' && activeForecast.accuracy > 0 && (
          <div className="forecast-accuracy-badge">
            <TrendUpIcon size={14} />
            <span>{activeForecast.accuracy}% accuracy</span>
          </div>
        )}
      </div>

      {/* ── Demand Forecast Chart ──────────────────────────────────── */}
      <div className="forecast-main-grid">
        <div className="card forecast-chart-card">
          <div className="card-header">
            <h3 className="card-title">
              Demand Forecast — 52 Weeks Historical + 8 Weeks Predicted
            </h3>
            <div className="forecast-chart-legend">
              <span className="legend-dot" style={{ background: '#0d9488' }} /> Historical
              <span className="legend-dot" style={{ background: '#3b82f6' }} /> Forecast
              <span className="legend-dot" style={{ background: 'rgba(59,130,246,0.15)' }} /> Confidence Band
            </div>
          </div>
          <div className="card-body">
            <div className="chart-container" style={{ height: '320px' }}>
              <DemandForecastChart history={activeHistory} forecast={activeForecast.forecast} />
            </div>
          </div>
        </div>

        {/* ── Sidebar: Weekly Trend + AI Insights ─────────────────── */}
        <div className="forecast-sidebar">
          {/* Weekly Trend */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Weekly Demand Pattern</h3>
            </div>
            <div className="card-body">
              <div className="chart-container" style={{ height: '180px' }}>
                <WeeklyTrendChart trendData={weeklyTrend} />
              </div>
              <div className="trend-peak-badge">
                📈 Peak day: <strong>Friday</strong> (+15% vs avg)
              </div>
            </div>
          </div>

          {/* AI Insights */}
          <div className="card ai-panel">
            <div className="ai-header">
              <div className="ai-badge"><BoltIcon size={12} /> AI Insights</div>
            </div>
            <div className="insight-list">
              {insights.map((insight, i) => (
                <div className="insight-item" key={i}>
                  <div className={`insight-icon ${insight.type === 'alert' ? 'alert' : insight.type === 'warning' ? 'warning' : insight.type === 'success' ? 'success' : 'info-icon-bg'}`}>
                    {insight.type === 'alert' && <WarningIcon size={16} />}
                    {insight.type === 'warning' && <InfoIcon size={16} />}
                    {insight.type === 'success' && <CheckIcon size={16} />}
                    {insight.type === 'info' && <BoltIcon size={16} />}
                  </div>
                  <div className="insight-content">
                    <h4>{insight.title}</h4>
                    <p>{insight.message}</p>
                    <div className="insight-time">Confidence: {insight.confidence}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Seasonal Heatmap ───────────────────────────────────────── */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h3 className="card-title">Seasonal Demand Heatmap by Category</h3>
          <div className="heatmap-legend">
            <span className="heatmap-legend-item">
              <span className="heatmap-swatch" style={{ background: 'hsl(166, 60%, 80%)' }} /> Low
            </span>
            <span className="heatmap-legend-item">
              <span className="heatmap-swatch" style={{ background: 'hsl(45, 80%, 70%)' }} /> Moderate
            </span>
            <span className="heatmap-legend-item">
              <span className="heatmap-swatch" style={{ background: 'hsl(0, 70%, 62%)' }} /> High
            </span>
          </div>
        </div>
        <div className="card-body">
          <div className="seasonal-heatmap">
            {/* Header row */}
            <div className="heatmap-row heatmap-header">
              <div className="heatmap-label">Category</div>
              {MONTH_NAMES.map((m) => (
                <div className="heatmap-cell heatmap-month" key={m}>{m}</div>
              ))}
            </div>
            {/* Data rows */}
            {seasonalHeatmap.map((row) => (
              <div className="heatmap-row" key={row.category}>
                <div className="heatmap-label">{row.category}</div>
                {row.months.map((val, i) => (
                  <div
                    className="heatmap-cell"
                    key={i}
                    style={{ background: heatColor(val) }}
                    title={`${row.category} — ${MONTH_NAMES[i]}: ${Math.round(val * 100)}%`}
                  >
                    <span className="heatmap-value">{Math.round(val * 100)}%</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Supply Planning Table ──────────────────────────────────── */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h3 className="card-title">Supply Planning — 8-Week Outlook</h3>
          <div className="supply-sort-controls">
            <span className="supply-sort-label">Sort by:</span>
            {['urgency', 'demand', 'name'].map((key) => (
              <button
                key={key}
                className={`supply-sort-btn${supplySort === key ? ' active' : ''}`}
                onClick={() => setSupplySort(key)}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="supply-table-wrap">
            <table className="inventory-table supply-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Category</th>
                  <th>Current Stock</th>
                  <th>8-Week Demand</th>
                  <th>Weeks Left</th>
                  <th>Order Qty</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedSupply.map((item) => (
                  <tr key={item.name} className={item.urgency === 'critical' ? 'supply-row-critical' : ''}>
                    <td>
                      <div className="drug-info">
                        <div className="drug-icon">💊</div>
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td><span className="category-tag">{item.category}</span></td>
                    <td className="text-right">{item.currentStock.toLocaleString()}</td>
                    <td className="text-right">{item.predicted8Week.toLocaleString()}</td>
                    <td>
                      <div className="weeks-left-bar">
                        <div
                          className="weeks-left-fill"
                          style={{
                            width: `${Math.min(100, (item.weeksUntilStockout / 12) * 100)}%`,
                            background:
                              item.urgency === 'critical' ? '#ef4444'
                              : item.urgency === 'warning' ? '#f59e0b'
                              : '#0d9488',
                          }}
                        />
                        <span className="weeks-left-text">{item.weeksUntilStockout}w</span>
                      </div>
                    </td>
                    <td className="text-right">
                      {item.recommendedOrder > 0 ? (
                        <span className="order-qty">{item.recommendedOrder.toLocaleString()}</span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className={`supply-badge supply-${item.urgency}`}>
                        {item.urgency === 'critical' ? '🔴 Critical' : item.urgency === 'warning' ? '🟡 Warning' : '🟢 Healthy'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
