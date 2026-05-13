"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import FilePreviewModal from "@/components/admin/FilePreviewModal";
import BlockMapViewer from "@/components/admin/BlockMapViewer";
import { seedNagagamiProject, type SeedProgress } from "@/lib/seedNagagami";
import { seedAlgonquinProject } from "@/lib/seedAlgonquin";
import {
  getAllProjects,
  saveProject,
  deleteProject as dbDeleteProject,
  saveFileBlob,
  getFileObjectUrl,
  deleteFileBlob,
  getProjectBlocks,
  saveProjectBlock,
  deleteProjectBlock,
  getNurseryLoads,
  saveNurseryLoad,
  deleteNurseryLoad,
  getAllBlockTargets,
  saveBlockTarget,
  deleteBlockTarget,
  type StoredProject,
  type StoredFileMeta,
  type FileCategory,
  type ProjectStatus,
  type ProjectBlock,
  type BlockAllocation,
  type NurseryLoad,
  type NurserySpeciesLine,
  type NurseryLoadStatus,
  type BlockTarget,
} from "@/lib/adminDb";
import * as XLSX from "xlsx";

// ── Types ──────────────────────────────────────────────────────────────────

/** In-memory project with resolved object URLs for rendering. */
interface Project extends StoredProject {
  files: ProjectFileResolved[];
}

interface ProjectFileResolved extends StoredFileMeta {
  url: string; // temporary object URL resolved from IndexedDB blob
}

// ── Constants ──────────────────────────────────────────────────────────────

const FILE_CATEGORIES: { id: FileCategory; label: string; icon: string }[] = [
  { id: "map",             label: "Maps",                   icon: "⬢" },
  { id: "document",        label: "Documents",              icon: "◫" },
  { id: "spreadsheet",     label: "Spreadsheets",           icon: "▦" },
  { id: "presentation",    label: "Presentations",          icon: "▤" },
  { id: "tender",          label: "Tender Packages",        icon: "◧" },
  { id: "site-plan",       label: "Site Plans",             icon: "⬡" },
  { id: "site-assessment", label: "Site Assessments",       icon: "◉" },
  { id: "quality-report",  label: "Quality Reports",        icon: "☑" },
  { id: "nursery-slip",    label: "Nursery Delivery Slips", icon: "◌" },
];

const CATEGORY_MAP = Object.fromEntries(
  FILE_CATEGORIES.map((c) => [c.id, c])
) as Record<FileCategory, (typeof FILE_CATEGORIES)[number]>;

const CATEGORY_COLORS: Record<FileCategory, React.CSSProperties> = {
  "map":             { background: "rgba(57,222,139,0.12)",  color: "var(--color-primary)" },
  "document":        { background: "rgba(59,130,246,0.12)",  color: "var(--color-info)" },
  "spreadsheet":     { background: "rgba(20,184,166,0.12)",  color: "#14b8a6" },
  "presentation":    { background: "rgba(168,85,247,0.12)",  color: "#a855f7" },
  "tender":          { background: "rgba(249,115,22,0.12)",  color: "#f97316" },
  "site-plan":       { background: "rgba(99,102,241,0.12)",  color: "#6366f1" },
  "site-assessment": { background: "rgba(6,182,212,0.12)",   color: "#06b6d4" },
  "quality-report":  { background: "rgba(239,68,68,0.12)",   color: "var(--color-danger)" },
  "nursery-slip":    { background: "rgba(132,204,22,0.12)",  color: "#65a30d" },
};

