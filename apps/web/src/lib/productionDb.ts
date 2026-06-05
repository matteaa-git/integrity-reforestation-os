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
  enqueueWrite,
  getQueuedWrites,
  dequeueWrite,
  updateQueuedWrite,
  type QueuedWrite,
} from "@/lib/offlineCache";

function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err as Error).message ?? String(err);
  return /failed to fetch|network|load failed|abort|connection|err_internet_disconnected|err_network/i.test(msg);
}

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

    // Preserve unsynced local writes — if a record is still in the queue,
    // it hasn't reached the server yet, so we keep the local version and
    // exclude the (possibly missing) server copy. Without this guard, a
    // failed Supabase write would silently disappear on the next read when
    // setCachedAll overwrites the cache.
    const queued = await getQueuedWrites();
    const pendingUpserts = queued.filter(q => q.table === storeName && q.op === "upsert");
    const pendingDeletes = new Set(queued.filter(q => q.table === storeName && q.op === "delete").map(q => q.recordId));
    const pendingMap = new Map<string, T>();
    for (const q of pendingUpserts) {
      if (q.data) pendingMap.set(q.recordId, q.data as T);
    }
    const merged: T[] = [];
    for (const r of records) {
      const id = (r as unknown as { id?: string }).id;
      if (id && pendingDeletes.has(id)) continue;   // about-to-be-deleted, hide
      if (id && pendingMap.has(id)) {
        merged.push(pendingMap.get(id)!);            // local version wins
        pendingMap.delete(id);
      } else {
        merged.push(r);
      }
    }
    for (const r of pendingMap.values()) merged.push(r); // local-only inserts

    void setCachedAll(storeName, merged as Array<T & { id: string }>);
    return merged;
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
    await enqueueWrite({ table: storeName, recordId: record.id, op: "upsert", data: record });
    return;
  }
  try {
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
    if (error) {
      // Queue every failed write — even non-network failures (RLS hiccup,
      // transient auth, etc.) — so a single bad request can't silently
      // discard the user's data. The drainer retries on reconnect/focus.
      await enqueueWrite({ table: storeName, recordId: record.id, op: "upsert", data: record });
      if (!isNetworkError(error)) {
        throw new Error(`[productionDb] upsert ${storeName}: ${error.message} (queued for retry)`);
      }
      return;
    }
  } catch (err) {
    await enqueueWrite({ table: storeName, recordId: record.id, op: "upsert", data: record });
    if (!isNetworkError(err)) throw err;
  }
}

async function sbDelete(storeName: string, id: string): Promise<void> {
  void removeCachedRecord(storeName, id);

  if (!isOnline()) {
    await enqueueWrite({ table: storeName, recordId: id, op: "delete" });
    return;
  }
  try {
    const { error } = await sb()
      .from(APP_DATA_TABLE)
      .delete()
      .eq("table_name", storeName)
      .eq("id", id);
    if (error) {
      await enqueueWrite({ table: storeName, recordId: id, op: "delete" });
      if (!isNetworkError(error)) {
        throw new Error(`[productionDb] delete ${storeName}: ${error.message} (queued for retry)`);
      }
      return;
    }
  } catch (err) {
    await enqueueWrite({ table: storeName, recordId: id, op: "delete" });
    if (!isNetworkError(err)) throw err;
  }
}

// ── Sync queue drain ─────────────────────────────────────────────────────

/** Replay a single queued op against Supabase. Returns true on success. */
async function replayWrite(w: QueuedWrite): Promise<boolean> {
  try {
    if (w.op === "upsert") {
      const { error } = await sb()
        .from(APP_DATA_TABLE)
        .upsert(
          {
            table_name: w.table,
            id: w.recordId,
            data: w.data,
            // Preserve the original enqueue time so concurrent edits on other
            // devices still win by recency (Supabase last-write-wins).
            updated_at: new Date(w.enqueuedAt).toISOString(),
          },
          { onConflict: "table_name,id" }
        );
      if (error) throw new Error(error.message);
    } else if (w.op === "delete") {
      const { error } = await sb()
        .from(APP_DATA_TABLE)
        .delete()
        .eq("table_name", w.table)
        .eq("id", w.recordId);
      if (error) throw new Error(error.message);
    }
    return true;
  } catch (err) {
    console.warn("[productionDb] replay failed:", w.table, w.recordId, w.op, err);
    return false;
  }
}

let draining = false;

/**
 * Drain the offline queue against Supabase in enqueue order. Idempotent and
 * safe to call repeatedly (online events, focus, timer). Returns the number
 * of writes successfully replayed in this drain.
 */
export async function flushPendingWrites(): Promise<number> {
  if (typeof window === "undefined") return 0;
  if (!isOnline())                  return 0;
  if (draining)                     return 0;

  draining = true;
  let replayed = 0;
  try {
    const queued = await getQueuedWrites();
    for (const w of queued) {
      const success = await replayWrite(w);
      if (success) {
        await dequeueWrite(w.id);
        replayed++;
      } else {
        // Bump attempt counter, keep in queue, stop draining for now so we
        // don't hammer a broken backend. Next online/focus tick will retry.
        await updateQueuedWrite({ ...w, attempts: w.attempts + 1, lastError: "replay failed" });
        break;
      }
    }
  } finally {
    draining = false;
  }
  if (replayed > 0) console.log(`[productionDb] flushed ${replayed} queued write${replayed !== 1 ? "s" : ""}`);
  return replayed;
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

// ── Position ID backfill ────────────────────────────────────────────────────
// Pull ADP position IDs into existing employee records whose employeeNumber
// is missing or stale. Idempotent and bandwidth-light — pushes only changed
// rows. A localStorage flag prevents re-running once everyone is patched.
const POSITION_ID_BACKFILL_KEY = "integrity_position_id_backfill_v1";

export async function backfillEmployeePositionIds(): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(POSITION_ID_BACKFILL_KEY)) return;
  if (!isOnline()) return;

  const { POSITION_IDS_BY_NAME } = await import("@/lib/positionIds");
  const employees = await sbGetAll<{ id: string; name?: string; employeeNumber?: string }>("employees");
  if (employees.length === 0) return;

  const toUpdate: typeof employees = [];
  for (const e of employees) {
    if (!e?.name) continue;
    const correct = POSITION_IDS_BY_NAME[e.name];
    if (!correct) continue;
    if (e.employeeNumber === correct) continue;
    toUpdate.push({ ...e, employeeNumber: correct });
  }
  if (toUpdate.length === 0) {
    localStorage.setItem(POSITION_ID_BACKFILL_KEY, "1");
    return;
  }

  const rows = toUpdate.map(e => ({
    table_name: "employees",
    id: e.id,
    data: e,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await sb()
    .from(APP_DATA_TABLE)
    .upsert(rows, { onConflict: "table_name,id" });
  if (error) {
    console.error("[productionDb] position-id backfill failed:", error.message);
    return; // leave flag unset so we retry next load
  }
  // Refresh the local read cache too.
  for (const e of toUpdate) await cacheRecord("employees", e);

  localStorage.setItem(POSITION_ID_BACKFILL_KEY, "1");
  console.log(`[productionDb] backfilled position IDs on ${toUpdate.length} employee${toUpdate.length !== 1 ? "s" : ""}`);
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
