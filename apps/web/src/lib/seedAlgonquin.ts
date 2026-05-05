/**
 * One-time seeder for the Algonquin Park 2026 Tree Plant project.
 *
 * Fetches all PDFs from /seeds/algonquin-2026/ (public folder),
 * creates a StoredProject + file blobs in IndexedDB, then creates
 * ProjectBlock records (with species allocations) and BlockTarget
 * records (prescription totals) from the 2026 AFA spreadsheet.
 *
 * Safe to call multiple times — exits early if the project already exists.
 */

import {
  getAllProjects,
  saveProject,
  saveFileBlob,
  saveProjectBlock,
  saveBlockTarget,
  type StoredProject,
  type StoredFileMeta,
  type ProjectBlock,
  type BlockTarget,
} from "@/lib/adminDb";

// ── Block data (from "final tree plant numbers (2).xlsx") ────────────────────

interface BlockDef {
  name: string;
  area: number;
  density?: number;
  mapFile: string | null;
  species: { code: string; trees: number }[];
}

const BLOCKS: BlockDef[] = [
  {
    name: "Big George North", area: 10.6, density: 1400,
    mapFile: "Big George North.pdf",
    species: [{ code: "Pw", trees: 14840 }],
  },
  {
    name: "Wee George", area: 23.5, density: 1400,
    mapFile: "Wee George.pdf",
    species: [{ code: "Pw", trees: 32900 }],
  },
  {
    name: "Odenback", area: 52.8, density: 1400,
    mapFile: "Odenback.pdf",
    species: [{ code: "Pw", trees: 73920 }],
  },
  {
    name: "Burnt Camp", area: 42.7, density: 1400,
    mapFile: "Burnt Camp.pdf",
    species: [
      { code: "Pw", trees: 41846 },
      { code: "Pr", trees: 17934 },
    ],
  },
  {
    name: "Km 78-79", area: 83.1, density: 1552,
    mapFile: "Km 78 79.pdf",
    species: [
      { code: "Pw", trees: 17000 },
      { code: "Pr", trees: 50360 },
      { code: "Pj", trees: 61600 },
    ],
  },
  {
    name: "Rouge Creek", area: 55.9, density: 1663,
    mapFile: "Rouge Creek.pdf",
    species: [
      { code: "Pw", trees: 19460 },
      { code: "Pr", trees: 73500 },
    ],
  },
  {
    name: "North Rouge", area: 55.6, density: 1350,
    mapFile: "North Rouge.pdf",
    species: [{ code: "Pw", trees: 75060 }],
  },
  {
    name: "McManus Lake", area: 7.0, density: 1600,
    mapFile: "McManus Lake.pdf",
    species: [{ code: "Pr", trees: 11200 }],
  },
  {
    name: "McGuey", area: 88.9, density: 1365,
    mapFile: "McGuey.pdf",
    species: [{ code: "Pw", trees: 121370 }],
  },
  {
    name: "Teal Lake", area: 125.2, density: 1242,
    mapFile: "Teal Lake Final TP Map.pdf",
    species: [
      { code: "Pw", trees: 94250 },
      { code: "Pr", trees: 61286 },
    ],
  },
  {
    name: "Km 78 South", area: 0,
    mapFile: "km 78 South.pdf",
    species: [],
  },
  {
    name: "Brent", area: 0,
    mapFile: "Brent Plant Overview.pdf",
    species: [],
  },
];

const OVERVIEW_FILES = [
  { filename: "overview map.pdf",             displayName: "Overview Map"             },
  { filename: "Km 78 79 Operational Map.pdf", displayName: "Km 78-79 Operational Map" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROJECT_ID   = "algonquin-2026";
const PROJECT_NAME = "Algonquin Park 2026";
const BASE_URL     = "/seeds/algonquin-2026";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function fetchBlob(url: string): Promise<Blob> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
  return resp.blob();
}

// ── Main seeder ───────────────────────────────────────────────────────────────

export interface SeedProgress {
  total: number;
  done: number;
  current: string;
}

export async function seedAlgonquinProject(
  onProgress?: (p: SeedProgress) => void
): Promise<"seeded" | "already_exists"> {
  const existing = await getAllProjects();
  if (existing.some((p) => p.id === PROJECT_ID)) return "already_exists";

  const now   = new Date().toISOString();
  const total = OVERVIEW_FILES.length + BLOCKS.filter(b => b.mapFile).length;
  let done    = 0;

  function progress(label: string) {
    done++;
    onProgress?.({ total, done, current: label });
  }

  const fileMetas: StoredFileMeta[] = [];

  // 1. Overview / operational maps
  for (const def of OVERVIEW_FILES) {
    const url  = `${BASE_URL}/${encodeURIComponent(def.filename)}`;
    const blob = await fetchBlob(url);
    const id   = uid("alg-f");
    await saveFileBlob(id, PROJECT_ID, blob);
    fileMetas.push({ id, name: def.displayName, category: "map", size: formatBytes(blob.size), uploadedAt: now });
    progress(def.displayName);
  }

  // 2. Block map files
  const mapFileIds = new Map<string, string>();
  for (const blk of BLOCKS) {
    if (!blk.mapFile) continue;
    const url  = `${BASE_URL}/${encodeURIComponent(blk.mapFile)}`;
    const blob = await fetchBlob(url);
    const id   = uid("alg-m");
    await saveFileBlob(id, PROJECT_ID, blob);
    fileMetas.push({ id, name: blk.name, category: "map", size: formatBytes(blob.size), uploadedAt: now });
    mapFileIds.set(blk.mapFile, id);
    progress(blk.name);
  }

  // 3. Save project
  const project: StoredProject = {
    id:        PROJECT_ID,
    name:      PROJECT_NAME,
    location:  "Algonquin Provincial Park, Ontario",
    season:    "2026",
    status:    "active",
    createdAt: now,
    files:     fileMetas,
  };
  await saveProject(project);

  // 4. ProjectBlock records with species allocations
  for (const blk of BLOCKS) {
    const mapFileId = blk.mapFile ? mapFileIds.get(blk.mapFile) : undefined;
    const block: ProjectBlock = {
      id:          uid("alg-b"),
      projectId:   PROJECT_ID,
      blockName:   blk.name,
      area:        blk.area,
      density:     blk.density,
      mapFileId,
      allocations: blk.species.map(s => ({ id: uid("alg-a"), species: s.code, trees: s.trees })),
    };
    await saveProjectBlock(block);
  }

  // 5. BlockTarget records (prescription totals)
  for (const blk of BLOCKS) {
    const prescriptionTotal = blk.species.reduce((s, sp) => s + sp.trees, 0);
    if (prescriptionTotal === 0) continue;
    const target: BlockTarget = {
      id:             `${PROJECT_ID}|${blk.name}`,
      project:        PROJECT_NAME,
      block:          blk.name,
      prescription:   prescriptionTotal,
      treesDelivered: 0,
    };
    await saveBlockTarget(target);
  }

  return "seeded";
}