const STATUS_BADGE: Record<ProjectStatus, { label: string; style: React.CSSProperties }> = {
  active:    { label: "Active",    style: { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" } },
  tendering: { label: "Tendering", style: { background: "rgba(251,183,0,0.12)",  color: "var(--color-warning)" } },
  completed: { label: "Completed", style: { background: "rgba(59,130,246,0.12)", color: "var(--color-info)"    } },
  archived:  { label: "Archived",  style: { background: "rgba(0,0,0,0.05)",      color: "var(--color-text-tertiary)" } },
};

const NURSERY_STATUS: Record<NurseryLoadStatus, { label: string; style: React.CSSProperties }> = {
  scheduled:   { label: "Scheduled",   style: { background: "rgba(59,130,246,0.12)",  color: "var(--color-info)" } },
  "in-transit":{ label: "In Transit",  style: { background: "rgba(251,183,0,0.12)",   color: "var(--color-warning)" } },
  delivered:   { label: "Delivered",   style: { background: "rgba(57,222,139,0.12)",  color: "var(--color-primary)" } },
  cancelled:   { label: "Cancelled",   style: { background: "rgba(0,0,0,0.05)",       color: "var(--color-text-tertiary)" } },
};

/** 16 visually distinct fill colors for species in the trailer diagram */
const SPECIES_PALETTE = [
  "#39de8b","#3b82f6","#f97316","#a855f7","#ef4444",
  "#14b8a6","#eab308","#ec4899","#06b6d4","#84cc16",
  "#8b5cf6","#f43f5e","#10b981","#6366f1","#fb923c","#0ea5e9",
];

/** 53-foot trailer: 26 columns × 2 rows = 52 cell positions */
const TRAILER_COLS = 26;
const TRAILER_ROWS = 2;
const TOTAL_CELLS  = TRAILER_COLS * TRAILER_ROWS;

function emptyDiagram(): string[] { return Array(TOTAL_CELLS).fill(""); }

// ── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Load a StoredProject from IndexedDB and resolve all file blobs to object URLs. */
async function resolveProject(stored: StoredProject): Promise<Project> {
  const resolvedFiles = await Promise.all(
    stored.files.map(async (meta) => {
      const url = await getFileObjectUrl(meta.id);
      return { ...meta, url: url ?? "" };
    })
  );
  return { ...stored, files: resolvedFiles };
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ProjectsCenter({ userRole = "admin" }: { userRole?: string }) {
  const isAdmin = userRole === "admin" || userRole === "supervisor";
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<FileCategory | "all">(isAdmin ? "all" : "map");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "blocks">("grid");
  const [isDragging, setIsDragging] = useState(false);

  // Modals
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [projectForm, setProjectForm] = useState({
    name: "", location: "", season: new Date().getFullYear().toString(), status: "active" as ProjectStatus,
  });

  // Upload
  const [uploadCategory, setUploadCategory] = useState<FileCategory>("document");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<{ file: File; category: FileCategory }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview / delete
  const [previewFile, setPreviewFile] = useState<ProjectFileResolved | null>(null);
  const [mapViewer, setMapViewer]     = useState<{ file: ProjectFileResolved; blockName: string; projectId: string } | null>(null);
  const [pendingMapOpen, setPendingMapOpen] = useState<{ projectId: string; blockName: string; fileId: string } | null>(null);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [deleteFileTarget, setDeleteFileTarget] = useState<{ projectId: string; fileId: string } | null>(null);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Nagagami 2026 seed
  const [nagaSeeding, setNagaSeeding] = useState(false);
  const [nagaProgress, setNagaProgress] = useState<SeedProgress | null>(null);

  // Algonquin 2026 seed
  const [algSeeding, setAlgSeeding]     = useState(false);
  const [algProgress, setAlgProgress]   = useState<SeedProgress | null>(null);

  // Project-level tab
  const [projectTab, setProjectTab] = useState<"files" | "nursery" | "blocks">("files");

  // Block prescriptions (Excel import + manual management)
  interface BlockPrescriptionRow {
    block: string;
    species: Record<string, number>;
    total: number;
  }
  const [prescriptions, setPrescriptions]         = useState<BlockPrescriptionRow[]>([]);
  const [prescriptionFile, setPrescriptionFile]   = useState<string>("");
  const [prescriptionSaved, setPrescriptionSaved] = useState(false);
  const [parsedSpecies, setParsedSpecies]         = useState<string[]>([]);
  const xlsxInputRef = useRef<HTMLInputElement>(null);

  // Saved block targets for current project
  const [savedTargets, setSavedTargets] = useState<BlockTarget[]>([]);
  // Inline-edit state: id → draft { prescription, treesDelivered }
  const [editingTargets, setEditingTargets] = useState<Record<string, { block: string; prescription: string; treesDelivered: string }>>({});
  const [addingTarget, setAddingTarget]     = useState(false);
  const [newTargetForm, setNewTargetForm]   = useState({ block: "", prescription: "", treesDelivered: "" });

  // Blocks
  const [blocks, setBlocks]           = useState<ProjectBlock[]>([]);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [editingBlock, setEditingBlock]     = useState<ProjectBlock | null>(null);
  const [blockForm, setBlockForm] = useState<{
    blockName: string; area: string; density: string;
    allocations: { id: string; species: string; trees: string }[];
  }>({ blockName: "", area: "", density: "", allocations: [{ id: crypto.randomUUID(), species: "", trees: "" }] });

  // Nursery loads
  const [nurseryLoads, setNurseryLoads]         = useState<NurseryLoad[]>([]);
  const [showNurseryModal, setShowNurseryModal] = useState(false);
  const [editingLoad, setEditingLoad]           = useState<NurseryLoad | null>(null);
  const [diagramLoad, setDiagramLoad]           = useState<NurseryLoad | null>(null);
  const [paintSpecies, setPaintSpecies]         = useState<string>("");
  const [isErasing, setIsErasing]               = useState(false);
  const [nurseryForm, setNurseryForm] = useState<{
    loadDate: string; deliveryDate: string; nurseryName: string;
    driver: string; status: NurseryLoadStatus; notes: string;
    species: { id: string; species: string; treesPerBox: string; numberOfBoxes: string }[];
    diagram: string[];
  }>({
    loadDate: "", deliveryDate: "", nurseryName: "", driver: "",
    status: "scheduled", notes: "",
    species: [{ id: crypto.randomUUID(), species: "", treesPerBox: "", numberOfBoxes: "" }],
    diagram: emptyDiagram(),
  });
  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function handleSeedAlgonquin() {
    setAlgSeeding(true);
    setAlgProgress({ total: 0, done: 0, current: "Starting…" });
    try {
      const result = await seedAlgonquinProject((p) => setAlgProgress(p));
      // Always reload so updated blocks/prescriptions are reflected
      const stored = await getAllProjects();
      const resolved = await Promise.all(stored.map(resolveProject));
      setProjects(resolved);
      setSelectedId("algonquin-2026");
      // The block-load useEffect only fires when selectedId *changes*; re-import
      // while Algonquin is already selected leaves stale (pre-reseed) blocks in
      // React state. Re-fetch them explicitly so freshly-linked mapFileIds show.
      const refreshedBlocks = await getProjectBlocks("algonquin-2026");
      setBlocks(refreshedBlocks);
      if (result === "already_exists") {
        showToast("Algonquin 2026 blocks & prescriptions refreshed");
      } else {
        showToast("Algonquin Park 2026 imported — 14 map files");
      }
    } catch (err) {
      showToast(`Import failed: ${(err as Error).message}`, "error");
    } finally {
      setAlgSeeding(false);
      setAlgProgress(null);
    }
  }

  async function handleSeedNagagami() {
    setNagaSeeding(true);
    setNagaProgress({ total: 0, done: 0, current: "Starting…" });
    try {
      const result = await seedNagagamiProject((p) => setNagaProgress(p));
      if (result === "already_exists") {
        showToast("Nagagami 2026 already imported", "success");
      } else {
        // Reload projects list and select the new project
        const stored = await getAllProjects();
        const resolved = await Promise.all(stored.map(resolveProject));
        setProjects(resolved);
        setSelectedId("nagagami-2026");
        showToast("Nagagami 2026 imported — 53 blocks · 52 files");
      }
    } catch (err) {
      showToast(`Import failed: ${(err as Error).message}`, "error");
    } finally {
      setNagaSeeding(false);
      setNagaProgress(null);
    }
  }

  const selectedProject = projects.find((p) => p.id === selectedId) ?? null;

  // ── Load from IndexedDB on mount ──────────────────────────────────────

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const stored = await getAllProjects();
      const resolved = await Promise.all(stored.map(resolveProject));
      setProjects(resolved);
      // Restore last selected project if it still exists
      setSelectedId((prev) => {
        if (prev && resolved.some((p) => p.id === prev)) return prev;
        return resolved.length > 0 ? resolved[0].id : null;
      });
    } catch (err) {
      console.error("Failed to load projects from IndexedDB", err);
      showToast("Failed to load saved projects", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (!selectedId) { setBlocks([]); return; }
    getProjectBlocks(selectedId).then(setBlocks);
    // Reset prescription state when switching projects
    setPrescriptions([]);
    setPrescriptionFile("");
    setPrescriptionSaved(false);
    setParsedSpecies([]);
    setEditingTargets({});
    setAddingTarget(false);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) { setNurseryLoads([]); return; }
    getNurseryLoads(selectedId).then(setNurseryLoads);
  }, [selectedId]);

  // Load saved block targets for the selected project
  const reloadTargets = useCallback(() => {
    const proj = projects.find(p => p.id === selectedId)?.name ?? "";
    if (!proj) { setSavedTargets([]); return; }
    getAllBlockTargets().then(all => {
      setSavedTargets(all.filter(t => t.project === proj).sort((a, b) => a.block.localeCompare(b.block)));
    });
  }, [selectedId, projects]);

  useEffect(() => { reloadTargets(); }, [reloadTargets]);

  // Cross-component handoff: when Daily Production fires "open-block-map"
  // (via the "Return to map" button after a quality plot is saved), bring
  // the user back to the same block's map. We may need to wait for the
  // project list to load, so stash the request in pendingMapOpen and let
  // the effect below complete the open once everything is available.
  useEffect(() => {
    function onOpen(e: Event) {
      const ev = e as CustomEvent<{ projectId: string; blockName: string; fileId: string }>;
      if (!ev.detail) return;
      setPendingMapOpen(ev.detail);
    }
    window.addEventListener("open-block-map", onOpen);
    return () => window.removeEventListener("open-block-map", onOpen);
  }, []);

  useEffect(() => {
    if (!pendingMapOpen) return;
    const project = projects.find(p => p.id === pendingMapOpen.projectId);
    if (!project) return; // wait until projects load
    const file = project.files.find(f => f.id === pendingMapOpen.fileId);
    if (!file?.url) {
      setPendingMapOpen(null); // file is gone — nothing to open
      return;
    }
    setSelectedId(pendingMapOpen.projectId);
    setProjectTab("blocks");
    setViewMode("blocks");
    setMapViewer({ file, blockName: pendingMapOpen.blockName, projectId: pendingMapOpen.projectId });
    setPendingMapOpen(null);
  }, [pendingMapOpen, projects]);

  // ── Project CRUD ──────────────────────────────────────────────────────

  function openNewProject() {
    setEditProject(null);
    setProjectForm({ name: "", location: "", season: new Date().getFullYear().toString(), status: "active" });
    setShowProjectModal(true);
  }

  function openEditProject(p: Project, e: React.MouseEvent) {
    e.stopPropagation();
    setEditProject(p);
    setProjectForm({ name: p.name, location: p.location, season: p.season, status: p.status });
    setShowProjectModal(true);
  }

  async function handleProjectSubmit() {
    if (!projectForm.name.trim()) return;
    try {
      if (editProject) {
        const updated: Project = { ...editProject, ...projectForm };
        // Persist metadata (files array without urls for storage)
        const toStore: StoredProject = {
          ...updated,
          files: updated.files.map(({ url: _url, ...meta }) => meta),
        };
        await saveProject(toStore);
        setProjects((prev) => prev.map((p) => (p.id === editProject.id ? updated : p)));
        showToast(`${projectForm.name} updated`);
      } else {
        const id = genId("proj");
        const newProject: Project = {
          id,
          ...projectForm,
          createdAt: today(),
          files: [],
        };
        await saveProject({ ...newProject, files: [] });
        setProjects((prev) => [...prev, newProject]);
        setSelectedId(id);
        showToast(`${projectForm.name} created`);
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to save project", "error");
    }
    setShowProjectModal(false);
  }

  async function handleDeleteProject() {
    if (!deleteProjectId) return;
    const p = projects.find((x) => x.id === deleteProjectId);
    try {
      await dbDeleteProject(deleteProjectId);
      setProjects((prev) => prev.filter((x) => x.id !== deleteProjectId));
      if (selectedId === deleteProjectId) setSelectedId(null);
      showToast(`${p?.name ?? "Project"} deleted`);
    } catch {
      showToast("Failed to delete project", "error");
    }
    setDeleteProjectId(null);
  }

  // ── File Upload ───────────────────────────────────────────────────────

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setPendingFiles(files.map((f) => ({ file: f, category: uploadCategory })));
    setShowUploadModal(true);
    e.target.value = "";
  }

  function handleDragOver(e: React.DragEvent) { e.preventDefault(); setIsDragging(true); }
  function handleDragLeave() { setIsDragging(false); }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (!files.length || !selectedProject) return;
    setPendingFiles(files.map((f) => ({ file: f, category: uploadCategory })));
    setShowUploadModal(true);
  }

  async function confirmUpload() {
    if (!selectedProject) return;
    setUploading(true);
    try {
      const newFileMetas: StoredFileMeta[] = [];
      const newFileResolved: ProjectFileResolved[] = [];

      for (const { file, category } of pendingFiles) {
        const id = genId("file");
        const meta: StoredFileMeta = {
          id,
          name: file.name,
          category,
          size: formatBytes(file.size),
          uploadedAt: today(),
        };
        // Save blob to IndexedDB
        await saveFileBlob(id, selectedProject.id, file);
        // Create object URL for this session
        const url = URL.createObjectURL(file);
        newFileMetas.push(meta);
        newFileResolved.push({ ...meta, url });
      }

      // Update project record in IndexedDB with new file metadata
      const updatedStoredFiles: StoredFileMeta[] = [
        ...selectedProject.files.map(({ url: _url, ...m }) => m),
        ...newFileMetas,
      ];
      await saveProject({ ...selectedProject, files: updatedStoredFiles });

      // Update in-memory state
      setProjects((prev) =>
        prev.map((p) =>
          p.id === selectedProject.id
            ? { ...p, files: [...p.files, ...newFileResolved] }
            : p
        )
      );

      showToast(`${newFileMetas.length} file${newFileMetas.length !== 1 ? "s" : ""} saved`);
    } catch (err) {
      console.error(err);
      showToast("Upload failed", "error");
    } finally {
      setUploading(false);
      setPendingFiles([]);
      setShowUploadModal(false);
    }
  }

  async function handleDeleteFile() {
    if (!deleteFileTarget) return;
    const { projectId, fileId } = deleteFileTarget;
    try {
      await deleteFileBlob(fileId);
      const project = projects.find((p) => p.id === projectId);
      if (!project) return;
      const updatedFiles = project.files.filter((f) => f.id !== fileId);
      const storedFiles: StoredFileMeta[] = updatedFiles.map(({ url: _url, ...m }) => m);
      await saveProject({ ...project, files: storedFiles });
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...p, files: updatedFiles } : p
        )
      );
      showToast("File removed");
    } catch {
      showToast("Failed to remove file", "error");
    }
    setDeleteFileTarget(null);
  }

  function handleDownload(file: ProjectFileResolved) {
    if (!file.url) { showToast("File not available", "error"); return; }
    const a = document.createElement("a");
    a.href = file.url;
    a.download = file.name;
    a.click();
  }

  // ── Derived ───────────────────────────────────────────────────────────

  const filteredProjects = projects.filter(
    (p) =>
      !projectSearch ||
      p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
      p.location.toLowerCase().includes(projectSearch.toLowerCase())
  );

  const filteredFiles = (selectedProject?.files ?? []).filter(
    (f) => categoryFilter === "all" || f.category === categoryFilter
  );

  const fileCounts = FILE_CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = (selectedProject?.files ?? []).filter((f) => f.category === cat.id).length;
    return acc;
  }, {} as Record<string, number>);

  const fieldCls =
    "w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50";

  // ── Block CRUD ────────────────────────────────────────────────────────

  function openNewBlock(mapFileId?: string, defaultName?: string) {
    setEditingBlock(null);
    setBlockForm({
      blockName: defaultName ?? "",
      area: "", density: "",
      allocations: [{ id: crypto.randomUUID(), species: "", trees: "" }],
    });
    setShowBlockModal(true);
    // store mapFileId for linking on save
    (openNewBlock as { _mapFileId?: string })._mapFileId = mapFileId;
  }

  function openEditBlock(b: ProjectBlock) {
    setEditingBlock(b);
    setBlockForm({
      blockName: b.blockName,
      area: b.area != null ? String(b.area) : "",
      density: b.density != null ? String(b.density) : "",
      allocations: b.allocations.length > 0
        ? b.allocations.map(a => ({ id: a.id, species: a.species, trees: String(a.trees) }))
        : [{ id: crypto.randomUUID(), species: "", trees: "" }],
    });
    setShowBlockModal(true);
  }

  async function saveBlock() {
    if (!blockForm.blockName.trim() || !selectedId) return;
    const allocations: BlockAllocation[] = blockForm.allocations
      .filter(a => a.species.trim() && Number(a.trees) > 0)
      .map(a => ({ id: a.id, species: a.species.trim(), trees: Number(a.trees) }));
    const block: ProjectBlock = {
      id: editingBlock?.id ?? `blk-${Date.now()}`,
      projectId: selectedId,
      blockName: blockForm.blockName.trim(),
      mapFileId: editingBlock?.mapFileId ?? (openNewBlock as { _mapFileId?: string })._mapFileId,
      area: blockForm.area ? Number(blockForm.area) : undefined,
      density: blockForm.density ? Number(blockForm.density) : undefined,
      allocations,
    };
    await saveProjectBlock(block);
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === block.id);
      return idx >= 0 ? prev.map(b => b.id === block.id ? block : b) : [...prev, block];
    });
    setShowBlockModal(false);
  }

  async function removeBlock(id: string) {
    await deleteProjectBlock(id);
    setBlocks(prev => prev.filter(b => b.id !== id));
  }

  // ── Nursery CRUD ──────────────────────────────────────────────────────

  function openNewLoad() {
    setEditingLoad(null);
    setNurseryForm({
      loadDate: "", deliveryDate: "", nurseryName: "", driver: "",
      status: "scheduled", notes: "",
      species: [{ id: crypto.randomUUID(), species: "", treesPerBox: "", numberOfBoxes: "" }],
      diagram: emptyDiagram(),
    });
    setPaintSpecies("");
    setShowNurseryModal(true);
  }

  function openEditLoad(load: NurseryLoad) {
    setEditingLoad(load);
    setNurseryForm({
      loadDate: load.loadDate, deliveryDate: load.deliveryDate,
      nurseryName: load.nurseryName ?? "", driver: load.driver ?? "",
      status: load.status, notes: load.notes ?? "",
      species: load.species.map(s => ({
        id: s.id, species: s.species,
        treesPerBox: String(s.treesPerBox), numberOfBoxes: String(s.numberOfBoxes),
      })),
      diagram: load.diagram.length === TOTAL_CELLS ? [...load.diagram] : emptyDiagram(),
    });
    setPaintSpecies(load.species[0]?.id ?? "");
    setShowNurseryModal(true);
  }

  async function saveLoad() {
    if (!nurseryForm.loadDate || !selectedId) return;
    const speciesLines: NurserySpeciesLine[] = nurseryForm.species
      .filter(s => s.species.trim())
      .map(s => ({
        id: s.id, species: s.species.trim(),
        treesPerBox: Number(s.treesPerBox) || 0,
        numberOfBoxes: Number(s.numberOfBoxes) || 0,
      }));
    const load: NurseryLoad = {
      id: editingLoad?.id ?? `nl-${Date.now()}`,
      projectId: selectedId,
      loadDate: nurseryForm.loadDate,
      deliveryDate: nurseryForm.deliveryDate,
      nurseryName: nurseryForm.nurseryName || undefined,
      driver: nurseryForm.driver || undefined,
      status: nurseryForm.status,
      notes: nurseryForm.notes || undefined,
      species: speciesLines,
      diagram: nurseryForm.diagram,
    };
    await saveNurseryLoad(load);
    setNurseryLoads(prev => {
      const idx = prev.findIndex(l => l.id === load.id);
      const next = idx >= 0 ? prev.map(l => l.id === load.id ? load : l) : [load, ...prev];
      return next.sort((a, b) => b.loadDate.localeCompare(a.loadDate));
    });
    setShowNurseryModal(false);
  }

  async function removeLoad(id: string) {
    await deleteNurseryLoad(id);
    setNurseryLoads(prev => prev.filter(l => l.id !== id));
    if (diagramLoad?.id === id) setDiagramLoad(null);
  }

  function paintCell(idx: number) {
    setNurseryForm(f => {
      const d = [...f.diagram];
      d[idx] = isErasing ? "" : paintSpecies;
      return { ...f, diagram: d };
    });
  }

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="text-xs text-text-tertiary animate-pulse">Loading projects…</div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: Project List ── */}
      <div className="w-60 bg-surface border-r border-border flex flex-col shrink-0">
        <div className="p-3 border-b border-border space-y-2">
          {isAdmin && (
            <>
              <button
                onClick={openNewProject}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
              >
                + New Project
              </button>

              {/* Nagagami 2026 one-click import */}
              <button
                onClick={handleSeedNagagami}
                disabled={nagaSeeding}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border hover:bg-surface-secondary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {nagaSeeding ? (
                  nagaProgress
                    ? `${nagaProgress.done}/${nagaProgress.total} files…`
                    : "Importing…"
                ) : (
                  "↓ Import Nagagami 2026"
                )}
              </button>

              <button
                onClick={handleSeedAlgonquin}
                disabled={algSeeding}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border hover:bg-surface-secondary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {algSeeding ? (
                  algProgress
                    ? `${algProgress.done}/${algProgress.total} files…`
                    : "Importing…"
                ) : (
                  "↓ Import Algonquin 2026"
                )}
              </button>
            </>
          )}

          <input
            type="text"
            placeholder="Search projects…"
            value={projectSearch}
            onChange={(e) => setProjectSearch(e.target.value)}
            className="w-full text-xs border border-border rounded-lg px-3 py-1.5 bg-surface-secondary text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50"
          />
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {filteredProjects.length === 0 ? (
            <div className="p-6 text-center">
              <div className="text-2xl opacity-15 mb-2">⬡</div>
              <div className="text-xs text-text-tertiary">No projects yet</div>
              {isAdmin && (
                <button onClick={openNewProject} className="text-xs text-primary hover:underline mt-1">
                  Create one
                </button>
              )}
            </div>
          ) : (
            filteredProjects.map((p) => {
              const isSelected = p.id === selectedId;
              const sb = STATUS_BADGE[p.status];
              return (
                <button
                  key={p.id}
                  onClick={() => { setSelectedId(p.id); setCategoryFilter(isAdmin ? "all" : "map"); }}
                  className={`w-full text-left px-3 py-2.5 border-b border-border-light transition-colors ${
                    isSelected ? "bg-primary/8 border-l-2 border-l-primary" : "hover:bg-surface-secondary"
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="text-xs font-semibold text-text-primary leading-snug truncate flex-1">
                      {p.name}
                    </div>
                    <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={sb.style}>
                      {sb.label}
                    </span>
                  </div>
                  <div className="text-[10px] text-text-tertiary mt-0.5 truncate">{p.location}</div>
                  <div className="text-[10px] text-text-tertiary">
                    {p.season} · {p.files.length} file{p.files.length !== 1 ? "s" : ""}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right: Project Detail ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selectedProject ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl opacity-10 mb-4">⬡</div>
              <div className="text-sm font-semibold text-text-secondary">Select a project</div>
              <div className="text-xs text-text-tertiary mt-1 mb-4">
                {isAdmin ? "Or create a new one to get started" : "Select a project to view its maps"}
              </div>
              {isAdmin && (
                <button
                  onClick={openNewProject}
                  className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
                >
                  + New Project
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Project header */}
            <div className="bg-surface border-b border-border px-6 py-4 shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-base font-semibold text-text-primary">{selectedProject.name}</h2>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={STATUS_BADGE[selectedProject.status].style}>
                      {STATUS_BADGE[selectedProject.status].label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-text-tertiary flex-wrap">
                    {selectedProject.location && <span>📍 {selectedProject.location}</span>}
                    <span>Season: {selectedProject.season}</span>
                    <span>Created {selectedProject.createdAt}</span>
                    <span>{selectedProject.files.length} file{selectedProject.files.length !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={(e) => openEditProject(selectedProject, e)}
                      className="px-3 py-1.5 text-xs font-medium bg-surface-secondary border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteProjectId(selectedProject.id)}
                      className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-danger hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Project-level tabs */}
            <div className="flex items-center border-b border-border bg-surface shrink-0 px-6">
              {(["files", "nursery", "blocks"] as const).filter(t => isAdmin || t === "files" || t === "blocks").map(t => (
                <button key={t} onClick={() => setProjectTab(t)}
                  className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    projectTab === t ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {t === "files" ? "Files & Blocks" : t === "nursery" ? "Nursery Slips" : "Block Prescriptions"}
                  {t === "nursery" && nurseryLoads.length > 0 && (
                    <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-text-tertiary/15">{nurseryLoads.length}</span>
                  )}
                  {t === "blocks" && prescriptions.length > 0 && (
                    <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-text-tertiary/15">{prescriptions.length}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Toolbar — files tab only */}
            {projectTab === "files" && <div className="bg-surface border-b border-border px-6 py-3 flex items-center gap-3 flex-wrap shrink-0">
              {/* Category filter pills */}
              <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
                <button
                  onClick={() => setCategoryFilter("all")}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-full transition-all"
                  style={categoryFilter === "all" ? { background: "var(--color-primary)", color: "var(--color-primary-deep)" } : {}}
                >
                  All ({selectedProject.files.length})
                </button>
                {FILE_CATEGORIES.filter((c) => fileCounts[c.id] > 0 || categoryFilter === c.id).map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-full transition-all"
                    style={categoryFilter === cat.id ? { background: "var(--color-primary)", color: "var(--color-primary-deep)" } : {}}
                  >
                    <span className="opacity-70">{cat.icon}</span>
                    {cat.label}
                    {fileCounts[cat.id] > 0 && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${categoryFilter === cat.id ? "bg-white/20" : "bg-text-tertiary/15"}`}>
                        {fileCounts[cat.id]}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* View + upload */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex rounded-lg border border-border overflow-hidden">
                  <button onClick={() => setViewMode("grid")}
                    className="px-2.5 py-1.5 text-xs transition-all"
                    style={viewMode === "grid" ? { background: "var(--color-primary)", color: "var(--color-primary-deep)" } : {}}>
                    ⊞
                  </button>
                  <button onClick={() => setViewMode("list")}
                    className="px-2.5 py-1.5 text-xs transition-all"
                    style={viewMode === "list" ? { background: "var(--color-primary)", color: "var(--color-primary-deep)" } : {}}>
                    ≡
                  </button>
                  <button onClick={() => setViewMode("blocks")}
                    className="px-2.5 py-1.5 text-xs transition-all flex items-center gap-1"
                    style={viewMode === "blocks" ? { background: "var(--color-primary)", color: "var(--color-primary-deep)" } : {}}>
                    ⬡
                    {blocks.length > 0 && viewMode !== "blocks" && (
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded-full bg-text-tertiary/15">{blocks.length}</span>
                    )}
                  </button>
                </div>

                {isAdmin && (
                  <>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value as FileCategory)}
                      className="text-xs border border-border rounded-lg px-2 py-1.5 bg-surface text-text-secondary focus:outline-none focus:border-primary/50"
                    >
                      {FILE_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                      ))}
                    </select>

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:opacity-90 transition-all"
                      style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
                    >
                      ↑ Upload
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.rtf,.zip,.rar,.dwg,.dxf,.kml,.kmz,.jpg,.jpeg,.png,.gif,.svg,.webp,.mp4,.mov,image/*"
                      onChange={handleFileInputChange}
                    />
                  </>
                )}
              </div>
            </div>}

            {/* Nursery Slips panel */}
            {projectTab === "nursery" && (() => {
              const totalTrees = nurseryLoads.reduce((s, l) =>
                s + l.species.reduce((ss, sp) => ss + sp.treesPerBox * sp.numberOfBoxes, 0), 0);
              return (
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="max-w-4xl mx-auto space-y-4">

                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-text-primary">Nursery Slips</div>
                        <div className="text-[11px] text-text-tertiary mt-0.5">
                          {nurseryLoads.length} load{nurseryLoads.length !== 1 ? "s" : ""} · {totalTrees.toLocaleString()} trees scheduled
                        </div>
                      </div>
                      <button onClick={openNewLoad}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-90 transition-all"
                        style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                        + Schedule Load
                      </button>
                    </div>

                    {nurseryLoads.length === 0 ? (
                      <div className="border-2 border-dashed border-border rounded-xl p-16 text-center">
                        <div className="text-3xl opacity-15 mb-2">🌲</div>
                        <div className="text-sm font-semibold text-text-secondary">No loads scheduled yet</div>
                        <div className="text-xs text-text-tertiary mt-1">Schedule a nursery pickup to get started</div>
                        <button onClick={openNewLoad} className="mt-4 text-xs font-medium px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-surface-secondary transition-colors">+ Schedule Load</button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {nurseryLoads.map(load => {
                          const trees = load.species.reduce((s, sp) => s + sp.treesPerBox * sp.numberOfBoxes, 0);
                          const boxes = load.species.reduce((s, sp) => s + sp.numberOfBoxes, 0);
                          const st = NURSERY_STATUS[load.status];
                          return (
                            <div key={load.id} className="bg-surface border border-border rounded-xl overflow-hidden">
                              <div className="flex items-center justify-between px-5 py-4">
                                <div className="flex items-center gap-4 min-w-0">
                                  <div className="shrink-0">
                                    <div className="text-xs font-semibold text-text-primary">Load {load.loadDate}</div>
                                    <div className="text-[11px] text-text-tertiary mt-0.5 flex items-center gap-2">
                                      {load.deliveryDate && <span>→ {load.deliveryDate}</span>}
                                      {load.nurseryName && <span>· {load.nurseryName}</span>}
                                      {load.driver && <span>· {load.driver}</span>}
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={st.style}>{st.label}</span>
                                  <div className="flex items-center gap-3 text-[11px] text-text-tertiary shrink-0">
                                    <span>{boxes} boxes</span>
                                    <span className="font-semibold text-text-primary">{trees.toLocaleString()} trees</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                    {load.species.map((sp, i) => (
                                      <span key={sp.id} className="text-[10px] px-2 py-0.5 rounded-full font-medium text-white"
                                        style={{ background: SPECIES_PALETTE[i % SPECIES_PALETTE.length] }}>
                                        {sp.species}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-3">
                                  <button onClick={() => setDiagramLoad(diagramLoad?.id === load.id ? null : load)}
                                    className="text-[11px] border border-border rounded-lg px-2.5 py-1.5 transition-colors hover:border-primary/50"
                                    style={diagramLoad?.id === load.id ? { background: "rgba(57,222,139,0.1)", color: "var(--color-primary)", borderColor: "rgba(57,222,139,0.4)" } : {}}>
                                    Diagram
                                  </button>
                                  <button onClick={() => openEditLoad(load)} className="text-[11px] text-text-tertiary hover:text-text-primary border border-border rounded-lg px-2.5 py-1.5 transition-colors">Edit</button>
                                  <button onClick={() => removeLoad(load.id)} className="text-[11px] text-danger border border-border rounded-lg px-2.5 py-1.5 transition-colors hover:bg-red-50">×</button>
                                </div>
                              </div>

                              {/* Inline diagram view */}
                              {diagramLoad?.id === load.id && (() => {
                                const colorMap = Object.fromEntries(load.species.map((sp, i) => [sp.id, SPECIES_PALETTE[i % SPECIES_PALETTE.length]]));
                                const nameMap  = Object.fromEntries(load.species.map(sp => [sp.id, sp.species]));
                                return (
                                  <div className="border-t border-border/50 px-5 py-4 bg-surface-secondary/40">
                                    <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">Load Diagram — 53-ft Trailer</div>
                                    {/* Legend */}
                                    <div className="flex flex-wrap gap-2 mb-4">
                                      {load.species.map((sp, i) => (
                                        <div key={sp.id} className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                                          <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: SPECIES_PALETTE[i % SPECIES_PALETTE.length] }} />
                                          {sp.species} ({sp.numberOfBoxes} boxes)
                                        </div>
                                      ))}
                                    </div>
                                    {/* Trailer grid */}
                                    <div className="relative">
                                      <div className="flex items-center gap-1 mb-1">
                                        <span className="text-[9px] text-text-tertiary w-12 text-right shrink-0">FRONT ▶</span>
                                        <div className="flex-1" />
                                        <span className="text-[9px] text-text-tertiary">◀ REAR DOORS</span>
                                      </div>
                                      <div className="border border-border rounded-lg overflow-hidden bg-surface">
                                        {Array.from({ length: TRAILER_ROWS }).map((_, row) => (
                                          <div key={row} className={`flex ${row === 0 ? "border-b border-border/50" : ""}`}>
                                            <div className="w-12 shrink-0 flex items-center justify-center text-[9px] text-text-tertiary font-medium border-r border-border/50 bg-surface-secondary">
                                              {row === 0 ? "L" : "R"}
                                            </div>
                                            <div className="flex flex-1">
                                              {Array.from({ length: TRAILER_COLS }).map((_, col) => {
                                                const idx = row * TRAILER_COLS + col;
                                                const spId = load.diagram[idx];
                                                const bg = spId ? colorMap[spId] : undefined;
                                                return (
                                                  <div key={col}
                                                    className={`flex-1 h-8 border-r border-border/20 last:border-r-0 flex items-center justify-center`}
                                                    style={{ background: bg ?? "transparent" }}
                                                    title={spId ? nameMap[spId] : `R${row+1}C${col+1}`}
                                                  >
                                                    {spId && <span className="text-[8px] font-bold text-white/90 leading-none">{nameMap[spId]?.slice(0,2).toUpperCase()}</span>}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                      <div className="flex items-center justify-between mt-1 text-[9px] text-text-tertiary px-12">
                                        <span>Col 1</span><span>Col {TRAILER_COLS}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Block Prescriptions panel */}
            {projectTab === "blocks" && selectedProject && (() => {
              function parseXlsx(file: File) {
                const reader = new FileReader();
                reader.onload = (e) => {
                  try {
                    const data   = new Uint8Array(e.target!.result as ArrayBuffer);
                    const wb     = XLSX.read(data, { type: "array" });
                    const ws     = wb.Sheets[wb.SheetNames[0]];
                    const rows: (string | number)[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

                    // Detect header row — find the row containing "Block" or "block"
                    let headerIdx = 0;
                    for (let i = 0; i < Math.min(10, rows.length); i++) {
                      if (rows[i].some(c => typeof c === "string" && /block/i.test(c))) {
                        headerIdx = i;
                        break;
                      }
                    }

                    const headers = rows[headerIdx].map(h => String(h).trim());
                    const blockCol = headers.findIndex(h => /block/i.test(h));
                    if (blockCol === -1) {
                      showToast("Could not find a 'Block' column in the spreadsheet.", "error");
                      return;
                    }

                    // Species columns = all columns after block col that have a header and contain numbers
                    const speciesCols: { idx: number; name: string }[] = [];
                    for (let c = 0; c < headers.length; c++) {
                      if (c === blockCol) continue;
                      const h = headers[c];
                      if (!h || /total/i.test(h) || /^[0-9]/.test(h)) continue;
                      // Check at least one data row has a number in this col
                      const hasData = rows.slice(headerIdx + 1).some(r => {
                        const v = r[c];
                        return v !== "" && !isNaN(Number(v)) && Number(v) > 0;
                      });
                      if (hasData) speciesCols.push({ idx: c, name: h });
                    }

                    const parsed: BlockPrescriptionRow[] = [];
                    for (let i = headerIdx + 1; i < rows.length; i++) {
                      const row   = rows[i];
                      const block = String(row[blockCol] ?? "").trim();
                      if (!block) continue;
                      const species: Record<string, number> = {};
                      let total = 0;
                      for (const sc of speciesCols) {
                        const v = Number(row[sc.idx]);
                        if (!isNaN(v) && v > 0) {
                          species[sc.name] = v;
                          total += v;
                        }
                      }
                      if (total > 0) parsed.push({ block, species, total });
                    }

                    setPrescriptions(parsed);
                    setParsedSpecies(speciesCols.map(s => s.name));
                    setPrescriptionFile(file.name);
                    setPrescriptionSaved(false);
                  } catch {
                    showToast("Failed to parse spreadsheet. Please check the file format.", "error");
                  }
                };
                reader.readAsArrayBuffer(file);
              }

              async function savePrescriptions() {
                for (const row of prescriptions) {
                  const key = `${selectedProject.name}|${row.block}`;
                  // Load existing target to preserve treesDelivered
                  const existing = (await getAllBlockTargets()).find(t => t.id === key);
                  const total    = row.total;
                  await saveBlockTarget({
                    id:             key,
                    project:        selectedProject.name,
                    block:          row.block,
                    prescription:   total,
                    treesDelivered: existing?.treesDelivered ?? 0,
                  });
                }
                setPrescriptionSaved(true);
                reloadTargets();
                showToast(`Saved prescriptions for ${prescriptions.length} blocks`, "success");
              }

              return (
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="max-w-5xl mx-auto space-y-5">

                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs font-semibold text-text-primary">Block Prescriptions</div>
                        <div className="text-[11px] text-text-tertiary mt-0.5">
                          Upload a tree planting numbers spreadsheet to import block prescriptions by species
                        </div>
                      </div>
                      {prescriptions.length > 0 && !prescriptionSaved && (
                        <button
                          onClick={savePrescriptions}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-90 transition-all"
                          style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
                        >
                          Save to Block Summary
                        </button>
                      )}
                      {prescriptionSaved && (
                        <span className="text-[11px] text-primary font-medium">✓ Saved to Block Summary</span>
                      )}
                    </div>

                    {/* Upload zone */}
                    <div
                      className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                      onClick={() => xlsxInputRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); }}
                      onDrop={e => {
                        e.preventDefault();
                        const f = e.dataTransfer.files[0];
                        if (f) parseXlsx(f);
                      }}
                    >
                      <div className="text-2xl opacity-30 mb-2">▦</div>
                      <div className="text-xs font-medium text-text-primary">
                        {prescriptionFile ? prescriptionFile : "Drop Excel file here or click to browse"}
                      </div>
                      <div className="text-[11px] text-text-tertiary mt-1">.xlsx or .xls — first sheet, block column auto-detected</div>
                      <input
                        ref={xlsxInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) parseXlsx(f); e.target.value = ""; }}
                      />
                    </div>

                    {/* Parsed results */}
                    {prescriptions.length > 0 && (
                      <div className="bg-surface border border-border rounded-xl overflow-hidden">
                        <div className="px-5 py-3 border-b border-border bg-surface-secondary/40 flex items-center justify-between">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                            {prescriptions.length} blocks · {parsedSpecies.length} species
                          </div>
                          <div className="text-[10px] text-text-tertiary">{prescriptionFile}</div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-tertiary sticky left-0 bg-surface">Block</th>
                                {parsedSpecies.map(sp => (
                                  <th key={sp} className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-text-tertiary whitespace-nowrap">{sp}</th>
                                ))}
                                <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {prescriptions.map((row, i) => (
                                <tr key={i} className="border-b border-border last:border-0 hover:bg-surface-secondary/30 transition-colors">
                                  <td className="px-4 py-2.5 font-semibold text-text-primary sticky left-0 bg-surface">{row.block}</td>
                                  {parsedSpecies.map(sp => (
                                    <td key={sp} className="px-4 py-2.5 text-right text-text-secondary">
                                      {row.species[sp] ? row.species[sp].toLocaleString() : <span className="text-text-tertiary opacity-30">—</span>}
                                    </td>
                                  ))}
                                  <td className="px-4 py-2.5 text-right font-bold text-text-primary">{row.total.toLocaleString()}</td>
                                </tr>
                              ))}
                              {/* Totals row */}
                              <tr className="bg-surface-secondary/60 font-bold">
                                <td className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-text-tertiary sticky left-0 bg-surface-secondary/60">Totals</td>
                                {parsedSpecies.map(sp => {
                                  const t = prescriptions.reduce((s, r) => s + (r.species[sp] ?? 0), 0);
                                  return <td key={sp} className="px-4 py-2.5 text-right text-text-primary">{t > 0 ? t.toLocaleString() : "—"}</td>;
                                })}
                                <td className="px-4 py-2.5 text-right text-text-primary">
                                  {prescriptions.reduce((s, r) => s + r.total, 0).toLocaleString()}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Saved prescriptions table */}
                    <div className="bg-surface border border-border rounded-xl overflow-hidden">
                      <div className="px-5 py-3 border-b border-border bg-surface-secondary/40 flex items-center justify-between">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                          Saved Prescriptions{savedTargets.length > 0 && ` · ${savedTargets.length} blocks`}
                        </div>
                        <button
                          onClick={() => { setAddingTarget(true); setNewTargetForm({ block: "", prescription: "", treesDelivered: "" }); }}
                          className="text-[11px] font-semibold text-primary hover:underline"
                        >+ Add Block</button>
                      </div>

                      {savedTargets.length === 0 && !addingTarget ? (
                        <div className="px-5 py-8 text-center text-[11px] text-text-tertiary">
                          No prescriptions saved yet. Import from Excel above or add blocks manually.
                        </div>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border bg-surface-secondary/20">
                              <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Block</th>
                              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Prescription</th>
                              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Trees Delivered</th>
                              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Remaining</th>
                              <th className="px-4 py-2.5 w-20" />
                            </tr>
                          </thead>
                          <tbody>
                            {savedTargets.map(t => {
                              const isEditing   = !!editingTargets[t.id];
                              const draft       = editingTargets[t.id];
                              const remaining   = t.prescription > 0 ? t.prescription - (t.treesDelivered ?? 0) : null;
                              const blockRecord = blocks.find(b => b.blockName === t.block);
                              const allocations = blockRecord?.allocations ?? [];
                              return (
                                <tr key={t.id} className="group border-b border-border last:border-0 hover:bg-surface-secondary/20 transition-colors">
                                  {isEditing ? (
                                    <>
                                      <td className="px-4 py-2">
                                        <input
                                          autoFocus
                                          value={draft.block}
                                          onChange={e => setEditingTargets(prev => ({ ...prev, [t.id]: { ...prev[t.id], block: e.target.value } }))}
                                          className="w-full text-xs bg-surface border border-border rounded px-2 py-1 text-text-primary"
                                        />
                                      </td>
                                      <td className="px-4 py-2">
                                        <input
                                          type="number" min={0}
                                          value={draft.prescription}
                                          onChange={e => setEditingTargets(prev => ({ ...prev, [t.id]: { ...prev[t.id], prescription: e.target.value } }))}
                                          className="w-full text-xs bg-surface border border-border rounded px-2 py-1 text-text-primary text-right"
                                        />
                                      </td>
                                      <td className="px-4 py-2">
                                        <input
                                          type="number" min={0}
                                          value={draft.treesDelivered}
                                          onChange={e => setEditingTargets(prev => ({ ...prev, [t.id]: { ...prev[t.id], treesDelivered: e.target.value } }))}
                                          className="w-full text-xs bg-surface border border-border rounded px-2 py-1 text-text-primary text-right"
                                        />
                                      </td>
                                      <td className="px-4 py-2 text-right text-text-tertiary">—</td>
                                      <td className="px-4 py-2 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                          <button
                                            onClick={async () => {
                                              const newBlock = draft.block.trim();
                                              if (!newBlock) return;
                                              const newId = `${selectedProject.name}|${newBlock}`;
                                              // If block name changed, delete old record
                                              if (newId !== t.id) await deleteBlockTarget(t.id);
                                              await saveBlockTarget({
                                                id: newId,
                                                project: selectedProject.name,
                                                block: newBlock,
                                                prescription:   parseInt(draft.prescription, 10)   || 0,
                                                treesDelivered: parseInt(draft.treesDelivered, 10) || 0,
                                              });
                                              setEditingTargets(prev => { const n = { ...prev }; delete n[t.id]; return n; });
                                              reloadTargets();
                                            }}
                                            className="text-[11px] font-semibold text-primary hover:underline"
                                          >Save</button>
                                          <button
                                            onClick={() => setEditingTargets(prev => { const n = { ...prev }; delete n[t.id]; return n; })}
                                            className="text-[11px] text-text-tertiary hover:text-text-primary"
                                          >Cancel</button>
                                        </div>
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="px-4 py-2.5 font-semibold text-text-primary">{t.block}</td>
                                      <td className="px-4 py-2.5 text-right">
                                        <div className="flex flex-col items-end gap-1">
                                          <span className="font-semibold text-text-secondary">
                                            {t.prescription > 0 ? t.prescription.toLocaleString() : <span className="text-text-tertiary">—</span>}
                                          </span>
                                          {allocations.length > 0 && (
                                            <div className="flex flex-wrap gap-1 justify-end">
                                              {allocations.map(a => (
                                                <span key={a.id} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-secondary border border-border text-text-secondary">
                                                  <span className="font-mono font-semibold text-text-primary">{a.species}</span> {a.trees.toLocaleString()}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-4 py-2.5 text-right text-text-secondary">{(t.treesDelivered ?? 0) > 0 ? (t.treesDelivered ?? 0).toLocaleString() : <span className="text-text-tertiary">—</span>}</td>
                                      <td className={`px-4 py-2.5 text-right font-semibold ${remaining === null ? "text-text-tertiary" : remaining > 0 ? "text-text-primary" : "text-red-400"}`}>
                                        {remaining === null ? "—" : remaining > 0 ? remaining.toLocaleString() : `+${Math.abs(remaining).toLocaleString()} over`}
                                      </td>
                                      <td className="px-4 py-2.5 text-right">
                                        <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100">
                                          <button
                                            onClick={() => setEditingTargets(prev => ({ ...prev, [t.id]: { block: t.block, prescription: String(t.prescription), treesDelivered: String(t.treesDelivered ?? 0) } }))}
                                            className="text-[11px] text-primary hover:underline"
                                          >Edit</button>
                                          <button
                                            onClick={async () => { await deleteBlockTarget(t.id); reloadTargets(); }}
                                            className="text-[11px] text-text-tertiary hover:text-red-400 transition-colors"
                                          >✕</button>
                                        </div>
                                      </td>
                                    </>
                                  )}
                                </tr>
                              );
                            })}

                            {/* Add new row */}
                            {addingTarget && (
                              <tr className="border-b border-border bg-primary/5">
                                <td className="px-4 py-2">
                                  <input
                                    autoFocus
                                    placeholder="Block name"
                                    value={newTargetForm.block}
                                    onChange={e => setNewTargetForm(p => ({ ...p, block: e.target.value }))}
                                    className="w-full text-xs bg-surface border border-border rounded px-2 py-1 text-text-primary placeholder-text-tertiary"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="number" min={0}
                                    placeholder="0"
                                    value={newTargetForm.prescription}
                                    onChange={e => setNewTargetForm(p => ({ ...p, prescription: e.target.value }))}
                                    className="w-full text-xs bg-surface border border-border rounded px-2 py-1 text-text-primary text-right"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="number" min={0}
                                    placeholder="0"
                                    value={newTargetForm.treesDelivered}
                                    onChange={e => setNewTargetForm(p => ({ ...p, treesDelivered: e.target.value }))}
                                    className="w-full text-xs bg-surface border border-border rounded px-2 py-1 text-text-primary text-right"
                                  />
                                </td>
                                <td className="px-4 py-2 text-right text-text-tertiary">—</td>
                                <td className="px-4 py-2 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={async () => {
                                        const block = newTargetForm.block.trim();
                                        if (!block) return;
                                        const id = `${selectedProject.name}|${block}`;
                                        await saveBlockTarget({
                                          id,
                                          project:        selectedProject.name,
                                          block,
                                          prescription:   parseInt(newTargetForm.prescription, 10)   || 0,
                                          treesDelivered: parseInt(newTargetForm.treesDelivered, 10) || 0,
                                        });
                                        setAddingTarget(false);
                                        setNewTargetForm({ block: "", prescription: "", treesDelivered: "" });
                                        reloadTargets();
                                      }}
                                      className="text-[11px] font-semibold text-primary hover:underline"
                                    >Save</button>
                                    <button
                                      onClick={() => { setAddingTarget(false); setNewTargetForm({ block: "", prescription: "", treesDelivered: "" }); }}
                                      className="text-[11px] text-text-tertiary hover:text-text-primary"
                                    >Cancel</button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      )}
                    </div>

                  </div>
                </div>
              );
            })()}

            {/* Blocks panel */}
            {viewMode === "blocks" && (() => {
              const mapFiles = selectedProject.files.filter(f => f.category === "map");
              // Blocks not yet linked to any map + blocks linked to maps still present
              const linkedIds = new Set(blocks.map(b => b.mapFileId).filter(Boolean));
              const unmappedMaps = mapFiles.filter(f => !linkedIds.has(f.id));
              const totalAllocated = blocks.reduce((s, b) => s + b.allocations.reduce((ss, a) => ss + a.trees, 0), 0);
              return (
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="max-w-4xl mx-auto space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-text-primary">Blocks</div>
                        <div className="text-[11px] text-text-tertiary mt-0.5">
                          {blocks.length} block{blocks.length !== 1 ? "s" : ""} · {totalAllocated.toLocaleString()} trees allocated
                        </div>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => openNewBlock()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-90 transition-all"
                          style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
                        >
                          + Add Block
                        </button>
                      )}
                    </div>

                    {/* Auto-suggest from unlinked maps (admin/supervisor only) */}
                    {isAdmin && unmappedMaps.length > 0 && (
                      <div className="bg-surface border border-border rounded-xl p-4">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">Maps without blocks</div>
                        <div className="flex flex-wrap gap-2">
                          {unmappedMaps.map(f => (
                            <button
                              key={f.id}
                              onClick={() => openNewBlock(f.id, f.name.replace(/\.[^.]+$/, ""))}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium border border-dashed border-primary/40 rounded-lg text-primary hover:bg-primary/5 transition-colors"
                            >
                              <span className="opacity-60">⬢</span> {f.name.replace(/\.[^.]+$/, "")} <span className="opacity-50">+ Add block</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Block list */}
                    {blocks.length === 0 ? (
                      <div className="border-2 border-dashed border-border rounded-xl p-16 text-center">
                        <div className="text-3xl opacity-15 mb-2">⬡</div>
                        <div className="text-sm font-semibold text-text-secondary">No blocks yet</div>
                        <div className="text-xs text-text-tertiary mt-1">{isAdmin ? "Upload maps first, then add tree allocation data per block" : "Ask an admin to set up blocks for this project."}</div>
                        {isAdmin && (
                          <button onClick={() => openNewBlock()} className="mt-4 text-xs font-medium px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-surface-secondary transition-colors">+ Add Block</button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {blocks.map(b => {
                          const totalTrees = b.allocations.reduce((s, a) => s + a.trees, 0);
                          const calcDensity = b.area && b.density ? Math.round(b.area * b.density) : null;
                          return (
                            <div key={b.id} className="bg-surface border border-border rounded-xl overflow-hidden">
                              {/* Block header */}
                              <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
                                <div className="flex items-center gap-3">
                                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0" style={{ background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" }}>⬡</div>
                                  <div>
                                    <div className="text-xs font-semibold text-text-primary">{b.blockName}</div>
                                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-text-tertiary">
                                      {b.area != null && <span>{b.area} ha</span>}
                                      {b.density != null && <span>{b.density} sph</span>}
                                      {calcDensity && <span className="text-text-tertiary/70">({calcDensity.toLocaleString()} capacity)</span>}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <div className="text-sm font-bold text-text-primary">{totalTrees.toLocaleString()}</div>
                                    <div className="text-[10px] text-text-tertiary">trees allocated</div>
                                  </div>
                                  {b.mapFileId && (() => {
                                    const mapFile = selectedProject.files.find(f => f.id === b.mapFileId);
                                    if (!mapFile?.url) return null;
                                    return (
                                      <button
                                        onClick={() => setMapViewer({ file: mapFile, blockName: b.blockName, projectId: selectedProject.id })}
                                        className="text-[11px] font-medium border rounded-lg px-2.5 py-1.5 transition-colors flex items-center gap-1.5"
                                        style={{ borderColor: "rgba(57,222,139,0.3)", color: "var(--color-primary)", background: "rgba(57,222,139,0.06)" }}
                                        title="View map with live GPS"
                                      >
                                        <span>◎</span> Map
                                      </button>
                                    );
                                  })()}
                                  {isAdmin && (
                                    <>
                                      <button onClick={() => openEditBlock(b)} className="text-[11px] text-text-tertiary hover:text-text-primary border border-border rounded-lg px-2.5 py-1.5 transition-colors">Edit</button>
                                      <button onClick={() => removeBlock(b.id)} className="text-[11px] text-danger hover:bg-red-50 border border-border rounded-lg px-2.5 py-1.5 transition-colors">×</button>
                                    </>
                                  )}
                                </div>
                              </div>
                              {/* Species chips */}
                              {b.allocations.length > 0 && (
                                <div className="px-5 py-3 flex flex-wrap gap-2">
                                  {b.allocations.map(a => (
                                    <div key={a.id} className="bg-surface-secondary border border-border rounded-lg px-3 py-2 min-w-[80px]">
                                      <div className="text-[10px] text-text-tertiary truncate">{a.species}</div>
                                      <div className="text-sm font-bold text-text-primary mt-0.5">{a.trees.toLocaleString()}</div>
                                    </div>
                                  ))}
                                  <div className="rounded-lg px-3 py-2 min-w-[80px]" style={{ background: "rgba(57,222,139,0.08)", border: "1px solid rgba(57,222,139,0.2)" }}>
                                    <div className="text-[10px] font-semibold" style={{ color: "var(--color-primary)" }}>TOTAL</div>
                                    <div className="text-sm font-bold text-text-primary mt-0.5">{totalTrees.toLocaleString()}</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* File area */}
            {viewMode !== "blocks" && projectTab === "files" && <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex-1 overflow-y-auto p-6 transition-all ${isDragging ? "bg-primary/5 ring-2 ring-inset ring-primary/30" : ""}`}
            >
              {isDragging && (
                <div className="fixed inset-0 bg-primary/10 flex items-center justify-center z-10 pointer-events-none">
                  <div className="bg-surface rounded-2xl border-2 border-dashed border-primary px-12 py-8 text-center shadow-xl">
                    <div className="text-3xl mb-2 text-primary opacity-60">↑</div>
                    <div className="text-sm font-semibold text-primary">Drop to upload</div>
                    <div className="text-xs text-text-tertiary mt-1">
                      Category: {CATEGORY_MAP[uploadCategory].label}
                    </div>
                  </div>
                </div>
              )}

              {filteredFiles.length === 0 ? (
                <div
                  className="h-full min-h-64 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 hover:border-primary/40 hover:bg-primary/2 transition-all cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="text-3xl opacity-15">↑</div>
                  <div className="text-sm font-semibold text-text-secondary">
                    {categoryFilter === "all"
                      ? "No files yet"
                      : `No ${CATEGORY_MAP[categoryFilter as FileCategory]?.label ?? categoryFilter}`}
                  </div>
                  <div className="text-xs text-text-tertiary">
                    Click to upload or drag and drop files here
                  </div>
                  <div className="text-[10px] text-text-tertiary">
                    Uploading as:{" "}
                    <span className="font-semibold">{CATEGORY_MAP[uploadCategory].label}</span>
                  </div>
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {filteredFiles.map((file) => {
                    const cat = CATEGORY_MAP[file.category];
                    const color = CATEGORY_COLORS[file.category];
                    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
                    return (
                      <div key={file.id} className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-primary/20 transition-all group">
                        <div
                          className="h-28 bg-surface-secondary flex items-center justify-center cursor-pointer relative"
                          onClick={() => setPreviewFile(file)}
                        >
                          {isImage && file.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-4xl opacity-10">{cat.icon}</span>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                        </div>
                        <div className="p-2.5">
                          <div className="text-[11px] font-medium text-text-primary truncate" title={file.name}>
                            {file.name}
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={color}>
                              {cat.label}
                            </span>
                            <span className="text-[10px] text-text-tertiary">{file.size}</span>
                          </div>
                          <div className="text-[10px] text-text-tertiary mt-0.5">{file.uploadedAt}</div>
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border-light">
                            <button
                              onClick={() => handleDownload(file)}
                              className="flex-1 text-[10px] text-primary hover:underline font-medium"
                            >
                              ↓ Download
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => setDeleteFileTarget({ projectId: selectedProject.id, fileId: file.id })}
                                className="text-[10px] text-danger hover:underline"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Upload tile — admin only */}
                  {isAdmin && (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 min-h-[160px] hover:border-primary/40 hover:bg-primary/3 transition-all cursor-pointer group"
                    >
                      <span className="text-2xl opacity-15 group-hover:opacity-30 transition-opacity">+</span>
                      <span className="text-[11px] font-medium text-text-tertiary group-hover:text-primary transition-colors">
                        Add Files
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface-secondary">
                        {["File Name", "Category", "Size", "Uploaded", ""].map((h) => (
                          <th key={h} className="text-left px-4 py-2.5 font-semibold text-text-tertiary uppercase tracking-wide text-[10px]">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light">
                      {filteredFiles.map((file) => {
                        const cat = CATEGORY_MAP[file.category];
                        const color = CATEGORY_COLORS[file.category];
                        return (
                          <tr key={file.id} className="hover:bg-surface-secondary transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <span className="text-base opacity-30">{cat.icon}</span>
                                <button
                                  onClick={() => setPreviewFile(file)}
                                  className="font-medium text-text-primary hover:text-primary transition-colors truncate max-w-xs"
                                >
                                  {file.name}
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold" style={color}>
                                {cat.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-text-secondary">{file.size}</td>
                            <td className="px-4 py-3 text-text-secondary">{file.uploadedAt}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => handleDownload(file)} className="text-[11px] text-primary hover:underline font-medium">↓ Download</button>
                                {isAdmin && (
                                  <>
                                    <span className="text-border">|</span>
                                    <button onClick={() => setDeleteFileTarget({ projectId: selectedProject.id, fileId: file.id })} className="text-[11px] text-danger hover:underline">Remove</button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>}
          </>
        )}
      </div>

      {/* ── Modals ── */}

      {/* Add / Edit Block */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="text-sm font-semibold text-text-primary">{editingBlock ? "Edit Block" : "Add Block"}</div>
              <button onClick={() => setShowBlockModal(false)} className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Block name */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-1.5">Block Name *</label>
                <input
                  autoFocus
                  value={blockForm.blockName}
                  onChange={e => setBlockForm(f => ({ ...f, blockName: e.target.value }))}
                  placeholder="e.g. Block 3A"
                  className={fieldCls}
                />
              </div>
              {/* Area + density */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-1.5">Area (ha)</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={blockForm.area}
                    onChange={e => setBlockForm(f => ({ ...f, area: e.target.value }))}
                    placeholder="e.g. 12.5"
                    className={fieldCls}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-1.5">Density (sph)</label>
                  <input
                    type="number" min="0" step="1"
                    value={blockForm.density}
                    onChange={e => setBlockForm(f => ({ ...f, density: e.target.value }))}
                    placeholder="e.g. 1600"
                    className={fieldCls}
                  />
                </div>
              </div>
              {/* Capacity preview */}
              {blockForm.area && blockForm.density && (
                <div className="text-[11px] text-text-tertiary px-1">
                  Capacity: <span className="font-semibold text-text-primary">
                    {(Number(blockForm.area) * Number(blockForm.density)).toLocaleString()}
                  </span> trees
                </div>
              )}
              {/* Species allocations */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Tree Allocations by Species</label>
                  <button
                    onClick={() => setBlockForm(f => ({ ...f, allocations: [...f.allocations, { id: crypto.randomUUID(), species: "", trees: "" }] }))}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >+ Add species</button>
                </div>
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_100px_28px] gap-2 mb-1.5 px-1">
                  <div className="text-[10px] text-text-tertiary">Species</div>
                  <div className="text-[10px] text-text-tertiary text-center">Quantity</div>
                  <div />
                </div>
                <div className="space-y-2">
                  {blockForm.allocations.map((alloc, idx) => {
                    const color = SPECIES_PALETTE[idx % SPECIES_PALETTE.length];
                    return (
                      <div key={alloc.id} className="grid grid-cols-[1fr_100px_28px] gap-2 items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
                          <input
                            value={alloc.species}
                            onChange={e => setBlockForm(f => ({
                              ...f,
                              allocations: f.allocations.map(a => a.id === alloc.id ? { ...a, species: e.target.value } : a),
                            }))}
                            placeholder="e.g. Black Spruce"
                            className={fieldCls}
                          />
                        </div>
                        <input
                          type="number" min="0"
                          value={alloc.trees}
                          onChange={e => setBlockForm(f => ({
                            ...f,
                            allocations: f.allocations.map(a => a.id === alloc.id ? { ...a, trees: e.target.value } : a),
                          }))}
                          placeholder="0"
                          className={`${fieldCls} text-center`}
                        />
                        <button
                          onClick={() => setBlockForm(f => ({ ...f, allocations: f.allocations.filter(a => a.id !== alloc.id) }))}
                          disabled={blockForm.allocations.length === 1}
                          className="text-text-tertiary hover:text-danger transition-colors text-sm text-center disabled:opacity-20 disabled:cursor-not-allowed"
                        >×</button>
                      </div>
                    );
                  })}
                </div>
                {/* Total row */}
                <div className="mt-3 grid grid-cols-[1fr_100px_28px] gap-2 border-t border-border pt-3">
                  <div className="text-[11px] font-semibold text-text-secondary pl-4">Total</div>
                  <div className="text-[13px] font-bold text-text-primary text-center">
                    {blockForm.allocations.reduce((s, a) => s + (Number(a.trees) || 0), 0).toLocaleString()}
                  </div>
                  <div />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
              <button onClick={() => setShowBlockModal(false)} className="px-4 py-2 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors">Cancel</button>
              <button
                onClick={saveBlock}
                disabled={!blockForm.blockName.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
              >
                {editingBlock ? "Save Changes" : "Add Block"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Nursery Load */}
      {showNurseryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-3xl flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="text-sm font-semibold text-text-primary">{editingLoad ? "Edit Nursery Load" : "Schedule Nursery Load"}</div>
              <button onClick={() => setShowNurseryModal(false)} className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-6">

              {/* ── Load details ── */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">Load Details</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-medium text-text-tertiary mb-1.5">Load Date *</label>
                    <input type="date" value={nurseryForm.loadDate}
                      onChange={e => setNurseryForm(f => ({ ...f, loadDate: e.target.value }))}
                      className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-text-tertiary mb-1.5">Delivery Date</label>
                    <input type="date" value={nurseryForm.deliveryDate}
                      onChange={e => setNurseryForm(f => ({ ...f, deliveryDate: e.target.value }))}
                      className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-text-tertiary mb-1.5">Nursery Name</label>
                    <input type="text" value={nurseryForm.nurseryName} placeholder="e.g. Morsbags Nursery"
                      onChange={e => setNurseryForm(f => ({ ...f, nurseryName: e.target.value }))}
                      className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-text-tertiary mb-1.5">Driver</label>
                    <input type="text" value={nurseryForm.driver} placeholder="Driver name"
                      onChange={e => setNurseryForm(f => ({ ...f, driver: e.target.value }))}
                      className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-text-tertiary mb-1.5">Status</label>
                    <select value={nurseryForm.status}
                      onChange={e => setNurseryForm(f => ({ ...f, status: e.target.value as NurseryLoadStatus }))}
                      className={fieldCls}>
                      <option value="scheduled">Scheduled</option>
                      <option value="in-transit">In Transit</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-text-tertiary mb-1.5">Notes</label>
                    <input type="text" value={nurseryForm.notes} placeholder="Optional notes"
                      onChange={e => setNurseryForm(f => ({ ...f, notes: e.target.value }))}
                      className={fieldCls} />
                  </div>
                </div>
              </div>

              {/* ── Species lines ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Species &amp; Quantities</div>
                  <button
                    onClick={() => setNurseryForm(f => ({
                      ...f,
                      species: [...f.species, { id: crypto.randomUUID(), species: "", treesPerBox: "", numberOfBoxes: "" }],
                    }))}
                    className="text-[11px] font-medium text-primary hover:underline">
                    + Add species
                  </button>
                </div>
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_90px_90px_28px] gap-2 mb-1.5 px-1">
                  <div className="text-[10px] text-text-tertiary">Species</div>
                  <div className="text-[10px] text-text-tertiary text-center">Trees/box</div>
                  <div className="text-[10px] text-text-tertiary text-center">Boxes</div>
                  <div />
                </div>
                <div className="space-y-2">
                  {nurseryForm.species.map((sp, idx) => {
                    const color = SPECIES_PALETTE[idx % SPECIES_PALETTE.length];
                    const subtotal = (Number(sp.treesPerBox) || 0) * (Number(sp.numberOfBoxes) || 0);
                    return (
                      <div key={sp.id} className="grid grid-cols-[1fr_90px_90px_28px] gap-2 items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
                          <input type="text" value={sp.species} placeholder="e.g. Black Spruce"
                            onChange={e => setNurseryForm(f => ({
                              ...f,
                              species: f.species.map(s => s.id === sp.id ? { ...s, species: e.target.value } : s),
                            }))}
                            className={fieldCls} />
                        </div>
                        <input type="number" min="0" value={sp.treesPerBox} placeholder="0"
                          onChange={e => setNurseryForm(f => ({
                            ...f,
                            species: f.species.map(s => s.id === sp.id ? { ...s, treesPerBox: e.target.value } : s),
                          }))}
                          className={`${fieldCls} text-center`} />
                        <div className="relative">
                          <input type="number" min="0" value={sp.numberOfBoxes} placeholder="0"
                            onChange={e => setNurseryForm(f => ({
                              ...f,
                              species: f.species.map(s => s.id === sp.id ? { ...s, numberOfBoxes: e.target.value } : s),
                            }))}
                            className={`${fieldCls} text-center`} />
                          {subtotal > 0 && (
                            <div className="absolute -bottom-4 left-0 right-0 text-center text-[9px] text-text-tertiary">
                              {subtotal.toLocaleString()} trees
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            if (nurseryForm.species.length === 1) return;
                            setNurseryForm(f => ({ ...f, species: f.species.filter(s => s.id !== sp.id) }));
                          }}
                          className="text-text-tertiary hover:text-danger transition-colors text-sm text-center"
                          disabled={nurseryForm.species.length === 1}>
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
                {/* Grand total */}
                {nurseryForm.species.some(s => Number(s.numberOfBoxes) > 0) && (
                  <div className="mt-5 flex items-center justify-end gap-4 text-xs text-text-tertiary border-t border-border pt-3">
                    <span>{nurseryForm.species.reduce((s, sp) => s + (Number(sp.numberOfBoxes) || 0), 0)} boxes</span>
                    <span className="font-semibold text-text-primary">
                      {nurseryForm.species.reduce((s, sp) => s + (Number(sp.treesPerBox) || 0) * (Number(sp.numberOfBoxes) || 0), 0).toLocaleString()} trees
                    </span>
                  </div>
                )}
              </div>

              {/* ── Trailer diagram ── */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">Load Diagram — 53-ft Trailer</div>

                {/* Painter controls */}
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <div className="text-[10px] text-text-tertiary shrink-0">Paint with:</div>
                  <div className="flex flex-wrap gap-2 flex-1">
                    {nurseryForm.species.filter(s => s.species.trim()).map((sp, idx) => {
                      const color = SPECIES_PALETTE[idx % SPECIES_PALETTE.length];
                      const active = !isErasing && paintSpecies === sp.id;
                      return (
                        <button key={sp.id}
                          onClick={() => { setPaintSpecies(sp.id); setIsErasing(false); }}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all"
                          style={active
                            ? { background: color, color: "#fff", borderColor: color }
                            : { borderColor: color, color, background: `${color}18` }
                          }>
                          <div className="w-2 h-2 rounded-sm" style={{ background: active ? "#fff" : color }} />
                          {sp.species}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setIsErasing(e => !e)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all shrink-0"
                    style={isErasing
                      ? { background: "var(--color-danger)", color: "#fff", borderColor: "var(--color-danger)" }
                      : { borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }
                    }>
                    ✕ Erase
                  </button>
                  <button
                    onClick={() => setNurseryForm(f => ({ ...f, diagram: emptyDiagram() }))}
                    className="text-[11px] text-text-tertiary hover:text-danger transition-colors shrink-0">
                    Clear all
                  </button>
                </div>

                {/* Trailer grid */}
                {(() => {
                  const spColorMap = Object.fromEntries(
                    nurseryForm.species.map((sp, i) => [sp.id, SPECIES_PALETTE[i % SPECIES_PALETTE.length]])
                  );
                  const spNameMap = Object.fromEntries(
                    nurseryForm.species.map(sp => [sp.id, sp.species])
                  );
                  return (
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[9px] text-text-tertiary w-8 text-right shrink-0">FRONT ▶</span>
                        <div className="flex-1" />
                        <span className="text-[9px] text-text-tertiary">◀ REAR DOORS</span>
                      </div>
                      <div className="border border-border rounded-lg overflow-hidden bg-surface-secondary select-none"
                        style={{ cursor: isErasing ? "cell" : (paintSpecies ? "crosshair" : "default") }}>
                        {Array.from({ length: TRAILER_ROWS }).map((_, row) => (
                          <div key={row} className={`flex ${row === 0 ? "border-b border-border/50" : ""}`}>
                            <div className="w-8 shrink-0 flex items-center justify-center text-[9px] text-text-tertiary font-medium border-r border-border/50 bg-surface">
                              {row === 0 ? "L" : "R"}
                            </div>
                            <div className="flex flex-1">
                              {Array.from({ length: TRAILER_COLS }).map((_, col) => {
                                const idx = row * TRAILER_COLS + col;
                                const spId = nurseryForm.diagram[idx];
                                const bg = spId ? spColorMap[spId] : undefined;
                                return (
                                  <div key={col}
                                    className="flex-1 h-9 border-r border-border/20 last:border-r-0 flex items-center justify-center transition-colors hover:opacity-80"
                                    style={{ background: bg ?? "transparent" }}
                                    onMouseDown={() => paintCell(idx)}
                                    onMouseEnter={(e) => { if (e.buttons === 1) paintCell(idx); }}
                                    title={spId ? spNameMap[spId] : `R${row + 1}C${col + 1}`}
                                  >
                                    {spId && (
                                      <span className="text-[7px] font-bold text-white/90 leading-none pointer-events-none">
                                        {spNameMap[spId]?.slice(0, 2).toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[9px] text-text-tertiary px-8">
                        <span>Col 1</span><span>Col {TRAILER_COLS}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Cell count summary */}
                {nurseryForm.species.filter(s => s.species.trim()).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {nurseryForm.species.filter(s => s.species.trim()).map((sp, idx) => {
                      const count = nurseryForm.diagram.filter(c => c === sp.id).length;
                      if (count === 0) return null;
                      return (
                        <div key={sp.id} className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: SPECIES_PALETTE[idx % SPECIES_PALETTE.length] }} />
                          {sp.species}: <span className="font-semibold text-text-primary">{count} cells</span>
                        </div>
                      );
                    })}
                    <div className="text-[11px] text-text-tertiary">
                      {TOTAL_CELLS - nurseryForm.diagram.filter(Boolean).length} empty
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
              <button onClick={() => setShowNurseryModal(false)} className="px-4 py-2 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors">Cancel</button>
              <button
                onClick={saveLoad}
                disabled={!nurseryForm.loadDate}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                {editingLoad ? "Save Changes" : "Schedule Load"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New / Edit Project */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="text-sm font-semibold text-text-primary">
                {editProject ? "Edit Project" : "New Project"}
              </div>
              <button onClick={() => setShowProjectModal(false)} className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Project Name *</label>
                <input
                  value={projectForm.name}
                  onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                  placeholder="e.g. Block 22 – Nipigon 2026"
                  className={fieldCls}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Location / Site</label>
                <input
                  value={projectForm.location}
                  onChange={(e) => setProjectForm({ ...projectForm, location: e.target.value })}
                  placeholder="e.g. Nipigon, ON"
                  className={fieldCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Season / Year</label>
                  <input
                    value={projectForm.season}
                    onChange={(e) => setProjectForm({ ...projectForm, season: e.target.value })}
                    placeholder="2026"
                    className={fieldCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Status</label>
                  <select
                    value={projectForm.status}
                    onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value as ProjectStatus })}
                    className={fieldCls}
                  >
                    <option value="active">Active</option>
                    <option value="tendering">Tendering</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <button onClick={() => setShowProjectModal(false)} className="px-4 py-2 text-xs font-medium border border-border rounded-lg text-text-secondary hover:bg-surface-secondary transition-colors">
                Cancel
              </button>
              <button
                onClick={handleProjectSubmit}
                disabled={!projectForm.name.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-40 disabled:pointer-events-none" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
              >
                {editProject ? "Save Changes" : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload confirm / categorise */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="text-sm font-semibold text-text-primary">Confirm Upload</div>
              <button
                onClick={() => { setShowUploadModal(false); setPendingFiles([]); }}
                className="text-text-tertiary hover:text-text-primary text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-3 max-h-72 overflow-y-auto">
              {pendingFiles.map((pf, i) => (
                <div key={i} className="flex items-center gap-3 bg-surface-secondary rounded-lg px-3 py-2.5">
                  <span className="text-base opacity-30">{CATEGORY_MAP[pf.category].icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-text-primary truncate">{pf.file.name}</div>
                    <div className="text-[10px] text-text-tertiary">{formatBytes(pf.file.size)}</div>
                  </div>
                  <select
                    value={pf.category}
                    onChange={(e) => {
                      const cat = e.target.value as FileCategory;
                      setPendingFiles((prev) => prev.map((x, j) => j === i ? { ...x, category: cat } : x));
                    }}
                    className="text-[11px] border border-border rounded px-1.5 py-1 bg-surface text-text-secondary focus:outline-none"
                  >
                    {FILE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <button
                onClick={() => { setShowUploadModal(false); setPendingFiles([]); }}
                className="px-4 py-2 text-xs font-medium border border-border rounded-lg text-text-secondary hover:bg-surface-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmUpload}
                disabled={uploading}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-60" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
              >
                {uploading ? "Saving…" : `↑ Save ${pendingFiles.length} File${pendingFiles.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File preview */}
      {previewFile && previewFile.url && (
        <FilePreviewModal
          url={previewFile.url}
          name={previewFile.name}
          onClose={() => setPreviewFile(null)}
        />
      )}

      {/* Block map viewer with live GPS */}
      {mapViewer && (
        <BlockMapViewer
          url={mapViewer.file.url}
          name={mapViewer.file.name}
          blockName={mapViewer.blockName}
          projectId={mapViewer.projectId}
          fileId={mapViewer.file.id}
          onClose={() => setMapViewer(null)}
        />
      )}

      {/* Delete project confirm */}
      {deleteProjectId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="text-sm font-semibold text-text-primary mb-2">Delete Project</div>
            <div className="text-xs text-text-secondary mb-5">
              This will permanently delete{" "}
              <span className="font-semibold text-text-primary">
                {projects.find((p) => p.id === deleteProjectId)?.name}
              </span>{" "}
              and all its stored files. This cannot be undone.
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteProjectId(null)} className="px-4 py-2 text-xs font-medium border border-border rounded-lg text-text-secondary hover:bg-surface-secondary transition-colors">Cancel</button>
              <button onClick={handleDeleteProject} className="px-4 py-2 text-xs font-medium bg-danger text-white rounded-lg hover:bg-red-600 transition-colors">Delete Project</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete file confirm */}
      {deleteFileTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="text-sm font-semibold text-text-primary mb-2">Remove File</div>
            <div className="text-xs text-text-secondary mb-5">Remove this file from the project? This cannot be undone.</div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteFileTarget(null)} className="px-4 py-2 text-xs font-medium border border-border rounded-lg text-text-secondary hover:bg-surface-secondary transition-colors">Cancel</button>
              <button onClick={handleDeleteFile} className="px-4 py-2 text-xs font-medium bg-danger text-white rounded-lg hover:bg-red-600 transition-colors">Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 text-white text-xs font-medium px-4 py-3 rounded-xl shadow-lg transition-opacity ${toast.type === "success" ? "bg-success" : "bg-danger"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
