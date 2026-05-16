/**
 * productionDb.ts
 *
 * Supabase-backed data layer for all production data that must be accessible
 * from any device (tablet, phone, desktop). Replaces the IndexedDB-only
 * functions in adminDb.ts for DailyProductionReport.
 *
 * All records are stored in a single `app_data` table as JSONB under
 * (table_name, id) — simple, flexible, no column mapping needed.
 *
 * Migration: on first load, existing IndexedDB data is automatically
 * pushed to Supabase so no data is lost.
 */

import { createClient } from "@/lib/supabase/client";
import {
  getAllRecords as idbGetAll,
  seedEmployeesData as idbSeedEmployees,
  getAllEmployees as idbGetAllEmployees,
} from "@/lib/adminDb";
import {
  getCachedAll,
  setCachedAll,
  cacheRecord,
  removeCachedRecord,
  isOnline,
} from "@/lib/offlineCache";

// Re-export constant and types so DailyProductionReport only needs one import
export { REEFER_STORAGE } from "@/lib/adminDb";
export type {
  SupervisorDelivery,
  SupervisorDeliveryLine,
  NurseryLoad,
  TreeOrder,
  TreeOrderLine,
  ProjectBlock,
  BlockAllocation,
  UpcomingBlockPlan,
  TreeTransfer,
  TreeTransferLine,
  DeliveryPlan,
  DeliveryPlanLine,
  BlockAdjustment,
  BlockTarget,
} from "@/lib/adminDb";

// ── Internal helpers ────────────────────────────────────────────────────────

const APP_DATA_TABLE = "app_data";

function sb() {
  return createClient();
}

async function sbGetAll<T>(storeName: string): Promise<T[]> {
  // Offline: return cached snapshot.
  if (!isOnline()) {
    return getCachedAll<T>(storeName);
  }
  // Online: try Supabase first, refresh cache, fall back to cache on error
  // (covers navigator.onLine lying — e.g. captive-portal WiFi).
  try {
    const { data, error } = await sb()
      .from(APP_DATA_TABLE)
      .select("data")
      .eq("table_name", storeName);
    if (error) throw error;
    const records = (data ?? []).map((r) => r.data as T);
    void setCachedAll(storeName, records as Array<T & { id: string }>);
    return records;
  } catch (err) {
    console.warn("[productionDb] read fell back to cache:", storeName, err);
    return getCachedAll<T>(storeName);
  }
}

async function sbUpsert<T extends { id: string }>(
  storeName: string,
  record: T
): Promise<void> {
  // Keep the local cache in sync first so the UI's next read is consistent
  // regardless of what happens on the wire.
  void cacheRecord(storeName, record);

  if (!isOnline()) {
    // Phase 2: writes still throw when offline. Phase 3 will queue + replay.
    throw new Error(`[productionDb] offline — write to ${storeName} not sent`);
  }
  const { error } = await sb()
    .from(APP_DATA_TABLE)
    .upsert(
      {
        table_name: storeName,
        id: record.id,
        data: record,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "table_name,id" }
    );
  if (error) throw new Error(`[productionDb] upsert ${storeName}: ${error.message}`);
}

async function sbDelete(storeName: string, id: string): Promise<void> {
  void removeCachedRecord(storeName, id);

  if (!isOnline()) {
    throw new Error(`[productionDb] offline — delete on ${storeName} not sent`);
  }
  const { error } = await sb()
    .from(APP_DATA_TABLE)
    .delete()
    .eq("table_name", storeName)
    .eq("id", id);
  if (error) throw new Error(`[productionDb] delete ${storeName}: ${error.message}`);
}

// ── Generic CRUD (drop-in for adminDb.ts) ───────────────────────────────────

export async function getAllRecords<T>(storeName: string): Promise<T[]> {
  return sbGetAll<T>(storeName);
}

export async function saveRecord<T extends { id: string }>(
  storeName: string,
  record: T
): Promise<void> {
  return sbUpsert(storeName, record);
}

export async function deleteRecord(storeName: string, id: string): Promise<void> {
  return sbDelete(storeName, id);
}

// ── Typed wrappers ──────────────────────────────────────────────────────────

import type {
  SupervisorDelivery,
  TreeOrder,
  UpcomingBlockPlan,
  TreeTransfer,
  DeliveryPlan,
  BlockAdjustment,
  BlockTarget,
} from "@/lib/adminDb";

export async function getSupervisorDeliveries(): Promise<SupervisorDelivery[]> {
  return sbGetAll<SupervisorDelivery>("supervisor_deliveries");
}
export async function saveSupervisorDelivery(d: SupervisorDelivery): Promise<void> {
  return sbUpsert("supervisor_deliveries", d);
}
export async function deleteSupervisorDelivery(id: string): Promise<void> {
  return sbDelete("supervisor_deliveries", id);
}

export async function getTreeOrders(): Promise<TreeOrder[]> {
  return sbGetAll<TreeOrder>("tree_orders");
}
export async function saveTreeOrder(o: TreeOrder): Promise<void> {
  return sbUpsert("tree_orders", o);
}
export async function deleteTreeOrder(id: string): Promise<void> {
  return sbDelete("tree_orders", id);
}

