/**
 * forecastEngine.js
 * Client-side demand forecasting engine for PharmaAI.
 *
 * Generates synthetic 52-week historical sales data with realistic patterns,
 * then forecasts the next N weeks using Holt-Winters-inspired exponential
 * smoothing with seasonal decomposition.
 */

// ─── Seeded PRNG for deterministic results across renders ────────────────────
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ─── Seasonal profiles by category ──────────────────────────────────────────
// Monthly multipliers (Jan=0 … Dec=11). Values > 1 = above-average demand.
const SEASONAL_PROFILES = {
  Antibiotics:      [1.35, 1.30, 1.10, 0.90, 0.80, 0.75, 0.70, 0.75, 0.85, 1.05, 1.25, 1.40],
  Respiratory:      [1.40, 1.30, 1.05, 0.85, 0.75, 0.70, 0.70, 0.75, 0.90, 1.10, 1.30, 1.45],
  Analgesics:       [1.10, 1.05, 1.00, 0.95, 0.95, 1.00, 1.00, 0.95, 0.95, 1.00, 1.05, 1.10],
  Cardiovascular:   [1.05, 1.02, 1.00, 0.98, 0.97, 0.95, 0.95, 0.97, 1.00, 1.02, 1.05, 1.08],
  Antidiabetics:    [1.08, 1.05, 1.00, 0.95, 0.92, 0.90, 0.92, 0.95, 1.00, 1.05, 1.08, 1.10],
  Gastrointestinal: [0.90, 0.85, 0.95, 1.05, 1.15, 1.25, 1.30, 1.25, 1.10, 0.95, 0.85, 0.80],
  Gastro:           [0.90, 0.85, 0.95, 1.05, 1.15, 1.25, 1.30, 1.25, 1.10, 0.95, 0.85, 0.80],
  Supplements:      [1.15, 1.10, 1.00, 0.90, 0.85, 0.85, 0.90, 0.95, 1.00, 1.05, 1.10, 1.15],
  Antihistamine:    [0.80, 0.85, 1.10, 1.30, 1.35, 1.20, 1.00, 0.90, 0.85, 0.80, 0.80, 0.75],
};

const DEFAULT_SEASONAL = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

// Day-of-week weight pattern (Mon=0 … Sun=6)
const DOW_WEIGHTS = [1.05, 1.00, 1.10, 1.08, 1.15, 0.80, 0.65];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSeasonalProfile(category) {
  for (const key of Object.keys(SEASONAL_PROFILES)) {
    if (category.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(category.toLowerCase())) {
      return SEASONAL_PROFILES[key];
    }
  }
  return DEFAULT_SEASONAL;
}

function weekToMonth(weekIndex, startMonth) {
  return (startMonth + Math.floor((weekIndex * 7) / 30)) % 12;
}

// ─── Historical data generation ─────────────────────────────────────────────

/**
 * Generate 52 weeks of synthetic weekly demand for a single medicine.
 * @param {Object} item — { name, category, quantity }
 * @returns {Array<{ week, month, demand, date }>}
 */
export function generateItemHistory(item) {
  const rng = mulberry32(hashStr(item.name));
  const profile = getSeasonalProfile(item.category);

  // Base weekly demand scaled to current stock (assume stock ≈ 4-week supply)
  const baseDemand = Math.max(5, Math.round(item.quantity / 4));

  // Start date: 52 weeks ago from "now" (April 2026)
  const now = new Date(2026, 3, 1); // April 1 2026
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 52 * 7);
  const startMonth = startDate.getMonth();

  const history = [];
  for (let w = 0; w < 52; w++) {
    const month = weekToMonth(w, startMonth);
    const seasonal = profile[month];

    // Slight upward growth trend (0.15% per week)
    const trend = 1 + w * 0.0015;

    // Random noise: ±15%
    const noise = 0.85 + rng() * 0.30;

    const demand = Math.max(1, Math.round(baseDemand * seasonal * trend * noise));

    const date = new Date(startDate);
    date.setDate(date.getDate() + w * 7);

    history.push({
      week: w + 1,
      month,
      monthName: date.toLocaleString('en-US', { month: 'short' }),
      demand,
      date: date.toISOString().slice(0, 10),
    });
  }
  return history;
}

/**
 * Generate historical data for all inventory items.
 * @param {Array} inventoryData — from toInventoryData()
 * @returns {Map<string, Array>} — name → history array
 */
export function generateHistoricalData(inventoryData) {
  const map = new Map();
  for (const item of inventoryData) {
    map.set(item.name, generateItemHistory(item));
  }
  return map;
}

// ─── Forecasting algorithm ──────────────────────────────────────────────────

