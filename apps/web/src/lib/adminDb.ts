/**
 * IndexedDB persistence layer for the Admin Console.
 *
 * Object stores
 * ─────────────
 * "projects"  – project metadata + file metadata array (no blobs)
 * "files"     – raw Blob for each uploaded file, keyed by file id
 */

const DB_NAME = "integrity-admin";
const DB_VERSION = 21;

export type ProjectStatus = "active" | "tendering" | "completed" | "archived";

export type DocCategory =
  | "agreement"
  | "waiver"
  | "health-safety"
  | "receipt"
  | "tax"
  | "cvor"
  | "driver-log"
  | "other";

export type DocStatus = "signed" | "pending" | "expired" | "draft";

export interface StoredDocument {
  id: string;
  name: string;
  category: DocCategory;
  employee: string;
  dateAdded: string;
  status: DocStatus;
  size: string;
  hasFile: boolean;
}

export type FileCategory =
  | "map"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "tender"
  | "site-plan"
  | "site-assessment"
  | "quality-report"
  | "nursery-slip";

export interface StoredFileMeta {
  id: string;
  name: string;
  category: FileCategory;
  size: string;
  uploadedAt: string;
}

export interface StoredProject {
  id: string;
  name: string;
  location: string;
  season: string;
  status: ProjectStatus;
  createdAt: string;
  files: StoredFileMeta[];
}

