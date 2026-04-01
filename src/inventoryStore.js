/**
 * inventoryStore.js
 * Single source of truth for inventory.
 * Persists to localStorage so data survives page refreshes.
 * Both the Sell page (medicineDB) and Inventory page (inventoryData)
 * are derived from this store.
 */

import { initialInventoryData, initialMedicineDB } from './data.js';

const BASE_KEY = 'pharmaai_inventory_v1';

/** Returns the localStorage key scoped to the current user/pharmacy */
function storageKey(username) {
  return username ? `${BASE_KEY}_${username.toLowerCase()}` : BASE_KEY;
}

// ─── helpers ────────────────────────────────────────────────────────────────

/** Compute stock % level (0-100) from quantity vs a baseline */
function stockPercent(quantity, baseQuantity) {
  if (!baseQuantity || baseQuantity === 0) return 0;
  return Math.min(100, Math.round((quantity / baseQuantity) * 100));
}

/** Derive status string from quantity */
export function deriveStatus(quantity, expiry) {
  const daysToExpiry = expiry
    ? Math.ceil((new Date(expiry) - new Date()) / 86400000)
    : Infinity;

  if (daysToExpiry <= 60) return 'expiring';
  if (quantity <= 0) return 'critical';
  if (quantity <= 50) return 'critical';
  if (quantity <= 200) return 'low-stock';
  return 'in-stock';
}

// ─── build the unified record list ──────────────────────────────────────────

/**
 * Each unified record merges inventoryData + medicineDB fields:
 * {
 *   barcode, name, category, price, unit,         ← from medicineDB
 *   quantity, expiry,                              ← from inventoryData
 *   stock (0-100%), status,                        ← derived
 *   baseQuantity,                                  ← initial quantity (for % calc)
 * }
 */
function buildUnifiedRecords() {
  return initialInventoryData.map((inv) => {
    const med = initialMedicineDB.find(
      (m) => m.name.toLowerCase() === inv.name.toLowerCase()
    ) || {};
    return {
      barcode: med.barcode || '',
      name: inv.name,
      category: inv.category,
      price: med.price || 0,
      unit: med.unit || 'Unit',
      quantity: inv.quantity,
      baseQuantity: inv.quantity,          // never changes – used for % bar
      expiry: inv.expiry,
      stock: stockPercent(inv.quantity, inv.quantity), // 100% initially
      status: deriveStatus(inv.quantity, inv.expiry),
      lastUpdated: null,
    };
  });
}

// ─── persistence ─────────────────────────────────────────────────────────────

export function loadInventory(username) {
  try {
    const raw = localStorage.getItem(storageKey(username));
    if (raw) return JSON.parse(raw);
  } catch { }
  const fresh = buildUnifiedRecords();
  saveInventory(fresh, username);
  return fresh;
}

export function saveInventory(records, username) {
  try {
    localStorage.setItem(storageKey(username), JSON.stringify(records));
  } catch { }
}

/** Hard-reset to initial seed data (useful for dev / settings) */
export function resetInventory(username) {
  const fresh = buildUnifiedRecords();
  saveInventory(fresh, username);
  return fresh;
}

// ─── mutation ────────────────────────────────────────────────────────────────

/**
 * Deduct sold quantities from inventory records.
 * @param {Array} records   - current inventory array
 * @param {Array} cartItems - [{ barcode, name, qty }]
 * @returns {Array} new updated records
 */
export function applyCartSale(records, cartItems) {
  const now = new Date().toISOString();
  return records.map((rec) => {
    // Primary match: barcode + expiry (unique batch key) — handles same-name/same-barcode multi-expiry batches
    const soldItem = cartItems.find((c) => {
      const byBatchKey = c.barcode === rec.barcode && c.expiry === rec.expiry;
      // Fallback for old cart items without expiry: match by barcode only (single-batch case)
      const byBarcode = c.barcode === rec.barcode && !c.expiry;
      const byName = !c.barcode && c.name === rec.name;
      return byBatchKey || byBarcode || byName;
    });
    if (!soldItem) return rec;

    const newQty = Math.max(0, rec.quantity - soldItem.qty);
    return {
      ...rec,
      quantity: newQty,
      stock: stockPercent(newQty, rec.baseQuantity),
      status: deriveStatus(newQty, rec.expiry),
      lastUpdated: now,
    };
  });
}

// ─── view projections ────────────────────────────────────────────────────────

/** Project unified records → shape expected by InventoryPage */
export function toInventoryData(records) {
  return records.map((r) => ({
    name: r.name,
    category: r.category,
    stock: r.stock,
    quantity: r.quantity,
    expiry: r.expiry,
    status: r.status,
    lastUpdated: r.lastUpdated,
    price: r.price ?? 0,   // ← rate per unit
    unit: r.unit ?? 'Unit',
  }));
}

/** Project unified records → shape expected by SellPage (medicineDB) */
export function toMedicineDB(records) {
  return records.map((r) => ({
    barcode: r.barcode,
    name: r.name,
    category: r.category,
    price: r.price,
    stock: r.quantity,   // SellPage uses `stock` as raw unit count
    unit: r.unit,
    expiry: r.expiry,    // needed for FEFO enforcement
  }));
}