export async function getUpcomingBlockPlans(): Promise<UpcomingBlockPlan[]> {
  return sbGetAll<UpcomingBlockPlan>("upcoming_block_plans");
}
export async function saveUpcomingBlockPlan(p: UpcomingBlockPlan): Promise<void> {
  return sbUpsert("upcoming_block_plans", p);
}
export async function deleteUpcomingBlockPlan(id: string): Promise<void> {
  return sbDelete("upcoming_block_plans", id);
}

export async function getTreeTransfers(): Promise<TreeTransfer[]> {
  return sbGetAll<TreeTransfer>("tree_transfers");
}
export async function saveTreeTransfer(t: TreeTransfer): Promise<void> {
  return sbUpsert("tree_transfers", t);
}
export async function deleteTreeTransfer(id: string): Promise<void> {
  return sbDelete("tree_transfers", id);
}

export async function getDeliveryPlans(): Promise<DeliveryPlan[]> {
  return sbGetAll<DeliveryPlan>("delivery_plans");
}
export async function saveDeliveryPlan(p: DeliveryPlan): Promise<void> {
  return sbUpsert("delivery_plans", p);
}
export async function deleteDeliveryPlan(id: string): Promise<void> {
  return sbDelete("delivery_plans", id);
}

export async function getAllBlockAdjustments(): Promise<BlockAdjustment[]> {
  return sbGetAll<BlockAdjustment>("block_adjustments");
}
export async function saveBlockAdjustment(a: BlockAdjustment): Promise<void> {
  return sbUpsert("block_adjustments", a);
}
export async function deleteBlockAdjustment(id: string): Promise<void> {
  return sbDelete("block_adjustments", id);
}

export async function getAllBlockTargets(): Promise<BlockTarget[]> {
  return sbGetAll<BlockTarget>("block_targets");
}
export async function saveBlockTarget(t: BlockTarget): Promise<void> {
  return sbUpsert("block_targets", t);
}

// ── Employees ───────────────────────────────────────────────────────────────
// First-device-wins bootstrap: if Supabase already has employees we treat it
// as canonical and never push from local IndexedDB (which prevents a tablet
// with a colliding emp-id from overwriting the desktop's record). If Supabase
// is empty, we run the IndexedDB seed and push the full local set up.

export async function seedEmployeesData(): Promise<void> {
  const existing = await sbGetAll<{ id: string }>("employees");
  if (existing.length > 0) return;

  await idbSeedEmployees();
  const local = (await idbGetAllEmployees()) as { id: string }[];
  if (!local.length) return;

  const rows = local.map((e) => ({
    table_name: "employees",
    id: e.id,
    data: e,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await sb()
    .from(APP_DATA_TABLE)
    .upsert(rows, { onConflict: "table_name,id" });
  if (error) console.error("[productionDb] employees bootstrap push:", error.message);
  else console.log(`[productionDb] employees bootstrap: pushed ${rows.length} from local IDB`);
}

export async function getAllEmployees(): Promise<unknown[]> {
  return sbGetAll<unknown>("employees");
}

// ── IndexedDB → Supabase migration ─────────────────────────────────────────

const MIGRATION_KEY = "integrity_prod_migrated_v1";

const MIGRATE_STORES = [
  "production_entries",
  "supervisor_deliveries",
  "tree_transfers",
  "tree_orders",
  "block_targets",
  "block_adjustments",
  "upcoming_block_plans",
  "species_rates",
  "project_blocks",
  "session_drafts",
  "nursery_loads",
  "delivery_plans",
];

/**
 * Call once on app mount. Reads all records from IndexedDB and upserts them
 * into Supabase. A localStorage flag prevents re-running on subsequent loads.
 * Safe to call from any device — if IndexedDB is empty, it's a no-op.
 */
export async function migrateFromIndexedDB(): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(MIGRATION_KEY)) return;

  console.log("[productionDb] Migrating local data to Supabase…");
  let totalMigrated = 0;
  let totalLocalRecords = 0;
  let anyFailures = false;

  for (const store of MIGRATE_STORES) {
    try {
      const records = await idbGetAll<{ id: string }>(store);
      if (!records.length) continue;
      totalLocalRecords += records.length;

      const rows = records.map((r) => ({
        table_name: store,
        id: r.id,
        data: r,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await sb()
        .from(APP_DATA_TABLE)
        .upsert(rows, { onConflict: "table_name,id" });

      if (error) {
        console.error(`[productionDb] migrate ${store}:`, error.message);
        anyFailures = true;
      } else {
        console.log(`[productionDb] migrated ${store}: ${records.length} records`);
        totalMigrated += records.length;
      }
    } catch (e) {
      console.warn(`[productionDb] migrate ${store} failed:`, e);
      anyFailures = true;
    }
  }

  // Only mark migration complete if nothing failed. Otherwise we'd lock the
  // user out of retry on next load and the data would appear lost.
  if (anyFailures) {
    console.error(
      `[productionDb] Migration had failures — NOT marking complete. ` +
      `Local records: ${totalLocalRecords}, migrated: ${totalMigrated}. ` +
      `Will retry on next page load.`
    );
    return;
  }

  localStorage.setItem(MIGRATION_KEY, "1");
  console.log(`[productionDb] Migration complete. ${totalMigrated} records synced.`);
}