/**
 * Forecast next `weeksAhead` weeks using Holt-Winters-inspired method.
 *
 * @param {Array<{ week, month, demand }>} history — 52-week historical data
 * @param {number} weeksAhead — number of weeks to forecast (default 8)
 * @returns {{ forecast: Array<{ week, demand, lower, upper, month, date }>, accuracy: number }}
 */
export function forecastDemand(history, weeksAhead = 8) {
  if (!history || history.length < 4) {
    return { forecast: [], accuracy: 0 };
  }

  const n = history.length;
  const demands = history.map((h) => h.demand);

  // ── Step 1: Compute seasonal indices (monthly) ──
  const monthSums = new Array(12).fill(0);
  const monthCounts = new Array(12).fill(0);
  for (const h of history) {
    monthSums[h.month] += h.demand;
    monthCounts[h.month]++;
  }
  const overallAvg = demands.reduce((a, b) => a + b, 0) / n;
  const seasonalIdx = monthSums.map((s, i) =>
    monthCounts[i] > 0 ? s / monthCounts[i] / overallAvg : 1
  );

  // ── Step 2: Deseasonalize ──
  const deseasonalized = history.map((h) => h.demand / (seasonalIdx[h.month] || 1));

  // ── Step 3: Holt's exponential smoothing on deseasonalized series ──
  const alpha = 0.3; // level smoothing
  const beta = 0.1; // trend smoothing

  let level = deseasonalized[0];
  let trend = (deseasonalized[Math.min(3, n - 1)] - deseasonalized[0]) / Math.min(3, n - 1);

  const fitted = [];
  const residuals = [];

  for (let i = 0; i < n; i++) {
    const prevLevel = level;
    level = alpha * deseasonalized[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;

    const fittedVal = (level + trend) * (seasonalIdx[history[i].month] || 1);
    fitted.push(fittedVal);
    residuals.push(demands[i] - fittedVal);
  }

  // ── Step 4: Residual statistics for confidence intervals ──
  const residMean = residuals.reduce((a, b) => a + b, 0) / n;
  const residStd = Math.sqrt(
    residuals.reduce((a, r) => a + (r - residMean) ** 2, 0) / n
  );

  // Forecast accuracy (MAPE)
  const mape =
    demands.reduce((sum, d, i) => sum + Math.abs(d - fitted[i]) / Math.max(d, 1), 0) / n;
  const accuracy = Math.round((1 - mape) * 1000) / 10; // e.g. 94.8%

  // ── Step 5: Project forward ──
  const lastDate = new Date(history[n - 1].date);
  const forecast = [];

  for (let h = 1; h <= weeksAhead; h++) {
    const forecastDate = new Date(lastDate);
    forecastDate.setDate(forecastDate.getDate() + h * 7);
    const month = forecastDate.getMonth();

    const projLevel = level + trend * h;
    const demand = Math.max(1, Math.round(projLevel * (seasonalIdx[month] || 1)));

    // Widening confidence band
    const spread = residStd * Math.sqrt(h) * 1.2;
    forecast.push({
      week: n + h,
      demand,
      lower: Math.max(0, Math.round(demand - spread)),
      upper: Math.round(demand + spread),
      month,
      monthName: forecastDate.toLocaleString('en-US', { month: 'short' }),
      date: forecastDate.toISOString().slice(0, 10),
    });
  }

  return { forecast, accuracy, seasonalIdx, fitted };
}

// ─── Weekly trend analysis ──────────────────────────────────────────────────

/**
 * Compute average demand by day-of-week from weekly history.
 * Since we have weekly granularity, we simulate daily breakdown using DOW weights.
 */
export function getWeeklyTrendAnalysis(history) {
  if (!history || history.length === 0) return [];

  const avgWeekly = history.reduce((s, h) => s + h.demand, 0) / history.length;
  const totalWeight = DOW_WEIGHTS.reduce((a, b) => a + b, 0);

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return dayNames.map((name, i) => ({
    day: name,
    shortDay: name.slice(0, 3),
    avgDemand: Math.round((avgWeekly * DOW_WEIGHTS[i]) / totalWeight),
    weight: DOW_WEIGHTS[i],
  }));
}

// ─── Seasonal indices for heatmap ───────────────────────────────────────────

/**
 * Get seasonal indices for a set of items grouped by category.
 * @returns {Array<{ category, months: number[12] }>} — each month value is a multiplier
 */
export function getSeasonalHeatmap(inventoryData) {
  const categories = [...new Set(inventoryData.map((i) => i.category))];
  return categories.map((cat) => ({
    category: cat,
    months: getSeasonalProfile(cat),
  }));
}

// ─── Supply recommendations ─────────────────────────────────────────────────

/**
 * Compute supply planning recommendations.
 * @param {Map<string, { forecast }>} forecastMap — name → forecastDemand() result
 * @param {Array} inventoryData
 * @returns {Array<{ name, category, currentStock, predicted8Week, weeksUntilStockout, recommendedOrder, urgency }>}
 */
export function getSupplyRecommendations(forecastMap, inventoryData) {
  return inventoryData.map((item) => {
    const fc = forecastMap.get(item.name);
    if (!fc || !fc.forecast.length) {
      return {
        name: item.name,
        category: item.category,
        currentStock: item.quantity,
        predicted8Week: 0,
        weeksUntilStockout: 99,
        recommendedOrder: 0,
        urgency: 'ok',
      };
    }

    const predicted8Week = fc.forecast.reduce((s, f) => s + f.demand, 0);
    const avgWeekly = predicted8Week / fc.forecast.length;

    // Weeks until stockout
    let weeksLeft = 0;
    let remaining = item.quantity;
    for (const f of fc.forecast) {
      remaining -= f.demand;
      if (remaining <= 0) break;
      weeksLeft++;
    }
    if (remaining > 0) {
      // Stock lasts beyond forecast horizon — extrapolate
      weeksLeft = avgWeekly > 0 ? Math.round(item.quantity / avgWeekly) : 99;
    }

    // Safety stock = 2 weeks of average demand
    const safetyStock = Math.round(avgWeekly * 2);
    const recommendedOrder = Math.max(0, predicted8Week + safetyStock - item.quantity);

    let urgency = 'ok';
    if (weeksLeft <= 2) urgency = 'critical';
    else if (weeksLeft <= 4) urgency = 'warning';

    return {
      name: item.name,
      category: item.category,
      currentStock: item.quantity,
      predicted8Week,
      weeksUntilStockout: weeksLeft,
      recommendedOrder,
      urgency,
      accuracy: fc.accuracy,
    };
  }).sort((a, b) => a.weeksUntilStockout - b.weeksUntilStockout);
}

// ─── AI Insight generation ──────────────────────────────────────────────────

/**
 * Generate dynamic AI insights from forecast data.
 * @returns {Array<{ type: 'alert'|'warning'|'success'|'info', title, message, confidence }>}
 */
export function generateInsights(recommendations, seasonalHeatmap) {
  const insights = [];
  const now = new Date(2026, 3, 1);
  const currentMonth = now.getMonth();

  // Critical stockout risks
  const critical = recommendations.filter((r) => r.urgency === 'critical');
  for (const item of critical.slice(0, 2)) {
    insights.push({
      type: 'alert',
      title: `Stockout Risk: ${item.name}`,
      message: `Only ${item.weeksUntilStockout} week(s) of supply remaining. Order ${item.recommendedOrder} units immediately.`,
      confidence: item.accuracy || 92,
    });
  }

  // Seasonal alerts
  for (const cat of seasonalHeatmap) {
    const nextMonth = (currentMonth + 1) % 12;
    if (cat.months[nextMonth] > 1.15) {
      insights.push({
        type: 'warning',
        title: `Seasonal Surge: ${cat.category}`,
        message: `${cat.category} demand expected to rise ${Math.round((cat.months[nextMonth] - 1) * 100)}% next month due to seasonal patterns.`,
        confidence: 88,
      });
    }
  }

  // Overstock opportunities
  const overstock = recommendations.filter((r) => r.weeksUntilStockout > 12);
  for (const item of overstock.slice(0, 1)) {
    insights.push({
      type: 'success',
      title: `Overstock: ${item.name}`,
      message: `${item.weeksUntilStockout}+ weeks of supply on hand. Consider slowing reorders to free cash flow.`,
      confidence: 91,
    });
  }

  // Weekly trend insight
  insights.push({
    type: 'info',
    title: 'Peak Demand Days',
    message: 'Fridays show 15% higher demand than average. Ensure adequate staffing and stock for end-of-week rush.',
    confidence: 95,
  });

  return insights;
}

// ─── Aggregate helpers ──────────────────────────────────────────────────────

/**
 * Aggregate all item histories into a single "All Medicines" demand series.
 */
export function aggregateHistories(historyMap) {
  const allKeys = [...historyMap.keys()];
  if (allKeys.length === 0) return [];

  const firstHistory = historyMap.get(allKeys[0]);
  return firstHistory.map((_, weekIdx) => {
    let totalDemand = 0;
    let date = '';
    let month = 0;
    let monthName = '';
    for (const key of allKeys) {
      const h = historyMap.get(key);
      if (h[weekIdx]) {
        totalDemand += h[weekIdx].demand;
        date = h[weekIdx].date;
        month = h[weekIdx].month;
        monthName = h[weekIdx].monthName;
      }
    }
    return { week: weekIdx + 1, demand: totalDemand, date, month, monthName };
  });
}
