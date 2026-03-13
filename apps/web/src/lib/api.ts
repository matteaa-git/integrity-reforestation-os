const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export interface Asset {
  id: string;
  path: string;
  filename: string;
  media_type: "image" | "video";
  width: number | null;
  height: number | null;
  duration: number | null;
  file_size: number;
  created_at: string;
  updated_at: string;
}

export interface AssetListResponse {
  assets: Asset[];
  total: number;
}

export async function fetchAssets(params?: {
  media_type?: string;
  search?: string;
}): Promise<AssetListResponse> {
  const url = new URL(`${API_BASE}/assets`);
  if (params?.media_type) url.searchParams.set("media_type", params.media_type);
  if (params?.search) url.searchParams.set("search", params.search);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch assets: ${res.status}`);
  return res.json();
}

export async function fetchAsset(id: string): Promise<Asset> {
  const res = await fetch(`${API_BASE}/assets/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch asset: ${res.status}`);
  return res.json();
}

export async function indexDirectory(directory: string) {
  const res = await fetch(`${API_BASE}/assets/index-directory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ directory }),
  });
  if (!res.ok) throw new Error(`Failed to index directory: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

export type ContentFormat = "story" | "reel" | "carousel";

export interface DraftAssetEntry {
  id: string;
  draft_id: string;
  asset_id: string;
  position: number;
  asset: Asset;
}

export type DraftStatus = "draft" | "in_review" | "approved" | "rejected" | "scheduled";

export interface Draft {
  id: string;
  title: string;
  format: ContentFormat;
  status: DraftStatus;
  source_asset_id: string | null;
  campaign_id: string | null;
  scheduled_for: string | null;
  schedule_notes: string | null;
  created_at: string;
  updated_at: string;
  assets?: DraftAssetEntry[];
}

export interface DraftListResponse {
  drafts: Draft[];
  total: number;
}

export async function createDraft(data: {
  title: string;
  format: ContentFormat;
}): Promise<Draft> {
  const res = await fetch(`${API_BASE}/drafts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create draft: ${res.status}`);
  return res.json();
}

export async function fetchDrafts(params?: {
  format?: string;
  status?: string;
  scheduled_after?: string;
  scheduled_before?: string;
}): Promise<DraftListResponse> {
  const url = new URL(`${API_BASE}/drafts`);
  if (params?.format) url.searchParams.set("format", params.format);
  if (params?.status) url.searchParams.set("status", params.status);
  if (params?.scheduled_after) url.searchParams.set("scheduled_after", params.scheduled_after);
  if (params?.scheduled_before) url.searchParams.set("scheduled_before", params.scheduled_before);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch drafts: ${res.status}`);
  return res.json();
}

export async function fetchDraft(id: string): Promise<Draft> {
  const res = await fetch(`${API_BASE}/drafts/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch draft: ${res.status}`);
  return res.json();
}

export async function updateDraft(
  id: string,
  data: { title?: string; status?: string },
): Promise<Draft> {
  const res = await fetch(`${API_BASE}/drafts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update draft: ${res.status}`);
  return res.json();
}

export async function addDraftAsset(
  draftId: string,
  assetId: string,
  position?: number,
): Promise<{ assets: DraftAssetEntry[] }> {
  const res = await fetch(`${API_BASE}/drafts/${draftId}/assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ asset_id: assetId, position }),
  });
  if (!res.ok) throw new Error(`Failed to add asset: ${res.status}`);
  return res.json();
}

export async function removeDraftAsset(
  draftId: string,
  assetId: string,
): Promise<{ assets: DraftAssetEntry[] }> {
  const res = await fetch(`${API_BASE}/drafts/${draftId}/assets/${assetId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to remove asset: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Workflow transitions
// ---------------------------------------------------------------------------

export async function submitForReview(draftId: string): Promise<Draft> {
  const res = await fetch(`${API_BASE}/drafts/${draftId}/submit-for-review`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to submit for review: ${res.status}`);
  return res.json();
}

export async function approveDraft(draftId: string): Promise<Draft> {
  const res = await fetch(`${API_BASE}/drafts/${draftId}/approve`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to approve: ${res.status}`);
  return res.json();
}

export async function rejectDraft(draftId: string): Promise<Draft> {
  const res = await fetch(`${API_BASE}/drafts/${draftId}/reject`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to reject: ${res.status}`);
  return res.json();
}

export async function returnToDraft(draftId: string): Promise<Draft> {
  const res = await fetch(`${API_BASE}/drafts/${draftId}/return-to-draft`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to return to draft: ${res.status}`);
  return res.json();
}

export async function scheduleDraft(
  draftId: string,
  data: { scheduled_for: string; notes?: string },
): Promise<Draft> {
  const res = await fetch(`${API_BASE}/drafts/${draftId}/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to schedule: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Ad Creatives
// ---------------------------------------------------------------------------

export type AdCreativeStatus = "draft" | "ready" | "archived";

export interface AdCreative {
  id: string;
  title: string;
  asset_id: string | null;
  draft_id: string | null;
  campaign_id: string | null;
  hook_text: string;
  cta_text: string;
  thumbnail_label: string;
  status: AdCreativeStatus;
  created_at: string;
  updated_at: string;
}

export interface AdCreativeListResponse {
  ad_creatives: AdCreative[];
  total: number;
}

export async function fetchAdCreatives(params?: {
  campaign_id?: string;
  status?: string;
}): Promise<AdCreativeListResponse> {
  const url = new URL(`${API_BASE}/ad-creatives`);
  if (params?.campaign_id) url.searchParams.set("campaign_id", params.campaign_id);
  if (params?.status) url.searchParams.set("status", params.status);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch ad creatives: ${res.status}`);
  return res.json();
}

export async function fetchAdCreative(id: string): Promise<AdCreative> {
  const res = await fetch(`${API_BASE}/ad-creatives/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch ad creative: ${res.status}`);
  return res.json();
}

export async function createAdCreative(data: {
  title: string;
  asset_id?: string;
  campaign_id?: string;
  hook_text?: string;
  cta_text?: string;
  thumbnail_label?: string;
}): Promise<AdCreative> {
  const res = await fetch(`${API_BASE}/ad-creatives`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create ad creative: ${res.status}`);
  return res.json();
}

export async function updateAdCreative(
  id: string,
  data: {
    title?: string;
    campaign_id?: string;
    hook_text?: string;
    cta_text?: string;
    thumbnail_label?: string;
    status?: AdCreativeStatus;
  },
): Promise<AdCreative> {
  const res = await fetch(`${API_BASE}/ad-creatives/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update ad creative: ${res.status}`);
  return res.json();
}

export async function createAdCreativeFromDraft(
  draftId: string,
  data?: { campaign_id?: string; hook_text?: string; cta_text?: string; thumbnail_label?: string },
): Promise<AdCreative> {
  const res = await fetch(`${API_BASE}/ad-creatives/from-draft/${draftId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data ?? {}),
  });
  if (!res.ok) throw new Error(`Failed to create from draft: ${res.status}`);
  return res.json();
}

export async function createAdCreativeFromAsset(
  assetId: string,
  data?: { title?: string; campaign_id?: string; hook_text?: string; cta_text?: string; thumbnail_label?: string },
): Promise<AdCreative> {
  const res = await fetch(`${API_BASE}/ad-creatives/from-asset/${assetId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data ?? {}),
  });
  if (!res.ok) throw new Error(`Failed to create from asset: ${res.status}`);
  return res.json();
}
