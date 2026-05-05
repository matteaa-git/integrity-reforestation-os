/**
 * One-time seeder for the Algonquin Park 2026 Tree Plant project.
 *
 * Fetches all PDFs from /seeds/algonquin-2026/ (public folder),
 * creates a StoredProject + file blobs in IndexedDB.
 *
 * Safe to call multiple times — exits early if the project already exists.
 */

import {
  getAllProjects,
  saveProject,
  saveFileBlob,
  type StoredProject,
  type StoredFileMeta,
} from "@/lib/adminDb";

// ── Map files ────────────────────────────────────────────────────────────────

interface MapFileDef {
  filename: string;
  displayName: string;
  category: "map" | "document";
}

const MAP_FILES: MapFileDef[] = [
  { filename: "overview map.pdf",              displayName: "Overview Map",             category: "map"      },
  { filename: "Brent Plant Overview.pdf",      displayName: "Brent Plant Overview",     category: "map"      },
  { filename: "Km 78 79 Operational Map.pdf",  displayName: "Km 78–79 Operational Map", category: "map"      },
  { filename: "Km 78 79.pdf",                  displayName: "Km 78–79",                 category: "map"      },
  { filename: "Big George North.pdf",          displayName: "Big George North",         category: "map"      },
  { filename: "Burnt Camp.pdf",                displayName: "Burnt Camp",               category: "map"      },
  { filename: "McGuey.pdf",                    displayName: "McGuey",                   category: "map"      },
  { filename: "McManus Lake.pdf",              displayName: "McManus Lake",             category: "map"      },
  { filename: "North Rouge.pdf",               displayName: "North Rouge",              category: "map"      },
  { filename: "Odenback.pdf",                  displayName: "Odenback",                 category: "map"      },
  { filename: "Rouge Creek.pdf",               displayName: "Rouge Creek",              category: "map"      },
  { filename: "Teal Lake.pdf",                 displayName: "Teal Lake",                category: "map"      },
  { filename: "Wee George.pdf",                displayName: "Wee George",               category: "map"      },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROJECT_ID = "algonquin-2026";
const BASE_URL   = "/seeds/algonquin-2026";

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
 * Seeds the Algonquin Park 2026 project into IndexedDB.
 *
 * @param onProgress  Optional callback called as each file is fetched.
 * @returns           "seeded" | "already_exists"
 */
export async function seedAlgonquinProject(
  onProgress?: (p: SeedProgress) => void
): Promise<"seeded" | "already_exists"> {
  const existing = await getAllProjects();
  if (existing.some((p) => p.id === PROJECT_ID)) return "already_exists";

  const now   = new Date().toISOString();
  const total = MAP_FILES.length;
  let done    = 0;

  function progress(label: string) {
    done++;
    onProgress?.({ total, done, current: label });
  }

  const fileMetas: StoredFileMeta[] = [];

  for (const def of MAP_FILES) {
    const url  = `${BASE_URL}/${encodeURIComponent(def.filename)}`;
    const blob = await fetchBlob(url);
    const id   = uid("alg-f");

    await saveFileBlob(id, PROJECT_ID, blob);
    fileMetas.push({
      id,
      name:       def.displayName,
      category:   def.category,
      size:       formatBytes(blob.size),
      uploadedAt: now,
    });
    progress(def.displayName);
  }

  const project: StoredProject = {
    id:        PROJECT_ID,
    name:      "Algonquin Park 2026",
    location:  "Algonquin Provincial Park, Ontario",
    season:    "2026",
    status:    "active",
    createdAt: now,
    files:     fileMetas,
  };

  await saveProject(project);

  return "seeded";
}
