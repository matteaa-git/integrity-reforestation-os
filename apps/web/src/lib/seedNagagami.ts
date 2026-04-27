/**
 * One-time seeder for the Nagagami 2026 tree-planting project.
 *
 * Fetches all PDFs / spreadsheets from /seeds/nagagami-2026/ (public folder),
 * creates a StoredProject + file blobs in IndexedDB, then creates ProjectBlock
 * records for every block with area data from the tender package table.
 *
 * Safe to call multiple times — exits early if the project already exists.
 */

import {
  getAllProjects,
  saveProject,
  saveFileBlob,
  saveProjectBlock,
  type StoredProject,
  type StoredFileMeta,
  type ProjectBlock,
} from "@/lib/adminDb";

// ── Static block data (from MU390_2026_PLANT_TenderPackage_TABLE.xls) ───────

interface BlockDef {
  /** Display name used as blockName in ProjectBlock */
  name: string;
  area: number; // hectares
  /** Filename inside /seeds/nagagami-2026/Block_Maps/ — null = no map file */
  mapFile: string | null;
  type: "regular" | "overflow";
}

const BLOCKS: BlockDef[] = [
  { name: "1046",                        area: 32.00,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_1046.pdf",                       type: "regular" },
  { name: "1047",                        area: 29.73,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_1047.pdf",                       type: "regular" },
  { name: "1052",                        area: 38.09,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_1052.pdf",                       type: "regular" },
  { name: "1060",                        area: 64.66,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_1060.pdf",                       type: "regular" },
  { name: "1397",                        area: 4.38,   mapFile: "2026_NAG_Treeplant_Block_Map_REG_1397.pdf",                       type: "regular" },
  { name: "1398",                        area: 18.35,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_1398.pdf",                       type: "regular" },
  { name: "1434",                        area: 17.02,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_1434.pdf",                       type: "regular" },
  { name: "1436",                        area: 144.55, mapFile: "2026_NAG_Treeplant_Block_Map_REG_1436.pdf",                       type: "regular" },
  { name: "1437",                        area: 65.89,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_1437.pdf",                       type: "regular" },
  { name: "1440",                        area: 12.15,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_1440.pdf",                       type: "regular" },
  { name: "1441",                        area: 36.81,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_1441.pdf",                       type: "regular" },
  { name: "1455",                        area: 15.00,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_1455.pdf",                       type: "regular" },
  { name: "1456",                        area: 85.57,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_1456.pdf",                       type: "regular" },
  { name: "1457",                        area: 59.65,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_1457.pdf",                       type: "regular" },
  { name: "1458",                        area: 27.61,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_1458.pdf",                       type: "regular" },
  { name: "1470 (North Part)",           area: 87.65,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_1470_NorthPart.pdf",             type: "regular" },
  { name: "1470 (South Part)",           area: 217.56, mapFile: "2026_NAG_Treeplant_Block_Map_REG_1470_SouthPart.pdf",             type: "regular" },
  { name: "1472",                        area: 32.73,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_1472.pdf",                       type: "regular" },
  { name: "1486",                        area: 40.57,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_1486.pdf",                       type: "regular" },
  { name: "1508",                        area: 39.74,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_1508.pdf",                       type: "regular" },
  { name: "1557",                        area: 43.94,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_1557.pdf",                       type: "regular" },
  { name: "1613",                        area: 60.78,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_1613.pdf",                       type: "regular" },
  { name: "1620",                        area: 14.45,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_1620.pdf",                       type: "regular" },
  { name: "Bayfield 120",               area: 8.76,   mapFile: "2026_NAG_Treeplant_Block_Map_REG_Bayfield120.pdf",               type: "regular" },
  { name: "Bayfield 123",               area: 15.56,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_Bayfield123.pdf",               type: "regular" },
  { name: "Beaton 125",                 area: 159.32, mapFile: "2026_NAG_Treeplant_Block_Map_REG_Beaton125.pdf",                 type: "regular" },
  { name: "Beaton 132",                 area: 1.97,   mapFile: "2026_NAG_Treeplant_Block_Map_REG_Beaton132.pdf",                 type: "regular" },
  { name: "Beaton 139",                 area: 29.66,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_Beaton139.pdf",                 type: "regular" },
  { name: "Beaton 147",                 area: 34.38,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_Beaton147.pdf",                 type: "regular" },
  { name: "Breckenridge 129",           area: 152.59, mapFile: "2026_NAG_Treeplant_Block_Map_REG_Breckenridge129.pdf",           type: "regular" },
  { name: "Breckenridge 174",           area: 11.80,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_Breckenridge174.pdf",           type: "regular" },
  { name: "Ermine 120",                 area: 4.74,   mapFile: "2026_NAG_Treeplant_Block_Map_REG_Ermine120.pdf",                 type: "regular" },
  { name: "Ermine 121",                 area: 17.99,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_Ermine121.pdf",                 type: "regular" },
  { name: "Ermine 122 (North East Part)", area: 137.67, mapFile: "2026_NAG_Treeplant_Block_Map_REG_Ermine122_NorthEastPart.pdf", type: "regular" },
  { name: "Ermine 122 (South East Part)", area: 74.39,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_Ermine122_SouthEastPart.pdf", type: "regular" },
  { name: "Ermine 122 (West Part)",     area: 140.60, mapFile: "2026_NAG_Treeplant_Block_Map_REG_Ermine122_WestPart.pdf",        type: "regular" },
  { name: "Hawkins 121",                area: 70.15,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_Hawkins121.pdf",                type: "regular" },
  { name: "Hawkins 124",                area: 15.92,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_Hawkins124.pdf",                type: "regular" },
  { name: "Irving 120",                 area: 166.72, mapFile: "2026_NAG_Treeplant_Block_Map_REG_Irving120.pdf",                 type: "regular" },
  { name: "Irving 125",                 area: 160.14, mapFile: "2026_NAG_Treeplant_Block_Map_REG_Irving125.pdf",                 type: "regular" },
  { name: "Irving 126-H",               area: 35.14,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_Irving126-H.pdf",               type: "regular" },
  { name: "Irving 128",                 area: 62.72,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_Irving128.pdf",                 type: "regular" },
  { name: "Irving 129",                 area: 52.09,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_Irving129.pdf",                 type: "regular" },
  { name: "Irving 131",                 area: 58.16,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_Irving131.pdf",                 type: "regular" },
  { name: "Irving 132",                 area: 139.13, mapFile: "2026_NAG_Treeplant_Block_Map_REG_Irving132.pdf",                 type: "regular" },
  { name: "Irving 134",                 area: 149.33, mapFile: "2026_NAG_Treeplant_Block_Map_REG_Irving134.pdf",                 type: "regular" },
  { name: "Irving 136",                 area: 54.18,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_Irving136.pdf",                 type: "regular" },
  { name: "Lascelles 122",              area: 34.26,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_Lascelles122.pdf",              type: "regular" },
  { name: "Nameigos 120",               area: 29.41,  mapFile: "2026_NAG_Treeplant_Block_Map_REG_Nameigos120.pdf",               type: "regular" },
  { name: "Nameigos 121",               area: 4.52,   mapFile: "2026_NAG_Treeplant_Block_Map_REG_Nameigos121.pdf",               type: "regular" },
  // Overflow blocks — no map file available
  { name: "Beaton 141",                 area: 15.34,  mapFile: null, type: "overflow" },
  { name: "Lipton 123",                 area: 11.99,  mapFile: null, type: "overflow" },
  { name: "Nameigos 123",               area: 5.88,   mapFile: null, type: "overflow" },
];

// ── Project-level files (not tied to a specific block) ───────────────────────

interface ProjectFileDef {
  path: string; // relative to /seeds/nagagami-2026/
  displayName: string;
  category: StoredFileMeta["category"];
}

const PROJECT_FILES: ProjectFileDef[] = [
  {
    path: "Proposed_Treeplant_Final_2026_Nag_Overview_42x48.pdf",
    displayName: "2026 Nagagami Overview Map (42×48)",
    category: "map",
  },
  {
    path: "Proposed_Treeplant_Final_2026_Nag_Summary_11x17.pdf",
    displayName: "2026 Nagagami Summary (11×17)",
    category: "document",
  },
  {
    path: "MU390_2026_PLANT_TenderPackage_TABLE.xls",
    displayName: "MU390 2026 Plant Tender Package Table",
    category: "tender",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROJECT_ID = "nagagami-2026";
const BASE_URL   = "/seeds/nagagami-2026";

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

/**
 * Seeds the Nagagami 2026 project into IndexedDB.
 *
 * @param onProgress  Optional callback called as each file is fetched.
 * @returns           "seeded" | "already_exists"
 */
export async function seedNagagamiProject(
  onProgress?: (p: SeedProgress) => void
): Promise<"seeded" | "already_exists"> {
  // Guard: skip if already seeded
  const existing = await getAllProjects();
  if (existing.some((p) => p.id === PROJECT_ID)) return "already_exists";

  const now = new Date().toISOString();

  // Total fetch operations: PROJECT_FILES + block map files
  const blockMaps = BLOCKS.filter((b) => b.mapFile !== null);
  const total = PROJECT_FILES.length + blockMaps.length;
  let done = 0;

  function progress(label: string) {
    done++;
    onProgress?.({ total, done, current: label });
  }

  // ── 1. Fetch and store project-level files ────────────────────────────────

  const fileMetas: StoredFileMeta[] = [];

  for (const def of PROJECT_FILES) {
    const url  = `${BASE_URL}/${def.path}`;
    const blob = await fetchBlob(url);
    const id   = uid("nag-f");

    await saveFileBlob(id, PROJECT_ID, blob);
    fileMetas.push({
      id,
      name: def.displayName,
      category: def.category,
      size: formatBytes(blob.size),
      uploadedAt: now,
    });
    progress(def.displayName);
  }

  // ── 2. Fetch block map files ──────────────────────────────────────────────

  /** Map from mapFile filename → { fileId, meta } */
  const blockFileMap = new Map<string, { id: string; size: string }>();

  for (const blk of blockMaps) {
    const filename = blk.mapFile!;
    const url      = `${BASE_URL}/Block_Maps/${encodeURIComponent(filename)}`;
    const blob     = await fetchBlob(url);
    const id       = uid("nag-m");

    await saveFileBlob(id, PROJECT_ID, blob);
    const meta: StoredFileMeta = {
      id,
      name: filename.replace(".pdf", "").replace(/_/g, " "),
      category: "map",
      size: formatBytes(blob.size),
      uploadedAt: now,
    };
    fileMetas.push(meta);
    blockFileMap.set(filename, { id, size: meta.size });
    progress(filename);
  }

  // ── 3. Save the project record ────────────────────────────────────────────

  const project: StoredProject = {
    id:        PROJECT_ID,
    name:      "Nagagami 2026",
    location:  "Nagagami, Ontario",
    season:    "2026",
    status:    "active",
    createdAt: now,
    files:     fileMetas,
  };

  await saveProject(project);

  // ── 4. Save all project blocks ────────────────────────────────────────────

  for (const blk of BLOCKS) {
    const mapEntry = blk.mapFile ? blockFileMap.get(blk.mapFile) : undefined;
    const block: ProjectBlock = {
      id:          uid("nag-b"),
      projectId:   PROJECT_ID,
      blockName:   blk.name,
      area:        blk.area,
      mapFileId:   mapEntry?.id,
      allocations: [],
    };
    await saveProjectBlock(block);
  }

  return "seeded";
}