// ── Internal: open (and migrate) the database ──────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("projects")) {
        db.createObjectStore("projects", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("files")) {
        const store = db.createObjectStore("files", { keyPath: "id" });
        store.createIndex("projectId", "projectId", { unique: false });
      }
      if (!db.objectStoreNames.contains("documents")) {
        db.createObjectStore("documents", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("docFiles")) {
        db.createObjectStore("docFiles", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("assets")) {
        db.createObjectStore("assets", { keyPath: "id" });
      }
      // v4 stores
      const v4stores = [
        "training_certs", "training_guide_meta", "training_guide_blobs",
        "training_cvor", "training_logs",
        "compliance_items", "compliance_forms", "compliance_form_blobs",
        "transactions", "signature_requests", "camps",
      ];
      for (const name of v4stores) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "id" });
        }
      }
      // v5 stores
      const v5stores = ["production_entries", "species_rates"];
      for (const name of v5stores) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "id" });
        }
      }
      // v6 stores
      if (!db.objectStoreNames.contains("session_drafts")) {
        db.createObjectStore("session_drafts", { keyPath: "id" });
      }
      // v7 stores
      const v7stores = ["payroll_stubs", "payroll_tax", "payroll_runs", "media_files", "media_blobs"];
      for (const name of v7stores) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "id" });
        }
      }
      // v8 stores
      if (!db.objectStoreNames.contains("employees")) {
        db.createObjectStore("employees", { keyPath: "id" });
      }
      // v9 stores
      if (!db.objectStoreNames.contains("project_blocks")) {
        db.createObjectStore("project_blocks", { keyPath: "id" });
      }
      // v10 stores
      if (!db.objectStoreNames.contains("nursery_loads")) {
        db.createObjectStore("nursery_loads", { keyPath: "id" });
      }
      // v11 stores
      if (!db.objectStoreNames.contains("supervisor_deliveries")) {
        db.createObjectStore("supervisor_deliveries", { keyPath: "id" });
      }
      // v12 stores
      if (!db.objectStoreNames.contains("tree_orders")) {
        db.createObjectStore("tree_orders", { keyPath: "id" });
      }
      // v13 stores
      if (!db.objectStoreNames.contains("upcoming_block_plans")) {
        db.createObjectStore("upcoming_block_plans", { keyPath: "id" });
      }
      // v14 stores
      if (!db.objectStoreNames.contains("tree_transfers")) {
        db.createObjectStore("tree_transfers", { keyPath: "id" });
      }
      // v15 stores
      if (!db.objectStoreNames.contains("delivery_plans")) {
        db.createObjectStore("delivery_plans", { keyPath: "id" });
      }
      // v16 stores
      if (!db.objectStoreNames.contains("receipts")) {
        db.createObjectStore("receipts", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("receipt_images")) {
        db.createObjectStore("receipt_images", { keyPath: "id" });
      }
      // v17 stores
      if (!db.objectStoreNames.contains("block_adjustments")) {
        db.createObjectStore("block_adjustments", { keyPath: "id" });
      }
      // v18 stores
      if (!db.objectStoreNames.contains("block_targets")) {
        db.createObjectStore("block_targets", { keyPath: "id" });
      }
      // v19: (superseded — no-op)
      // v20: (superseded — no-op)
      // v21: remove any duplicate emp-seed-030+ records and insert the 8 employees
      //      who were missing from the original 55-person import
      if ((e as IDBVersionChangeEvent).oldVersion < 21 && db.objectStoreNames.contains("employees")) {
        const empStore = (e.target as IDBOpenDBRequest).transaction!.objectStore("employees");
        // Clean up any emp-seed-030 to emp-seed-063 that earlier versions may have written
        for (let i = 30; i <= 63; i++) {
          empStore.delete(`emp-seed-${String(i).padStart(3, "0")}`);
        }
        // Insert the 8 employees not covered by the original import
        const v20Employees = [
          { id: "s26-056", name: "Brendan Donald McKenzie", role: "Tree Planter", department: "Field Operations", email: "brendanmckenzie95@gmail.com", phone: "2896962991", status: "active", startDate: "2026-05-01", avatar: "BM", city: "St. Catharines", province: "ON", crewBoss: "Jolissa Lonsberry", sin: "529876583", dlClass: "", firstAid: "No", emergencyContactName: "Tafean Williston", emergencyContactPhone: "2896962991", emergencyContactEmail: "", bankName: "Tangerine", bankInstitutionNumber: "614", bankTransitNumber: "00152", bankAccountNumber: "4016978907", streetAddress: "111 Fourth Ave #12" },
          { id: "s26-057", name: "Benjamin Richard Leigh Ruben Mitchell", role: "Tree Planter", department: "Field Operations", email: "footballben02@gmail.com", phone: "3439989232", status: "active", startDate: "2026-05-01", avatar: "BM", city: "Carleton Place", province: "ON", crewBoss: "Jolissa Lonsberry", sin: "566602470", dlClass: "G2", firstAid: "No", emergencyContactName: "Melissa Mitchell", emergencyContactPhone: "6132579232", emergencyContactEmail: "missym_8@hotmail.com", bankName: "Royal Bank of Canada", bankInstitutionNumber: "003", bankTransitNumber: "00842", bankAccountNumber: "5098215", streetAddress: "124 William Street" },
          { id: "s26-058", name: "James Stephen Samhaber", role: "Tree Planter", department: "Field Operations", email: "james.samhaber@gmail.com", phone: "6137255987", status: "active", startDate: "2026-05-01", avatar: "JS", city: "Ottawa", province: "ON", crewBoss: "Adam Deruyte", sin: "533074936", dlClass: "G", firstAid: "No", emergencyContactName: "Bruce Samhaber", emergencyContactPhone: "6132976961", emergencyContactEmail: "Bruce.samhaber@gmail.com", bankName: "Scotiabank", bankInstitutionNumber: "002", bankTransitNumber: "20396", bankAccountNumber: "0279927", streetAddress: "112 Kenora Street" },
          { id: "s26-059", name: "Matthew Byrne Colas", role: "Tree Planter", department: "Field Operations", email: "matthewcolas777@gmail.com", phone: "6479695268", status: "active", startDate: "2026-05-01", avatar: "MC", city: "Mississauga", province: "ON", crewBoss: "Richard Jackson Gattesco", sin: "551437353", dlClass: "G", firstAid: "No", emergencyContactName: "Rosemary Colas", emergencyContactPhone: "4169045268", emergencyContactEmail: "roseandalexcolas@gmail.com", bankName: "Wealthsimple", bankInstitutionNumber: "703", bankTransitNumber: "00001", bankAccountNumber: "31260821", streetAddress: "448 Aqua Drive" },
          { id: "s26-060", name: "Mouhamadoul Moustapha Ndoye", role: "Tree Planter", department: "Field Operations", email: "moustaphandoye737@gmail.com", phone: "2638812093", status: "active", startDate: "2026-05-01", avatar: "MN", city: "Gatineau", province: "QC", crewBoss: "Richard Jackson Gattesco", sin: "969205913", dlClass: "", firstAid: "No", emergencyContactName: "Abdoul Aziz Lam", emergencyContactPhone: "3435532104", emergencyContactEmail: "Axiloc2003@gmail.com", bankName: "Desjardins", bankInstitutionNumber: "829", bankTransitNumber: "00107", bankAccountNumber: "0619213", streetAddress: "A-18 Rue Demontigny" },
          { id: "s26-061", name: "Noah Doell", role: "Tree Planter", department: "Field Operations", email: "noahdoell041@gmail.com", phone: "6132502743", status: "active", startDate: "2026-05-01", avatar: "ND", city: "Peterborough", province: "ON", crewBoss: "Jolissa Lonsberry", sin: "599315157", dlClass: "G", firstAid: "No", emergencyContactName: "Carley Doell", emergencyContactPhone: "6138594881", emergencyContactEmail: "cdoell44@gmail.com", bankName: "RBC", bankInstitutionNumber: "003", bankTransitNumber: "01672", bankAccountNumber: "5185707", streetAddress: "28A Springbrook Drive" },
          { id: "s26-062", name: "Real Bain", role: "Tree Planter", department: "Field Operations", email: "rayraybain001@gmail.com", phone: "6477248941", status: "active", startDate: "2026-05-01", avatar: "RB", city: "Toronto", province: "ON", crewBoss: "Richard Jackson Gattesco", sin: "552450926", dlClass: "", firstAid: "No", emergencyContactName: "Nancy Patel", emergencyContactPhone: "6476808784", emergencyContactEmail: "Onsitehealth@rogers.com", bankName: "RBC", bankInstitutionNumber: "003", bankTransitNumber: "06352", bankAccountNumber: "5094370", streetAddress: "225 Gladstone Avenue" },
          { id: "s26-063", name: "Sebastian Candela", role: "Tree Planter", department: "Field Operations", email: "sebicand@gmail.com", phone: "6138934636", status: "active", startDate: "2026-05-01", avatar: "SC", city: "Kingston", province: "ON", crewBoss: "Jolissa Lonsberry", sin: "569796881", dlClass: "G", firstAid: "No", emergencyContactName: "Rudy Candela", emergencyContactPhone: "6135442658", emergencyContactEmail: "candelar@limestone.on.ca", bankName: "TD Bank", bankInstitutionNumber: "004", bankTransitNumber: "01392", bankAccountNumber: "6710220", streetAddress: "46 Mowat Ave" },
        ];
        for (const emp of v20Employees) {
          empStore.put(emp);
        }
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(
  db: IDBDatabase,
  stores: string | string[],
  mode: IDBTransactionMode = "readonly"
): IDBTransaction {
  return db.transaction(stores, mode);
}

function put<T>(store: IDBObjectStore, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = store.put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function del(store: IDBObjectStore, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function getAll<T>(store: IDBObjectStore): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

function getOne<T>(store: IDBObjectStore, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function getByIndex<T>(index: IDBIndex, value: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = index.getAll(value);
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Load all projects (metadata only – no blobs). */
export async function getAllProjects(): Promise<StoredProject[]> {
  const db = await openDb();
  const store = tx(db, "projects").objectStore("projects");
  const projects = await getAll<StoredProject>(store);
  db.close();
  return projects.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Create or update a project record (upsert). */
export async function saveProject(project: StoredProject): Promise<void> {
  const db = await openDb();
  const store = tx(db, "projects", "readwrite").objectStore("projects");
  await put(store, project);
  db.close();
}

/** Delete a project and all its associated file blobs. */
export async function deleteProject(projectId: string): Promise<void> {
  const db = await openDb();

  // Delete all blobs for this project
  const filesTx = tx(db, "files", "readwrite");
  const filesStore = filesTx.objectStore("files");
  const index = filesStore.index("projectId");
  const blobs = await getByIndex<{ id: string }>(index, projectId);
  await Promise.all(blobs.map((b) => del(filesStore, b.id)));

  // Delete the project record
  const projTx = tx(db, "projects", "readwrite");
  await del(projTx.objectStore("projects"), projectId);

  db.close();
}

/** Save a file blob (linked to a project). */
export async function saveFileBlob(
  fileId: string,
  projectId: string,
  blob: Blob
): Promise<void> {
  const db = await openDb();
  const store = tx(db, "files", "readwrite").objectStore("files");
  await put(store, { id: fileId, projectId, blob });
  db.close();
}

/** Retrieve a file blob and return a temporary object URL. Caller owns the URL. */
export async function getFileObjectUrl(fileId: string): Promise<string | null> {
  const db = await openDb();
  const store = tx(db, "files").objectStore("files");
  const record = await getOne<{ id: string; blob: Blob }>(store, fileId);
  db.close();
  if (!record) return null;
  return URL.createObjectURL(record.blob);
}

/** Delete a single file blob. */
export async function deleteFileBlob(fileId: string): Promise<void> {
  const db = await openDb();
  const store = tx(db, "files", "readwrite").objectStore("files");
  await del(store, fileId);
  db.close();
}

// ── Document Center ─────────────────────────────────────────────────────────

/** Load all documents (metadata only). */
export async function getAllDocuments(): Promise<StoredDocument[]> {
  const db = await openDb();
  const store = tx(db, "documents").objectStore("documents");
  const docs = await getAll<StoredDocument>(store);
  db.close();
  return docs.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
}

/** Create or update a document record. */
export async function saveDocument(doc: StoredDocument): Promise<void> {
  const db = await openDb();
  const store = tx(db, "documents", "readwrite").objectStore("documents");
  await put(store, doc);
  db.close();
}

/** Delete a document record and its file blob. */
export async function deleteDocument(docId: string): Promise<void> {
  const db = await openDb();
  const docTx = tx(db, "documents", "readwrite");
  await del(docTx.objectStore("documents"), docId);
  const fileTx = tx(db, "docFiles", "readwrite");
  await del(fileTx.objectStore("docFiles"), docId);
  db.close();
}

/** Save a document file blob (keyed by document id). */
export async function saveDocumentBlob(docId: string, blob: Blob): Promise<void> {
  const db = await openDb();
  const store = tx(db, "docFiles", "readwrite").objectStore("docFiles");
  await put(store, { id: docId, blob });
  db.close();
}

/** Retrieve a document blob as a temporary object URL. Caller owns the URL. */
export async function getDocumentObjectUrl(docId: string): Promise<string | null> {
  const db = await openDb();
  const store = tx(db, "docFiles").objectStore("docFiles");
  const record = await getOne<{ id: string; blob: Blob }>(store, docId);
  db.close();
  if (!record) return null;
  return URL.createObjectURL(record.blob);
}

/** Retrieve a document blob as a raw Blob. */
export async function getDocumentBlob(docId: string): Promise<{ blob: Blob; type: string } | null> {
  const db = await openDb();
  const store = tx(db, "docFiles").objectStore("docFiles");
  const record = await getOne<{ id: string; blob: Blob }>(store, docId);
  db.close();
  if (!record) return null;
  return { blob: record.blob, type: record.blob.type || "application/pdf" };
}

// ── Assets ───────────────────────────────────────────────────────────────────

export type AssetType = "vehicle" | "trailer" | "equipment" | "other";
export type AssetStatus = "operational" | "maintenance" | "out-of-service" | "sold";
export type InspectionStatus = "current" | "due-soon" | "overdue" | "n/a";

export interface MaintenanceRecord {
  id: string;
  date: string;
  type: string;
  description: string;
  cost: number;
  odometer?: number;
  provider?: string;
  nextDueDate?: string;
  nextDueOdometer?: number;
}

export interface StoredAsset {
  id: string;
  name: string;
  type: AssetType;
  make: string;
  model: string;
  year: number;
  vin?: string;
  licensePlate?: string;
  color?: string;
  purchasePrice: number;
  purchaseDate: string;
  depreciationRate: number; // annual %, e.g. 0.20
  grossWeight?: string;
  hitchSize?: string;
  towCapacity?: string;
  status: AssetStatus;
  location?: string;
  assignedTo?: string;
  notes?: string;
  lastSafetyInspection?: string;
  nextSafetyInspection?: string;
  inspectionStatus: InspectionStatus;
  maintenanceRecords: MaintenanceRecord[];
  // Extended fields
  fuelType?: string;
  numAxles?: number;
  insuranceStatus?: string;
  ownershipStatus?: string;
  permitNumber?: string;
  subCategory?: string; // "cargo" | "flatdeck" | "dump" | "utility" | "camper" | "atv" | "utv" | "excavator" | "pickup"
}

const SEED_ASSETS: StoredAsset[] = [
  // ── TRAILERS ──────────────────────────────────────────────────────────────
  { id:"asset-seed-01", name:"Kitchen Trailer", type:"trailer", make:"Haul-About", model:"LLC Cargo", year:2022, vin:"7P6500N21N1007685", licensePlate:"X1743P", permitNumber:"M8664703", grossWeight:"4717kg", hitchSize:'2" 5/16 Ball and Coupler', numAxles:2, fuelType:"N/A", insuranceStatus:"Collision", ownershipStatus:"Company Owned", subCategory:"cargo", purchasePrice:0, purchaseDate:"2022-01-01", depreciationRate:0.15, status:"operational", inspectionStatus:"current", maintenanceRecords:[] },
  { id:"asset-seed-02", name:"Shower Trailer", type:"trailer", make:"Quality Cargo", model:"LLC Cargo", year:2025, vin:"50ZBE242XSN063611", licensePlate:"Z1823L", permitNumber:"O1427528", grossWeight:"4530kg", hitchSize:'2" 5/16 Ball and Coupler', numAxles:2, fuelType:"N/A", insuranceStatus:"Collision", ownershipStatus:"Company Owned", subCategory:"cargo", purchasePrice:0, purchaseDate:"2025-01-01", depreciationRate:0.15, status:"operational", inspectionStatus:"current", maintenanceRecords:[] },
  { id:"asset-seed-03", name:"Locker Trailer", type:"trailer", make:"Quality Cargo", model:"LLC Cargo", year:2025, vin:"50ZBE2420SN063584", licensePlate:"Z6906R", permitNumber:"O0527529", grossWeight:"4530kg", hitchSize:'2" 5/16 Ball and Coupler', numAxles:2, fuelType:"N/A", insuranceStatus:"Collision", ownershipStatus:"Company Owned", subCategory:"cargo", purchasePrice:0, purchaseDate:"2025-01-01", depreciationRate:0.15, status:"operational", inspectionStatus:"current", maintenanceRecords:[] },
  { id:"asset-seed-04", name:"Management Trailer", type:"trailer", make:"Cynergy Cargo", model:"LLC Cargo", year:2021, vin:"55YBC2427MN043912", licensePlate:"X6237J", permitNumber:"N1872970", grossWeight:"4530kg", hitchSize:'2" 5/16 Ball and Coupler', numAxles:2, fuelType:"N/A", insuranceStatus:"Collision", ownershipStatus:"Company Owned", subCategory:"cargo", purchasePrice:0, purchaseDate:"2021-01-01", depreciationRate:0.15, status:"operational", inspectionStatus:"current", maintenanceRecords:[] },
  { id:"asset-seed-05", name:"Food Storage Trailer", type:"trailer", make:"Darkhorse Cargo", model:"LLC Cargo", year:2022, vin:"7LZBE1822NW103633", licensePlate:"Y8241J", permitNumber:"N1872857", grossWeight:"4530kg", hitchSize:'2" 5/16 Ball and Coupler', numAxles:2, fuelType:"N/A", insuranceStatus:"Collision", ownershipStatus:"Company Owned", subCategory:"cargo", purchasePrice:0, purchaseDate:"2022-01-01", depreciationRate:0.15, status:"operational", inspectionStatus:"current", maintenanceRecords:[] },
  { id:"asset-seed-06", name:"Flatdeck 24", type:"trailer", make:"Load Trail", model:"LLC Flatdeck", year:2022, vin:"4ZEDK2426N1279017", licensePlate:"X1653P", permitNumber:"M8664255", grossWeight:"4530kg", hitchSize:'2" 5/16 Ball and Coupler', numAxles:2, fuelType:"N/A", insuranceStatus:"Collision", ownershipStatus:"Company Owned", subCategory:"flatdeck", purchasePrice:0, purchaseDate:"2022-01-01", depreciationRate:0.15, status:"operational", inspectionStatus:"current", maintenanceRecords:[] },
  { id:"asset-seed-07", name:"Flatdeck 20", type:"trailer", make:"Canada Trailers", model:"SD20-14K", year:2025, vin:"2CPUSG2FXSA062232", licensePlate:"Z7522P", permitNumber:"O0100437", grossWeight:"6860kg", hitchSize:'2" 5/16 Ball and Coupler', numAxles:2, fuelType:"N/A", insuranceStatus:"Collision", ownershipStatus:"Company Owned", subCategory:"flatdeck", purchasePrice:0, purchaseDate:"2025-01-01", depreciationRate:0.15, status:"operational", inspectionStatus:"current", maintenanceRecords:[] },
  { id:"asset-seed-08", name:"Tri-axle Flatdeck", type:"trailer", make:"Miska", model:"10 Ton Tri-axle Float", year:2012, vin:"2MSUFJA38CH005506", licensePlate:"X9442S", permitNumber:"N0286410", grossWeight:"9525kg", hitchSize:"Pintle Hook", numAxles:3, fuelType:"N/A", insuranceStatus:"Collision", ownershipStatus:"Company Owned", subCategory:"flatdeck", notes:"Non-Priority safety status", purchasePrice:0, purchaseDate:"2012-01-01", depreciationRate:0.15, status:"operational", inspectionStatus:"current", maintenanceRecords:[] },
  { id:"asset-seed-09", name:"Old Dump Trailer", type:"trailer", make:"Load Trail", model:"LLC Lift-dump", year:2014, vin:"4ZEDT1424E1048706", licensePlate:"X2824E", permitNumber:"M6942791", grossWeight:"6350kg", hitchSize:'2" 5/16 Ball and Coupler', numAxles:2, fuelType:"N/A", insuranceStatus:"Collision", ownershipStatus:"Company Owned", subCategory:"dump", purchasePrice:0, purchaseDate:"2014-01-01", depreciationRate:0.15, status:"operational", inspectionStatus:"current", maintenanceRecords:[] },
  { id:"asset-seed-10", name:"New Dump Trailer", type:"trailer", make:"K-Trail Inc", model:"D82-16", year:2024, vin:"2RYKBDG33RM041586", licensePlate:"Y3064T", permitNumber:"O0101187", grossWeight:"9525kg", hitchSize:'2" 5/16 Ball and Coupler', numAxles:3, fuelType:"N/A", insuranceStatus:"Collision", ownershipStatus:"Company Owned", subCategory:"dump", purchasePrice:0, purchaseDate:"2024-01-01", depreciationRate:0.15, status:"operational", inspectionStatus:"current", maintenanceRecords:[] },
  { id:"asset-seed-11", name:"Matt's Camper", type:"trailer", make:"Unknown", model:"Camper", year:2017, vin:"4YDT28221HP910079", licensePlate:"Y8238J", hitchSize:'2" 5/16 Ball and Coupler', numAxles:2, fuelType:"N/A", insuranceStatus:"Collision", ownershipStatus:"Company Owned", subCategory:"camper", purchasePrice:0, purchaseDate:"2017-01-01", depreciationRate:0.15, status:"operational", inspectionStatus:"n/a", maintenanceRecords:[] },
  { id:"asset-seed-12", name:"Chuck's Camper", type:"trailer", make:"Unknown", model:"Camper", year:2013, hitchSize:'2" 5/16 Ball and Coupler', numAxles:2, fuelType:"N/A", insuranceStatus:"Collision", ownershipStatus:"Company Owned", subCategory:"camper", notes:"Safety not required", purchasePrice:0, purchaseDate:"2013-01-01", depreciationRate:0.15, status:"operational", inspectionStatus:"n/a", maintenanceRecords:[] },
  { id:"asset-seed-13", name:"Small Utility 1", type:"trailer", make:"Canada Trailers", model:"UT510-3K", year:2024, vin:"2CPUSB1B5RA059038", licensePlate:"Y3063T", permitNumber:"N5946322", grossWeight:"1356kg", hitchSize:'2" Ball and Coupler', numAxles:1, fuelType:"N/A", insuranceStatus:"Collision", ownershipStatus:"Privately Owned", subCategory:"utility", notes:"Safety not required", purchasePrice:0, purchaseDate:"2024-01-01", depreciationRate:0.15, status:"operational", inspectionStatus:"n/a", maintenanceRecords:[] },
  { id:"asset-seed-14", name:"Small Utility 2", type:"trailer", make:"Canada Trailers", model:"UT510-3K", year:2024, vin:"2CPUSB1BXRA058189", licensePlate:"Y7784S", permitNumber:"N5945973", grossWeight:"1356kg", hitchSize:'2" Ball and Coupler', numAxles:1, fuelType:"N/A", insuranceStatus:"Collision", ownershipStatus:"Company Owned", subCategory:"utility", notes:"Safety not required", purchasePrice:0, purchaseDate:"2024-01-01", depreciationRate:0.15, status:"operational", inspectionStatus:"n/a", maintenanceRecords:[] },
  { id:"asset-seed-15", name:"Small Utility 3", type:"trailer", make:"Canada Trailers", model:"UT510-3K", year:2024, vin:"2CPUSB1B0RA058055", licensePlate:"Y7785S", permitNumber:"N5945974", grossWeight:"1356kg", hitchSize:'2" Ball and Coupler', numAxles:1, fuelType:"N/A", insuranceStatus:"Collision", ownershipStatus:"Company Owned", subCategory:"utility", notes:"Safety not required", purchasePrice:0, purchaseDate:"2024-01-01", depreciationRate:0.15, status:"operational", inspectionStatus:"n/a", maintenanceRecords:[] },
  { id:"asset-seed-16", name:"Small Utility 4", type:"trailer", make:"Canada Trailers", model:"UT510-3K", year:2024, vin:"2CPUSB1B0RA058427", licensePlate:"Y7782S", permitNumber:"N5945972", grossWeight:"1356kg", hitchSize:'2" Ball and Coupler', numAxles:1, fuelType:"N/A", insuranceStatus:"Collision", ownershipStatus:"Company Owned", subCategory:"utility", notes:"Safety not required", purchasePrice:0, purchaseDate:"2024-01-01", depreciationRate:0.15, status:"operational", inspectionStatus:"n/a", maintenanceRecords:[] },
  { id:"asset-seed-17", name:"Generator", type:"equipment", make:"Airman", model:"SD613LAX", year:2020, grossWeight:"904kg", hitchSize:"Pintle Hook", numAxles:1, fuelType:"Diesel", insuranceStatus:"Collision", ownershipStatus:"Rented", subCategory:"generator", notes:"Compact 10' — rented unit", purchasePrice:0, purchaseDate:"2020-01-01", depreciationRate:0.30, status:"operational", inspectionStatus:"n/a", maintenanceRecords:[] },
  // ── ALL TERRAIN VEHICLES ──────────────────────────────────────────────────
  { id:"asset-seed-18", name:"Red Honda 1", type:"equipment", make:"Honda", model:"Rancher TMC", year:2022, vin:"1HFTE4022N4802157", licensePlate:"3E29C", permitNumber:"T2502397", grossWeight:"450kg", hitchSize:'2" Receiver', numAxles:2, fuelType:"Gas", insuranceStatus:"Commercial Liability", ownershipStatus:"Company Owned", subCategory:"atv", notes:"Safety not required", purchasePrice:0, purchaseDate:"2022-01-01", depreciationRate:0.20, status:"operational", inspectionStatus:"n/a", maintenanceRecords:[] },
  { id:"asset-seed-19", name:"Red Honda 2", type:"equipment", make:"Honda", model:"Rancher TRX", year:2021, vin:"1HFTE4021M4700718", licensePlate:"5ZF80", permitNumber:"T2346462", grossWeight:"450kg", hitchSize:'2" Receiver', numAxles:2, fuelType:"Gas", insuranceStatus:"Commercial Liability", ownershipStatus:"Company Owned", subCategory:"atv", notes:"Safety not required", purchasePrice:0, purchaseDate:"2021-01-01", depreciationRate:0.20, status:"operational", inspectionStatus:"n/a", maintenanceRecords:[] },
  { id:"asset-seed-20", name:"Red Honda 3", type:"equipment", make:"Honda", model:"Rancher TMC", year:2021, vin:"1HFTE4024M4702270", licensePlate:"3E28C", permitNumber:"T2502396", grossWeight:"450kg", hitchSize:'2" Receiver', numAxles:2, fuelType:"Gas", insuranceStatus:"Commercial Liability", ownershipStatus:"Company Owned", subCategory:"atv", notes:"Safety not required", purchasePrice:0, purchaseDate:"2021-01-01", depreciationRate:0.20, status:"operational", inspectionStatus:"n/a", maintenanceRecords:[] },
  { id:"asset-seed-21", name:"Green Honda 1", type:"equipment", make:"Honda", model:"Rancher TMC", year:2017, vin:"1HFTE4021H4300261", licensePlate:"6C16F", permitNumber:"T2465652", grossWeight:"450kg", hitchSize:'2" Receiver', numAxles:2, fuelType:"Gas", insuranceStatus:"Commercial Liability", ownershipStatus:"Company Owned", subCategory:"atv", notes:"Safety not required", purchasePrice:0, purchaseDate:"2017-01-01", depreciationRate:0.20, status:"operational", inspectionStatus:"n/a", maintenanceRecords:[] },
  { id:"asset-seed-22", name:"Green Honda 2", type:"equipment", make:"Honda", model:"Rancher TRX", year:2007, vin:"1HFTE356974000519", licensePlate:"6B57M", permitNumber:"T2407435", grossWeight:"450kg", hitchSize:'2" Receiver', numAxles:2, fuelType:"Gas", insuranceStatus:"Commercial Liability", ownershipStatus:"Company Owned", subCategory:"atv", notes:"Has windshield. Safety not required.", purchasePrice:0, purchaseDate:"2007-01-01", depreciationRate:0.20, status:"operational", inspectionStatus:"n/a", maintenanceRecords:[] },
  { id:"asset-seed-23", name:"Yellow Can-Am", type:"equipment", make:"Can-Am", model:"Outlander", year:2010, vin:"3JBEKLK10AJ000221", licensePlate:"5ZF87", permitNumber:"T2346475", grossWeight:"450kg", hitchSize:'2" Receiver', numAxles:2, fuelType:"Gas", insuranceStatus:"Commercial Liability", ownershipStatus:"Company Owned", subCategory:"atv", notes:"Safety not required", purchasePrice:0, purchaseDate:"2010-01-01", depreciationRate:0.20, status:"operational", inspectionStatus:"n/a", maintenanceRecords:[] },
  { id:"asset-seed-24", name:"Yellow Bombardier", type:"equipment", make:"Bombardier", model:"400 Can-Am", year:2005, vin:"2BVEPCF1X5V001897", licensePlate:"5ZF86", permitNumber:"T2346474", grossWeight:"450kg", hitchSize:'2" Receiver', numAxles:2, fuelType:"Gas", insuranceStatus:"Commercial Liability", ownershipStatus:"Company Owned", subCategory:"atv", notes:"Safety not required", purchasePrice:0, purchaseDate:"2005-01-01", depreciationRate:0.20, status:"operational", inspectionStatus:"n/a", maintenanceRecords:[] },
  { id:"asset-seed-25", name:"Blue Can-Am", type:"equipment", make:"Can-Am", model:"Side by Side", year:2018, hitchSize:'2" Receiver', numAxles:2, fuelType:"Gas", insuranceStatus:"Commercial Liability", ownershipStatus:"Company Owned", subCategory:"utv", notes:"Safety not required", purchasePrice:0, purchaseDate:"2018-01-01", depreciationRate:0.20, status:"operational", inspectionStatus:"n/a", maintenanceRecords:[] },
  { id:"asset-seed-26", name:"Opentop Honda", type:"equipment", make:"Honda", model:"Side by Side", year:2016, hitchSize:'2" Receiver', numAxles:2, fuelType:"Gas", insuranceStatus:"Commercial Liability", ownershipStatus:"Company Owned", subCategory:"utv", notes:"Open top. Safety not required.", purchasePrice:0, purchaseDate:"2016-01-01", depreciationRate:0.20, status:"operational", inspectionStatus:"n/a", maintenanceRecords:[] },
  { id:"asset-seed-27", name:"Old Kubota", type:"equipment", make:"Kubota", model:"900XT RTV-X", year:2013, vin:"A5KB1FDAPDG0E1369", grossWeight:"1590kg", hitchSize:'2" Receiver', numAxles:2, fuelType:"Diesel", insuranceStatus:"Commercial Liability", ownershipStatus:"Company Owned", subCategory:"utv", notes:"Safety not required", purchasePrice:0, purchaseDate:"2013-01-01", depreciationRate:0.20, status:"operational", inspectionStatus:"n/a", maintenanceRecords:[] },
  { id:"asset-seed-28", name:"New Kubota", type:"equipment", make:"Kubota", model:"RTVX-1100cc", year:2024, vin:"20KC2GDB3RG094420", licensePlate:"0E84N", permitNumber:"T2502402", grossWeight:"1800kg", hitchSize:'2" Receiver', numAxles:2, fuelType:"Diesel", insuranceStatus:"Commercial Liability", ownershipStatus:"Company Owned", subCategory:"utv", notes:"Safety not required", purchasePrice:0, purchaseDate:"2024-01-01", depreciationRate:0.20, status:"operational", inspectionStatus:"n/a", maintenanceRecords:[] },
  // ── HEAVY EQUIPMENT ───────────────────────────────────────────────────────
  { id:"asset-seed-29", name:"Excavator", type:"equipment", make:"CAT", model:"308EL", year:2015, vin:"0308EHFJX02760", grossWeight:"8400kg", numAxles:0, fuelType:"Diesel", insuranceStatus:"Commercial Liability", ownershipStatus:"Company Owned", subCategory:"excavator", notes:"8-ton mini-ex. Bill of sale.", purchasePrice:0, purchaseDate:"2015-01-01", depreciationRate:0.30, status:"operational", inspectionStatus:"n/a", maintenanceRecords:[] },
  { id:"asset-seed-30", name:"Miniature Excavator", type:"equipment", make:"Unknown", model:"Mini Excavator", year:2010, numAxles:0, fuelType:"Gas", insuranceStatus:"Commercial Liability", ownershipStatus:"Company Owned", subCategory:"excavator", notes:"Safety not required", purchasePrice:0, purchaseDate:"2010-01-01", depreciationRate:0.30, status:"operational", inspectionStatus:"n/a", maintenanceRecords:[] },
  // ── MOTOR VEHICLES ────────────────────────────────────────────────────────
  { id:"asset-seed-31", name:"Matt's Truck", type:"vehicle", make:"Chevrolet", model:"Silverado", year:2024, vin:"1GC4YPEY5RF314156", licensePlate:"2500", grossWeight:"5148kg", hitchSize:'2.5" Receiver', numAxles:2, fuelType:"Diesel", insuranceStatus:"Collision", ownershipStatus:"Owned", subCategory:"pickup", purchasePrice:0, purchaseDate:"2024-01-01", depreciationRate:0.18, status:"operational", inspectionStatus:"current", maintenanceRecords:[] },
];

export async function getAllAssets(): Promise<StoredAsset[]> {
  const db = await openDb();
  const readStore = tx(db, "assets").objectStore("assets");
  let assets = await getAll<StoredAsset>(readStore);
  db.close();

  // Delete any assets that are not from Equipment.pdf (non-seed IDs)
  const nonSeed = assets.filter(a => !a.id.startsWith("asset-seed-"));
  if (nonSeed.length > 0) {
    const db2 = await openDb();
    const writeStore = tx(db2, "assets", "readwrite").objectStore("assets");
    await Promise.all(nonSeed.map(a => del(writeStore, a.id)));
    db2.close();
    assets = assets.filter(a => a.id.startsWith("asset-seed-"));
  }

  // Upsert any Equipment.pdf asset not yet in the store
  const existingIds = new Set(assets.map(a => a.id));
  const missing = SEED_ASSETS.filter(a => !existingIds.has(a.id));
  if (missing.length > 0) {
    const db2 = await openDb();
    const writeStore = tx(db2, "assets", "readwrite").objectStore("assets");
    await Promise.all(missing.map(a => put(writeStore, a)));
    db2.close();
    assets = [...assets, ...missing];
  }

  return assets;
}

export async function saveAsset(asset: StoredAsset): Promise<void> {
  const db = await openDb();
  const store = tx(db, "assets", "readwrite").objectStore("assets");
  await put(store, asset);
  db.close();
}

export async function deleteAsset(assetId: string): Promise<void> {
  const db = await openDb();
  const store = tx(db, "assets", "readwrite").objectStore("assets");
  await del(store, assetId);
  db.close();
}

// ── Generic CRUD (v4 stores) ─────────────────────────────────────────────────
// Used by Training, Compliance, Accounting, Signatures, Camps

export async function getAllRecords<T>(storeName: string): Promise<T[]> {
  const db = await openDb();
  const store = tx(db, storeName).objectStore(storeName);
  const records = await getAll<T>(store);
  db.close();
  return records;
}

export async function saveRecord<T>(storeName: string, record: T): Promise<void> {
  const db = await openDb();
  const store = tx(db, storeName, "readwrite").objectStore(storeName);
  await put(store, record);
  db.close();
}

export async function deleteRecord(storeName: string, id: string): Promise<void> {
  const db = await openDb();
  const store = tx(db, storeName, "readwrite").objectStore(storeName);
  await del(store, id);
  db.close();
}

export async function saveBlobRecord(storeName: string, id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  const store = tx(db, storeName, "readwrite").objectStore(storeName);
  await put(store, { id, blob });
  db.close();
}

export async function getBlobRecord(storeName: string, id: string): Promise<string | null> {
  const db = await openDb();
  const store = tx(db, storeName).objectStore(storeName);
  const record = await getOne<{ id: string; blob: Blob }>(store, id);
  db.close();
  if (!record) return null;
  return URL.createObjectURL(record.blob);
}

export async function deleteBlobRecord(storeName: string, id: string): Promise<void> {
  const db = await openDb();
  const store = tx(db, storeName, "readwrite").objectStore(storeName);
  await del(store, id);
  db.close();
}

// ── Employee Seed Data (2026 Season — from Google Form responses) ────────────

const SEED_EMPLOYEES = [
  { id: "emp-seed-001", name: "Charles Leblanc", role: "Operations Supervisor", department: "Operations", email: "chuck@integrity-reforestation.com", phone: "(289) 821-3866", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "1-1512 Pelham Street", city: "Fonthill", province: "ON", crewBoss: "", firstAid: "No", dlClass: "", sin: "547 821 344", workPermit: "", emergencyContactName: "Anne Leblanc", emergencyContactPhone: "(905) 321-3212", emergencyContactEmail: "anne@hotmail.com", bankName: "Tangerine", bankInstitutionNumber: "123", bankTransitNumber: "", bankAccountNumber: "1234512345" },
  { id: "emp-seed-002", name: "Scout Broughton", role: "Tree Planter", department: "Field Operations", email: "scoutbroughton@gmail.com", phone: "(705) 373-3283", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "705 Schubert Circle", city: "Orleans", province: "Ontario", crewBoss: "Jolissa Lonsbury", firstAid: "No", dlClass: "G", sin: "967 090 986", workPermit: "Work Visa", emergencyContactName: "Julie Fortier", emergencyContactPhone: "(613) 851-9975", emergencyContactEmail: "mervyn.broughton@gmail.com", bankName: "CIBC", bankInstitutionNumber: "010", bankTransitNumber: "00010", bankAccountNumber: "7827598" },
  { id: "emp-seed-003", name: "Ema Regina Pablo-Fortier", role: "Tree Planter", department: "Field Operations", email: "emapab@gmail.com", phone: "(343) 576-1873", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "705 Schubert Circle", city: "Orleans", province: "Ontario", crewBoss: "Jolissa Lonsbury", firstAid: "No", dlClass: "G2", sin: "293 580 320", workPermit: "", emergencyContactName: "Julie Fortier", emergencyContactPhone: "(613) 851-9975", emergencyContactEmail: "pabfort@gmail.com", bankName: "TD Bank", bankInstitutionNumber: "004", bankTransitNumber: "05636", bankAccountNumber: "6583101" },
  { id: "emp-seed-004", name: "Caleb Gonsalves", role: "Tree Planter", department: "Field Operations", email: "calebgonsalves222@gmail.com", phone: "(519) 217-3583", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "38 Knox rd e", city: "Wasaga Beach", province: "Ontario", crewBoss: "Jolissa Lonsbury", firstAid: "No", dlClass: "G2", sin: "585 531 270", workPermit: "", emergencyContactName: "Robyn Gonsalves", emergencyContactPhone: "(519) 215-2769", emergencyContactEmail: "Robynlee@rogers.com", bankName: "CIBC", bankInstitutionNumber: "614", bankTransitNumber: "00152", bankAccountNumber: "4023094821" },
  { id: "emp-seed-005", name: "Davente Schab", role: "Tree Planter", department: "Field Operations", email: "davente563@gmail.com", phone: "(613) 979-8490", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "10 james st", city: "Ottawa", province: "Ontario", crewBoss: "Adam Deryute", firstAid: "No", dlClass: "G2", sin: "561 872 151", workPermit: "", emergencyContactName: "Amanda Schab", emergencyContactPhone: "(613) 323-4731", emergencyContactEmail: "aschab.realestate@gmail.com", bankName: "RBC", bankInstitutionNumber: "003", bankTransitNumber: "00155", bankAccountNumber: "5005020" },
  { id: "emp-seed-006", name: "Malcolm Cowley", role: "Tree Planter", department: "Field Operations", email: "malcolmcowley005@gmail.com", phone: "(226) 568-2474", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "275 Blanchfield road", city: "Southampton", province: "Ontario", crewBoss: "Jackson Gattesco", firstAid: "No", dlClass: "G2", sin: "549 229 573", workPermit: "", emergencyContactName: "Vince Cowley", emergencyContactPhone: "(519) 377-2474", emergencyContactEmail: "vincecowley@gmail.com", bankName: "Wealthsimple", bankInstitutionNumber: "703", bankTransitNumber: "00001", bankAccountNumber: "12002713" },
  { id: "emp-seed-007", name: "Gaetane Slootweg Allepuz", role: "Tree Planter", department: "Field Operations", email: "gaetaneallepuz@gmail.com", phone: "(647) 381-3264", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "71.5 West St N", city: "Thorold", province: "Ontario", crewBoss: "Jolissa Lonsbury", firstAid: "No", dlClass: "G1", sin: "764 731 865", workPermit: "", emergencyContactName: "Peter Hendrick Slootweg", emergencyContactPhone: "(412) 277-1476", emergencyContactEmail: "phslootweg@gmail.com", bankName: "Bank Of Nova Scotia", bankInstitutionNumber: "002", bankTransitNumber: "22152", bankAccountNumber: "0980625" },
  { id: "emp-seed-008", name: "Miah Jane Tretter", role: "Tree Planter", department: "Field Operations", email: "miahtretter46@gmail.com", phone: "(519) 377-1355", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "306 River Side Dr", city: "Oakville", province: "Ontario", crewBoss: "Adam Deryute", firstAid: "No", dlClass: "G2", sin: "596 079 384", workPermit: "", emergencyContactName: "Jon Tretter", emergencyContactPhone: "(519) 375-2236", emergencyContactEmail: "qm.wash@yahoo.ca", bankName: "Bank Of Montreal", bankInstitutionNumber: "001", bankTransitNumber: "24062", bankAccountNumber: "3994336" },
  { id: "emp-seed-009", name: "Quinten Alistair Macleod Emmer", role: "Tree Planter", department: "Field Operations", email: "qamemmer@gmail.com", phone: "(647) 220-6087", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "156 Church Street North", city: "Stouffville", province: "Ontario", crewBoss: "Jolissa Lonsbury", firstAid: "Yes", dlClass: "G", sin: "591 691 316", workPermit: "", emergencyContactName: "Timothy Emmer", emergencyContactPhone: "(416) 580-4541", emergencyContactEmail: "tcwemmer@gmail.com", bankName: "TD Canada Trust", bankInstitutionNumber: "004", bankTransitNumber: "37002", bankAccountNumber: "6437543" },
  { id: "emp-seed-010", name: "Aidan McDonald", role: "Tree Planter", department: "Field Operations", email: "aidan.mcdonald21@gmail.com", phone: "(343) 333-2339", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "36 wolfe st", city: "Kingston", province: "Ontario", crewBoss: "Lucas Watson", firstAid: "No", dlClass: "G", sin: "564 648 632", workPermit: "", emergencyContactName: "Vanessa Holmes", emergencyContactPhone: "(613) 532-9787", emergencyContactEmail: "Holmesv.rn@gmail.com", bankName: "Scotiabank", bankInstitutionNumber: "002", bankTransitNumber: "24802", bankAccountNumber: "1180320" },
  { id: "emp-seed-011", name: "Ginger Anne Currie", role: "Tree Planter", department: "Field Operations", email: "ginger.anne.72@gmail.com", phone: "(613) 340-1686", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "8827 Gosford Rd.", city: "North Augusta", province: "Ontario", crewBoss: "Lucas Watson", firstAid: "No", dlClass: "G1", sin: "528 518 392", workPermit: "", emergencyContactName: "Kathleen Currie", emergencyContactPhone: "(613) 340-6547", emergencyContactEmail: "", bankName: "TD Canada Trust", bankInstitutionNumber: "004", bankTransitNumber: "22122", bankAccountNumber: "6253738" },
  { id: "emp-seed-012", name: "Evan Micheal MacDougall", role: "Tree Planter", department: "Field Operations", email: "evan.macdougall6@gmail.com", phone: "(289) 439-3685", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "2108 Bartok Road", city: "Burlington", province: "Ontario", crewBoss: "Adam Deryute", firstAid: "No", dlClass: "G2", sin: "550 477 541", workPermit: "", emergencyContactName: "Steve MacDougall", emergencyContactPhone: "(905) 630-5589", emergencyContactEmail: "sgmacdougall@gmail.com", bankName: "WealthSimple", bankInstitutionNumber: "703", bankTransitNumber: "00001", bankAccountNumber: "30385397" },
  { id: "emp-seed-013", name: "Tyler Anthony Gallant", role: "Tree Planter", department: "Field Operations", email: "tylergallant2858@gmail.com", phone: "(289) 933-2656", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "269 Kensington Ave N", city: "Hamilton", province: "Ontario", crewBoss: "Adam Deryute", firstAid: "No", dlClass: "G2", sin: "571 182 005", workPermit: "", emergencyContactName: "Donna Gallant-Ernest", emergencyContactPhone: "(905) 532-8944", emergencyContactEmail: "", bankName: "RBC", bankInstitutionNumber: "003", bankTransitNumber: "01922", bankAccountNumber: "5140686" },
  { id: "emp-seed-014", name: "Aidan Cliche", role: "Tree Planter", department: "Field Operations", email: "aidancliche@gmail.com", phone: "(226) 977-1550", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "216 Base Line Rd E", city: "London", province: "ON", crewBoss: "Jolissa Lonsbury", firstAid: "No", dlClass: "G", sin: "544 980 600", workPermit: "", emergencyContactName: "David Cliche", emergencyContactPhone: "(519) 868-7542", emergencyContactEmail: "", bankName: "RBC", bankInstitutionNumber: "003", bankTransitNumber: "02882", bankAccountNumber: "5081401" },
  { id: "emp-seed-015", name: "Richard Jackson Gattesco", role: "Crew Boss", department: "Field Operations", email: "jacksongatt3519@gmail.com", phone: "(226) 930-1263", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "350 Saugeen Street", city: "Southampton", province: "ON", crewBoss: "", firstAid: "No", dlClass: "GM2", sin: "547 030 767", workPermit: "", emergencyContactName: "Dean Gattesco", emergencyContactPhone: "(519) 386-4544", emergencyContactEmail: "deangattesco@gmail.com", bankName: "Wealthsimple", bankInstitutionNumber: "703", bankTransitNumber: "00001", bankAccountNumber: "14523534" },
  { id: "emp-seed-016", name: "Alexandra Marion Garland", role: "Tree Planter", department: "Field Operations", email: "ali.ga010203@gmail.com", phone: "(519) 859-1415", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "4033 Catherine Street", city: "Dorchester", province: "Ontario", crewBoss: "Adam Deryute", firstAid: "No", dlClass: "G", sin: "581 008 961", workPermit: "", emergencyContactName: "Tara Garland", emergencyContactPhone: "(519) 860-9009", emergencyContactEmail: "taragarland1@hotmail.com", bankName: "TD Canada Trust", bankInstitutionNumber: "004", bankTransitNumber: "23602", bankAccountNumber: "6329959" },
  { id: "emp-seed-017", name: "Diego Gonzalez", role: "Tree Planter", department: "Field Operations", email: "1diego.gonz@gmail.com", phone: "(519) 324-5334", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "4 Warren Ave", city: "Leamington", province: "ON", crewBoss: "Adam Deryute", firstAid: "Yes", dlClass: "G2", sin: "571 325 059", workPermit: "", emergencyContactName: "Jesus Gonzalez", emergencyContactPhone: "(226) 340-8219", emergencyContactEmail: "", bankName: "Royal Bank of Canada", bankInstitutionNumber: "003", bankTransitNumber: "02642", bankAccountNumber: "5020441" },
  { id: "emp-seed-018", name: "William (Danny) Lubitz", role: "Tree Planter", department: "Field Operations", email: "fanshiko@gmail.com", phone: "(548) 994-8238", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "329 Curry Ave", city: "Windsor", province: "ON", crewBoss: "Jackson Gattesco", firstAid: "No", dlClass: "G2", sin: "553 433 657", workPermit: "", emergencyContactName: "Rebecca Lubitz", emergencyContactPhone: "(519) 498-7432", emergencyContactEmail: "rebeccalubitz1985@gmail.com", bankName: "BMO", bankInstitutionNumber: "001", bankTransitNumber: "04732", bankAccountNumber: "393320" },
  { id: "emp-seed-019", name: "Ryan Terrance Clark", role: "Tree Planter", department: "Field Operations", email: "05dipper@gmail.com", phone: "(519) 328-9013", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "344 Bentinck St", city: "Corunna", province: "Ontario", crewBoss: "Jackson Gattesco", firstAid: "No", dlClass: "G", sin: "576 077 739", workPermit: "", emergencyContactName: "Ken Clark", emergencyContactPhone: "(519) 312-5030", emergencyContactEmail: "", bankName: "RBC", bankInstitutionNumber: "003", bankTransitNumber: "01102", bankAccountNumber: "5064944" },
  { id: "emp-seed-020", name: "Tshimanga Orly Kanyinda", role: "Tree Planter", department: "Field Operations", email: "orlykanyinda@gmail.com", phone: "(613) 220-4796", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "400 Den Haag Dr", city: "Ottawa", province: "Ontario", crewBoss: "Lucas Watson", firstAid: "No", dlClass: "G1", sin: "159 513 365", workPermit: "", emergencyContactName: "Christel Kanyinda", emergencyContactPhone: "(204) 960-0116", emergencyContactEmail: "kanyindc@gmail.com", bankName: "Royal Bank of Canada", bankInstitutionNumber: "003", bankTransitNumber: "02075", bankAccountNumber: "5129994" },
  { id: "emp-seed-021", name: "Wany Mawau Ruathdel", role: "Tree Planter", department: "Field Operations", email: "mawauwany@gmail.com", phone: "(226) 739-4465", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "628 Mill street", city: "Windsor", province: "Ontario", crewBoss: "Lucas Watson", firstAid: "No", dlClass: "G2", sin: "593 301 716", workPermit: "", emergencyContactName: "Gatwech Mawau", emergencyContactPhone: "(705) 206-3528", emergencyContactEmail: "gatwechmawau@gmail.com", bankName: "CIBC", bankInstitutionNumber: "010", bankTransitNumber: "00192", bankAccountNumber: "8247293" },
  { id: "emp-seed-022", name: "Gabrielle Voelzing", role: "Kitchen Staff", department: "Camp Services", email: "gabrielle.voelzing@yahoo.com", phone: "(519) 571-4220", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "129 Waterloo street", city: "Kitchener", province: "Ontario", crewBoss: "", firstAid: "Yes", dlClass: "F", sin: "546 458 449", workPermit: "", emergencyContactName: "Brandon Wright", emergencyContactPhone: "(647) 400-6885", emergencyContactEmail: "brandyw0399@gmail.com", bankName: "TD Canada Trust", bankInstitutionNumber: "004", bankTransitNumber: "00672", bankAccountNumber: "6268637" },
  { id: "emp-seed-023", name: "Blu-Maszyel Blessed Simon", role: "Tree Planter", department: "Field Operations", email: "blusimon78@gmail.com", phone: "(647) 545-4410", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "Brock street", city: "Whitby", province: "ON", crewBoss: "Jackson Gattesco", firstAid: "No", dlClass: "G", sin: "577 855 919", workPermit: "", emergencyContactName: "Shereen", emergencyContactPhone: "(647) 528-8610", emergencyContactEmail: "shereensimon7878@gmail.com", bankName: "BMO", bankInstitutionNumber: "001", bankTransitNumber: "29972", bankAccountNumber: "3864576" },
  { id: "emp-seed-024", name: "Daniel Robert Sivell-Legender", role: "Tree Planter", department: "Field Operations", email: "legenderdan@gmail.com", phone: "(742) 986-5920", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "18 Cora st east", city: "Huntsville", province: "Ontario", crewBoss: "Jackson Gattesco", firstAid: "No", dlClass: "G", sin: "151 957 388", workPermit: "", emergencyContactName: "Tasha Connell", emergencyContactPhone: "(226) 789-1507", emergencyContactEmail: "tasha.connell@hotmail.com", bankName: "PC Financial", bankInstitutionNumber: "320", bankTransitNumber: "02002", bankAccountNumber: "5338660235687368" },
  { id: "emp-seed-025", name: "Jolissa Lonsberry", role: "Crew Boss", department: "Field Operations", email: "jolissa.lonsberry@gmail.com", phone: "(613) 847-5622", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "104 Gracefield Lane", city: "Belleville", province: "Ontario", crewBoss: "", firstAid: "Yes", dlClass: "C", sin: "539 553 776", workPermit: "", emergencyContactName: "Joe Lonsberry", emergencyContactPhone: "(613) 962-2841", emergencyContactEmail: "", bankName: "Scotiabank", bankInstitutionNumber: "002", bankTransitNumber: "55046", bankAccountNumber: "0067628" },
  { id: "emp-seed-026", name: "Nathaniel Brouwer", role: "Tree Planter", department: "Field Operations", email: "brounath772@gmail.com", phone: "(226) 224-8025", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "99 Bruce street", city: "London", province: "ON", crewBoss: "Jackson Gattesco", firstAid: "No", dlClass: "G", sin: "545 672 776", workPermit: "", emergencyContactName: "Richard Brouwer", emergencyContactPhone: "(519) 521-8343", emergencyContactEmail: "rbrouwer1970@icloud.com", bankName: "TD Bank", bankInstitutionNumber: "004", bankTransitNumber: "00122", bankAccountNumber: "6446541" },
  { id: "emp-seed-027", name: "Stephanie McGee", role: "Tree Planter", department: "Field Operations", email: "stephaniemcgee160@gmail.com", phone: "(905) 429-9713", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "1 Walbridge court", city: "Bowmanville", province: "Ontario", crewBoss: "Jackson Gattesco", firstAid: "No", dlClass: "G", sin: "568 104 038", workPermit: "", emergencyContactName: "Sarah Robillard", emergencyContactPhone: "(905) 623-6786", emergencyContactEmail: "Stephaniemcgee160@gmail.com", bankName: "Scotia Bank", bankInstitutionNumber: "002", bankTransitNumber: "37572", bankAccountNumber: "0189286" },
  { id: "emp-seed-028", name: "Christoph Neuland", role: "Tree Planter", department: "Field Operations", email: "neulandchristoph@gmail.com", phone: "(226) 237-1545", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "308 Nairn Avenue", city: "Toronto", province: "Ontario", crewBoss: "Richard Jackson Gattesco", firstAid: "No", dlClass: "", sin: "566 193 157", workPermit: "", emergencyContactName: "Janis Neuland", emergencyContactPhone: "(647) 381-0539", emergencyContactEmail: "", bankName: "Scotiabank", bankInstitutionNumber: "002", bankTransitNumber: "64816", bankAccountNumber: "0067415" },
  { id: "emp-seed-029", name: "Brittney Taylor Shanks", role: "Tree Planter", department: "Field Operations", email: "brittneyshanks432@gmail.com", phone: "(519) 731-4090", status: "active", startDate: "2026-05-01", avatar: "", streetAddress: "159 Corbett Drive, Unit 1", city: "Pontypool", province: "Ontario", crewBoss: "Adam Deryute", firstAid: "No", dlClass: "G", sin: "527 893 861", workPermit: "", emergencyContactName: "Darlene Shanks", emergencyContactPhone: "(905) 626-9315", emergencyContactEmail: "Shanksyoutoo@aol.com", bankName: "Scotiabank", bankInstitutionNumber: "002", bankTransitNumber: "14936", bankAccountNumber: "0200425" },
];

// Employees that must exist in the DB — checked by email to survive any caching scenario.
// These are the 8 employees added after the initial 55-person roster was imported.
const REQUIRED_EMPLOYEES = [
  { id: "s26-056", name: "Brendan Donald McKenzie", role: "Tree Planter", department: "Field Operations", email: "brendanmckenzie95@gmail.com", phone: "2896962991", status: "active", startDate: "2026-05-01", avatar: "BM", city: "St. Catharines", province: "ON", crewBoss: "Jolissa Lonsberry", sin: "529876583", dlClass: "", firstAid: "No", emergencyContactName: "Tafean Williston", emergencyContactPhone: "2896962991", emergencyContactEmail: "", bankName: "Tangerine", bankInstitutionNumber: "614", bankTransitNumber: "00152", bankAccountNumber: "4016978907", streetAddress: "111 Fourth Ave #12" },
  { id: "s26-057", name: "Benjamin Richard Leigh Ruben Mitchell", role: "Tree Planter", department: "Field Operations", email: "footballben02@gmail.com", phone: "3439989232", status: "active", startDate: "2026-05-01", avatar: "BM", city: "Carleton Place", province: "ON", crewBoss: "Jolissa Lonsberry", sin: "566602470", dlClass: "G2", firstAid: "No", emergencyContactName: "Melissa Mitchell", emergencyContactPhone: "6132579232", emergencyContactEmail: "missym_8@hotmail.com", bankName: "Royal Bank of Canada", bankInstitutionNumber: "003", bankTransitNumber: "00842", bankAccountNumber: "5098215", streetAddress: "124 William Street" },
  { id: "s26-058", name: "James Stephen Samhaber", role: "Tree Planter", department: "Field Operations", email: "james.samhaber@gmail.com", phone: "6137255987", status: "active", startDate: "2026-05-01", avatar: "JS", city: "Ottawa", province: "ON", crewBoss: "Adam Deruyte", sin: "533074936", dlClass: "G", firstAid: "No", emergencyContactName: "Bruce Samhaber", emergencyContactPhone: "6132976961", emergencyContactEmail: "Bruce.samhaber@gmail.com", bankName: "Scotiabank", bankInstitutionNumber: "002", bankTransitNumber: "20396", bankAccountNumber: "0279927", streetAddress: "112 Kenora Street" },
  { id: "s26-059", name: "Matthew Byrne Colas", role: "Tree Planter", department: "Field Operations", email: "matthewcolas777@gmail.com", phone: "6479695268", status: "active", startDate: "2026-05-01", avatar: "MC", city: "Mississauga", province: "ON", crewBoss: "Richard Jackson Gattesco", sin: "551437353", dlClass: "G", firstAid: "No", emergencyContactName: "Rosemary Colas", emergencyContactPhone: "4169045268", emergencyContactEmail: "roseandalexcolas@gmail.com", bankName: "Wealthsimple", bankInstitutionNumber: "703", bankTransitNumber: "00001", bankAccountNumber: "31260821", streetAddress: "448 Aqua Drive" },
  { id: "s26-060", name: "Mouhamadoul Moustapha Ndoye", role: "Tree Planter", department: "Field Operations", email: "moustaphandoye737@gmail.com", phone: "2638812093", status: "active", startDate: "2026-05-01", avatar: "MN", city: "Gatineau", province: "QC", crewBoss: "Richard Jackson Gattesco", sin: "969205913", dlClass: "", firstAid: "No", emergencyContactName: "Abdoul Aziz Lam", emergencyContactPhone: "3435532104", emergencyContactEmail: "Axiloc2003@gmail.com", bankName: "Desjardins", bankInstitutionNumber: "829", bankTransitNumber: "00107", bankAccountNumber: "0619213", streetAddress: "A-18 Rue Demontigny" },
  { id: "s26-061", name: "Noah Doell", role: "Tree Planter", department: "Field Operations", email: "noahdoell041@gmail.com", phone: "6132502743", status: "active", startDate: "2026-05-01", avatar: "ND", city: "Peterborough", province: "ON", crewBoss: "Jolissa Lonsberry", sin: "599315157", dlClass: "G", firstAid: "No", emergencyContactName: "Carley Doell", emergencyContactPhone: "6138594881", emergencyContactEmail: "cdoell44@gmail.com", bankName: "RBC", bankInstitutionNumber: "003", bankTransitNumber: "01672", bankAccountNumber: "5185707", streetAddress: "28A Springbrook Drive" },
  { id: "s26-062", name: "Real Bain", role: "Tree Planter", department: "Field Operations", email: "rayraybain001@gmail.com", phone: "6477248941", status: "active", startDate: "2026-05-01", avatar: "RB", city: "Toronto", province: "ON", crewBoss: "Richard Jackson Gattesco", sin: "552450926", dlClass: "", firstAid: "No", emergencyContactName: "Nancy Patel", emergencyContactPhone: "6476808784", emergencyContactEmail: "Onsitehealth@rogers.com", bankName: "RBC", bankInstitutionNumber: "003", bankTransitNumber: "06352", bankAccountNumber: "5094370", streetAddress: "225 Gladstone Avenue" },
  { id: "s26-063", name: "Sebastian Candela", role: "Tree Planter", department: "Field Operations", email: "sebicand@gmail.com", phone: "6138934636", status: "active", startDate: "2026-05-01", avatar: "SC", city: "Kingston", province: "ON", crewBoss: "Jolissa Lonsberry", sin: "569796881", dlClass: "G", firstAid: "No", emergencyContactName: "Rudy Candela", emergencyContactPhone: "6135442658", emergencyContactEmail: "candelar@limestone.on.ca", bankName: "TD Bank", bankInstitutionNumber: "004", bankTransitNumber: "01392", bankAccountNumber: "6710220", streetAddress: "46 Mowat Ave" },
];

/** Seeds 2026 employee roster on first load if not already present. */
export async function seedEmployeesData(): Promise<void> {
  const db = await openDb();
  const existing = await getAll<{ id: string }>(tx(db, "employees").objectStore("employees"));
  db.close();

  const existingIds = new Set(existing.map((e) => e.id));

  // Seed base 29 employees by ID
  for (const emp of SEED_EMPLOYEES) {
    if (!existingIds.has(emp.id)) await saveRecord("employees", emp);
  }

  // Always force-write the 8 required employees — put() is idempotent,
  // this guarantees they exist regardless of any previous DB state.
  for (const emp of REQUIRED_EMPLOYEES) {
    await saveRecord("employees", emp);
  }
}

/** Load all employees from IndexedDB. */
export async function getAllEmployees(): Promise<unknown[]> {
  const db = await openDb();
  const all = await getAll<unknown>(tx(db, "employees").objectStore("employees"));
  db.close();
  return all;
}

// ── Payroll Seed Data (Period 7 — Pay Ending 2026-03-20, Pay Date 2026-03-27) ─

const SEED_PAYROLL_STUBS = [
  { id: "payroll-seed-stub-5",  employeeId: "000000005", employee: "Charles LeBlanc",  period: "Period 7", periodEnd: "2026-03-20", grossPay: 3850.00, deductions: 1087.41, netPay: 2762.59, status: "paid" },
  { id: "payroll-seed-stub-52", employeeId: "000000052", employee: "Monica McKernan",  period: "Period 7", periodEnd: "2026-03-20", grossPay: 2700.00, deductions:  627.05, netPay: 2072.95, status: "paid" },
  { id: "payroll-seed-stub-53", employeeId: "000000053", employee: "Matthew McKernan", period: "Period 7", periodEnd: "2026-03-20", grossPay: 7500.00, deductions: 2874.27, netPay: 4625.73, status: "paid" },
  { id: "payroll-seed-stub-42", employeeId: "020250042", employee: "Vanessa McKernan", period: "Period 7", periodEnd: "2026-03-20", grossPay: 2000.00, deductions:  398.42, netPay: 1601.58, status: "paid" },
];

const SEED_PAYROLL_RUNS = [
  { id: "payroll-seed-run-7", period: "Period 7", periodEnd: "2026-03-20", employeeCount: 4, totalGross: 16050.00, totalNet: 11062.85, processedBy: "Matthew McKernan", processedDate: "2026-03-25", status: "completed" },
];

/** Seeds Period 7 payroll data on first load if not already present. */
export async function seedPayrollData(): Promise<void> {
  // Stubs
  const db1 = await openDb();
  const existing = await getAll<{ id: string }>(tx(db1, "payroll_stubs").objectStore("payroll_stubs"));
  db1.close();
  const existingStubIds = new Set(existing.map((r) => r.id));
  const missingStubs = SEED_PAYROLL_STUBS.filter((s) => !existingStubIds.has(s.id));
  if (missingStubs.length > 0) {
    const db2 = await openDb();
    const store = tx(db2, "payroll_stubs", "readwrite").objectStore("payroll_stubs");
    await Promise.all(missingStubs.map((s) => put(store, s)));
    db2.close();
  }

  // Runs
  const db3 = await openDb();
  const existingRuns = await getAll<{ id: string }>(tx(db3, "payroll_runs").objectStore("payroll_runs"));
  db3.close();
  const existingRunIds = new Set(existingRuns.map((r) => r.id));
  const missingRuns = SEED_PAYROLL_RUNS.filter((r) => !existingRunIds.has(r.id));
  if (missingRuns.length > 0) {
    const db4 = await openDb();
    const store = tx(db4, "payroll_runs", "readwrite").objectStore("payroll_runs");
    await Promise.all(missingRuns.map((r) => put(store, r)));
    db4.close();
  }
}

// ── Project Blocks ────────────────────────────────────────────────────────────

export interface BlockAllocation {
  id: string;
  species: string;
  trees: number;
}

export interface ProjectBlock {
  id: string;
  projectId: string;
  blockName: string;
  mapFileId?: string;
  area?: number;          // hectares
  density?: number;       // stems per hectare
  allocations: BlockAllocation[];
}

export async function getProjectBlocks(projectId: string): Promise<ProjectBlock[]> {
  const db = await openDb();
  const all = await getAll<ProjectBlock>(tx(db, "project_blocks").objectStore("project_blocks"));
  db.close();
  return all.filter((b) => b.projectId === projectId);
}

export async function saveProjectBlock(block: ProjectBlock): Promise<void> {
  const db = await openDb();
  const store = tx(db, "project_blocks", "readwrite").objectStore("project_blocks");
  await put(store, block);
  db.close();
}

export async function deleteProjectBlock(id: string): Promise<void> {
  const db = await openDb();
  const store = tx(db, "project_blocks", "readwrite").objectStore("project_blocks");
  await del(store, id);
  db.close();
}

// ── Nursery Loads ─────────────────────────────────────────────────────────────

export interface NurserySpeciesLine {
  id: string;
  species: string;
  treesPerBox: number;
  numberOfBoxes: number;
}

export type NurseryLoadStatus = "scheduled" | "in-transit" | "delivered" | "cancelled";

/** diagram: 52-element array ("R{row}C{col}", 2 rows × 26 cols). Each element is a speciesLineId or "". */
export interface NurseryLoad {
  id: string;
  projectId: string;
  loadDate: string;
  deliveryDate: string;
  nurseryName?: string;
  driver?: string;
  status: NurseryLoadStatus;
  notes?: string;
  species: NurserySpeciesLine[];
  diagram: string[];
}

export async function getNurseryLoads(projectId: string): Promise<NurseryLoad[]> {
  const db = await openDb();
  const all = await getAll<NurseryLoad>(tx(db, "nursery_loads").objectStore("nursery_loads"));
  db.close();
  return all.filter((l) => l.projectId === projectId).sort((a, b) => b.loadDate.localeCompare(a.loadDate));
}

export async function saveNurseryLoad(load: NurseryLoad): Promise<void> {
  const db = await openDb();
  await put(tx(db, "nursery_loads", "readwrite").objectStore("nursery_loads"), load);
  db.close();
}

export async function deleteNurseryLoad(id: string): Promise<void> {
  const db = await openDb();
  await del(tx(db, "nursery_loads", "readwrite").objectStore("nursery_loads"), id);
  db.close();
}

// ── Supervisor Deliveries ──────────────────────────────────────────────────

export interface SupervisorDeliveryLine {
  id: string;
  speciesId: string;
  species: string;
  code: string;
  trees: number;
}

export interface SupervisorDelivery {
  id: string;
  date: string;
  project: string;
  block: string;
  loadNumber?: string;
  deliveredBy?: string;
  notes?: string;
  lines: SupervisorDeliveryLine[];
  totalTrees: number;
}

export async function getSupervisorDeliveries(): Promise<SupervisorDelivery[]> {
  const db = await openDb();
  const all = await getAll<SupervisorDelivery>(tx(db, "supervisor_deliveries").objectStore("supervisor_deliveries"));
  db.close();
  return all;
}

export async function saveSupervisorDelivery(delivery: SupervisorDelivery): Promise<void> {
  const db = await openDb();
  await put(tx(db, "supervisor_deliveries", "readwrite").objectStore("supervisor_deliveries"), delivery);
  db.close();
}

export async function deleteSupervisorDelivery(id: string): Promise<void> {
  const db = await openDb();
  await del(tx(db, "supervisor_deliveries", "readwrite").objectStore("supervisor_deliveries"), id);
  db.close();
}

// ── Tree Transfers ─────────────────────────────────────────────────────────

export interface TreeTransferLine {
  id: string;
  speciesId: string;
  species: string;
  code: string;
  trees: number;
}

/** "Reefer Storage" is a valid block sentinel — use the constant for consistency. */
export const REEFER_STORAGE = "Reefer Storage";

export interface TreeTransfer {
  id: string;
  date: string;
  /** Source block name or "Reefer Storage" */
  fromBlock: string;
  /** Destination block name or "Reefer Storage" */
  toBlock: string;
  lines: TreeTransferLine[];
  totalTrees: number;
  notes?: string;
}

export async function getTreeTransfers(): Promise<TreeTransfer[]> {
  const db = await openDb();
  const all = await getAll<TreeTransfer>(tx(db, "tree_transfers").objectStore("tree_transfers"));
  db.close();
  return all;
}

export async function saveTreeTransfer(transfer: TreeTransfer): Promise<void> {
  const db = await openDb();
  await put(tx(db, "tree_transfers", "readwrite").objectStore("tree_transfers"), transfer);
  db.close();
}

export async function deleteTreeTransfer(id: string): Promise<void> {
  const db = await openDb();
  await del(tx(db, "tree_transfers", "readwrite").objectStore("tree_transfers"), id);
  db.close();
}

// ── Tree Orders ────────────────────────────────────────────────────────────

export interface TreeOrderLine {
  id: string;
  speciesId: string;
  species: string;
  code: string;
  quantity: number;
}

export interface TreeOrder {
  id: string;
  orderDate: string;    // date the trees are needed (next planting day)
  createdDate: string;  // session date when order was created
  block: string;
  project: string;
  crewBoss: string;
  lines: TreeOrderLine[];
  notes?: string;
}

export async function getTreeOrders(): Promise<TreeOrder[]> {
  const db = await openDb();
  const all = await getAll<TreeOrder>(tx(db, "tree_orders").objectStore("tree_orders"));
  db.close();
  return all;
}

export async function saveTreeOrder(order: TreeOrder): Promise<void> {
  const db = await openDb();
  await put(tx(db, "tree_orders", "readwrite").objectStore("tree_orders"), order);
  db.close();
}

export async function deleteTreeOrder(id: string): Promise<void> {
  const db = await openDb();
  await del(tx(db, "tree_orders", "readwrite").objectStore("tree_orders"), id);
  db.close();
}

// ── Upcoming Block Plans ───────────────────────────────────────────────────

export interface UpcomingBlockPlan {
  id: string;
  blockName: string;
  crewName: string;
  notes?: string;
  sortOrder: number;
}

export async function getUpcomingBlockPlans(): Promise<UpcomingBlockPlan[]> {
  const db = await openDb();
  const all = await getAll<UpcomingBlockPlan>(tx(db, "upcoming_block_plans").objectStore("upcoming_block_plans"));
  db.close();
  return all;
}

export async function saveUpcomingBlockPlan(plan: UpcomingBlockPlan): Promise<void> {
  const db = await openDb();
  await put(tx(db, "upcoming_block_plans", "readwrite").objectStore("upcoming_block_plans"), plan);
  db.close();
}

export async function deleteUpcomingBlockPlan(id: string): Promise<void> {
  const db = await openDb();
  await del(tx(db, "upcoming_block_plans", "readwrite").objectStore("upcoming_block_plans"), id);
  db.close();
}

// ── Delivery Plans ─────────────────────────────────────────────────────────

export interface DeliveryPlanLine {
  id: string;
  speciesId: string;
  species: string;
  code: string;
  boxes: number;
  treesPerBox: number;
  trees: number;
}

export interface DeliveryPlan {
  id: string;
  planDate: string;
  blockName: string;
  driverName: string;
  truckId?: string;
  blockNotes?: string;
  notes?: string;
  lines: DeliveryPlanLine[];
  totalTrees: number;
  status: "planned" | "dispatched" | "delivered";
}

export async function getDeliveryPlans(): Promise<DeliveryPlan[]> {
  const db = await openDb();
  const all = await getAll<DeliveryPlan>(tx(db, "delivery_plans").objectStore("delivery_plans"));
  db.close();
  return all;
}

export async function saveDeliveryPlan(plan: DeliveryPlan): Promise<void> {
  const db = await openDb();
  await put(tx(db, "delivery_plans", "readwrite").objectStore("delivery_plans"), plan);
  db.close();
}

export async function deleteDeliveryPlan(id: string): Promise<void> {
  const db = await openDb();
  await del(tx(db, "delivery_plans", "readwrite").objectStore("delivery_plans"), id);
  db.close();
}

// ── Receipts ───────────────────────────────────────────────────────────────

export interface Receipt {
  id: string;
  employee: string;
  cost: number | null;
  date: string;
  time: string;
  expenseType: string;
  litres: number | null;
  pricePerLitre: number | null;
  total: number | null;
  vehicle: string;
  items: string;
  creditCard: string;
  odometer: string;
  location: string;
  notes: string;
  receiptProvided: string;
  imageUrl: string;
}

export async function getReceipts(): Promise<Receipt[]> {
  const db = await openDb();
  const result = await getAll<Receipt>(tx(db, "receipts").objectStore("receipts"));
  db.close();
  return result;
}

export async function saveReceipt(receipt: Receipt): Promise<void> {
  const db = await openDb();
  await put(tx(db, "receipts", "readwrite").objectStore("receipts"), receipt);
  db.close();
}

export async function deleteReceipt(id: string): Promise<void> {
  const db = await openDb();
  await del(tx(db, "receipts", "readwrite").objectStore("receipts"), id);
  db.close();
}

export async function saveReceiptImage(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await put(tx(db, "receipt_images", "readwrite").objectStore("receipt_images"), { id, blob });
  db.close();
}

export async function getReceiptImage(id: string): Promise<Blob | null> {
  const db = await openDb();
  const record = await getOne<{ id: string; blob: Blob }>(tx(db, "receipt_images").objectStore("receipt_images"), id);
  db.close();
  return record?.blob ?? null;
}

// ── Block Adjustments ────────────────────────────────────────────────────────

export interface BlockAdjustment {
  id: string;
  timestamp: string;
  project: string;
  block: string;
  species: string;
  speciesCode: string;
  originalTrees: number;
  newTrees: number;
  delta: number;
  reason: string;
}

export async function getAllBlockAdjustments(): Promise<BlockAdjustment[]> {
  const db = await openDb();
  const store = tx(db, "block_adjustments").objectStore("block_adjustments");
  const all = await getAll<BlockAdjustment>(store);
  db.close();
  return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function saveBlockAdjustment(adj: BlockAdjustment): Promise<void> {
  const db = await openDb();
  await put(tx(db, "block_adjustments", "readwrite").objectStore("block_adjustments"), adj);
  db.close();
}

export async function deleteBlockAdjustment(id: string): Promise<void> {
  const db = await openDb();
  await del(tx(db, "block_adjustments", "readwrite").objectStore("block_adjustments"), id);
  db.close();
}

// ── Block Targets ────────────────────────────────────────────────────────────

export interface BlockTarget {
  id: string;       // "project|block"
  project: string;
  block: string;
  prescription: number;
  treesDelivered: number;
}

export async function getAllBlockTargets(): Promise<BlockTarget[]> {
  const db = await openDb();
  const all = await getAll<BlockTarget>(tx(db, "block_targets").objectStore("block_targets"));
  db.close();
  return all;
}

export async function saveBlockTarget(target: BlockTarget): Promise<void> {
  const db = await openDb();
  await put(tx(db, "block_targets", "readwrite").objectStore("block_targets"), target);
  db.close();
}

export async function deleteBlockTarget(id: string): Promise<void> {
  const db = await openDb();
  await del(tx(db, "block_targets", "readwrite").objectStore("block_targets"), id);
  db.close();
}
