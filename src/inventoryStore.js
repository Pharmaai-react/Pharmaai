/**
 * inventoryStore.js — Supabase version
 * Pure helper functions (deriveStatus, toInventoryData, toMedicineDB) unchanged.
 * All storage functions are now async and talk to Supabase.
 */
import { supabase } from './supabase.js';

// ── Pure helpers (unchanged) ──────────────────────────────────────────────────

export function deriveStatus(quantity, expiry) {
  const days = expiry
    ? Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000)
    : Infinity;
  if (days <= 0)   return 'expired';
  if (days <= 30)  return 'expiring';
  if (quantity <= 0)  return 'out';
  if (quantity <= 20) return 'critical';
  if (quantity <= 50) return 'low';
  return 'normal';
}

export function toInventoryData(records) {
  return records.map(r => ({
    _id:         r._id,
    name:        r.name,
    category:    r.category     || 'General',
    stock:       Math.min(100, Math.round((r.quantity / 200) * 100)),
    quantity:    r.quantity     || 0,
    expiry:      r.expiry,
    status:      r.status       || deriveStatus(r.quantity, r.expiry),
    lastUpdated: r.lastUpdated,
    price:       r.price        ?? 0,
    unit:        r.unit         ?? 'Unit',
    barcode:     r.barcode      || '',
  }));
}

export function toMedicineDB(records) {
  const db = {};
  records.forEach(r => {
    const key = r.barcode || r.name;
    if (!db[key]) db[key] = { name: r.name, category: r.category, price: r.price, batches: [] };
    db[key].batches.push({ expiry: r.expiry, quantity: r.quantity, _id: r._id });
  });
  return db;
}

// ── DB row → app record ───────────────────────────────────────────────────────

function rowToRecord(row) {
  return {
    _id:         row.id,
    name:        row.name,
    category:    row.category,
    barcode:     row.barcode    || '',
    quantity:    row.quantity   || 0,
    expiry:      row.expiry,
    price:       parseFloat(row.price) || 0,
    unit:        row.unit       || 'Unit',
    status:      row.status     || deriveStatus(row.quantity, row.expiry),
    lastUpdated: row.last_updated,
  };
}

// ── Async storage API ─────────────────────────────────────────────────────────

export async function loadInventory(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('user_id', userId)
    .order('expiry', { ascending: true, nullsFirst: false });
  if (error) { console.error('[inventory] load:', error); return []; }
  return (data || []).map(rowToRecord);
}

export async function addInventoryItem(userId, item) {
  const { data, error } = await supabase
    .from('inventory')
    .insert({
      user_id:      userId,
      name:         item.name,
      category:     item.category || 'General',
      barcode:      item.barcode  || '',
      quantity:     item.quantity || 0,
      expiry:       item.expiry   || null,
      price:        item.price    || 0,
      unit:         item.unit     || 'Unit',
      status:       deriveStatus(item.quantity, item.expiry),
      last_updated: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) { console.error('[inventory] add:', error); return null; }
  return rowToRecord(data);
}

export async function updateInventoryItem(itemId, updates) {
  const { error } = await supabase
    .from('inventory')
    .update({
      ...('name'     in updates && { name:     updates.name }),
      ...('category' in updates && { category: updates.category }),
      ...('quantity' in updates && { quantity: updates.quantity }),
      ...('expiry'   in updates && { expiry:   updates.expiry }),
      ...('price'    in updates && { price:    updates.price }),
      ...('unit'     in updates && { unit:     updates.unit }),
      ...('barcode'  in updates && { barcode:  updates.barcode }),
      status:       deriveStatus(updates.quantity, updates.expiry),
      last_updated: new Date().toISOString(),
    })
    .eq('id', itemId);
  if (error) console.error('[inventory] update:', error);
}

export async function deleteInventoryItem(userId, name, expiry) {
  // Deletes only the exact batch (name + expiry = unique batch key)
  const { error } = await supabase
    .from('inventory')
    .delete()
    .eq('user_id', userId)
    .eq('name', name)
    .eq('expiry', expiry);
  if (error) console.error('[inventory] delete:', error);
}

export async function applyCartSale(userId, cart) {
  // cart: [{ name, expiry, qty }]
  for (const item of cart) {
    const { data: record } = await supabase
      .from('inventory')
      .select('id, quantity')
      .eq('user_id', userId)
      .eq('name', item.name)
      .eq('expiry', item.expiry)
      .maybeSingle();
    if (record) {
      const newQty = Math.max(0, record.quantity - item.qty);
      await supabase.from('inventory').update({
        quantity:     newQty,
        status:       deriveStatus(newQty, item.expiry),
        last_updated: new Date().toISOString(),
      }).eq('id', record.id);
    }
  }
}

export async function resetInventory(userId) {
  // Deletes ALL inventory for this user (for the Settings reset button)
  const { error } = await supabase
    .from('inventory')
    .delete()
    .eq('user_id', userId);
  if (error) console.error('[inventory] reset:', error);
  return [];
}
