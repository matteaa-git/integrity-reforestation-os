const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export interface Asset {
  id: string;
  path: string;
  filename: string;
  media_type: "image" | "video" | "audio";
  width: number | null;
  height: number | null;
  duration: number | null;
  file_size: number;
  extension: string | null;
  relative_path: string | null;
  category: string | null;
  project: string | null;
  pillar: string | null;
  // Integrity library enriched fields
  description: string | null;
  orientation: string | null;
  subject: string | null;
  action: string | null;
  content_type: string | null;   // photo | video | drone | talking_head | timelapse
  ai_keywords: string[] | null;
  ai_confidence: number | null;
  created_at: string;
  updated_at: string;
}

export interface LibraryStatus {
  connected: boolean;
  library_root: string;
  library_path: string;
  total_assets: number;
  images: number;
  videos: number;
  audio: number;
  last_synced_at: string | null;
  sync_in_progress: boolean;
  projects: string[];
  pillars: string[];
}

export interface AssetListResponse {
  assets: Asset[];
  total: number;
}

export async function fetchAssets(params?: {
  media_type?: string;
  search?: string;
  project?: string;
  pillar?: string;
  subject?: string;
  action?: string;
  orientation?: string;
  content_type?: string;
  limit?: number;
  offset?: number;
}): Promise<AssetListResponse> {
  const url = new URL(`${API_BASE}/assets`);
  if (params?.media_type) url.searchParams.set("media_type", params.media_type);
  if (params?.search) url.searchParams.set("search", params.search);
  if (params?.project) url.searchParams.set("project", params.project);
  if (params?.pillar) url.searchParams.set("pillar", params.pillar);
  if (params?.subject) url.searchParams.set("subject", params.subject);
  if (params?.action) url.searchParams.set("action", params.action);
  if (params?.orientation) url.searchParams.set("orientation", params.orientation);
  if (params?.content_type) url.searchParams.set("content_type", params.content_type);
  if (params?.limit !== undefined) url.searchParams.set("limit", String(params.limit));
  if (params?.offset !== undefined) url.searchParams.set("offset", String(params.offset));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch assets: ${res.status}`);
  return res.json();
}

export async function fetchLibraryStatus(): Promise<LibraryStatus> {
  const res = await fetch(`${API_BASE}/assets/library-status`);
  if (!res.ok) throw new Error(`Failed to fetch library status: ${res.status}`);
  return res.json();
}

export async function syncLibrary(): Promise<IndexDirectoryResponse> {
  const res = await fetch(`${API_BASE}/assets/sync-library`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to sync library: ${res.status}`);
  return res.json();
}

export async function fetchAsset(id: string): Promise<Asset> {
  const res = await fetch(`${API_BASE}/assets/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch asset: ${res.status}`);
  return res.json();
}

export interface IndexDirectoryResponse {
  indexed_count: number;
  skipped_count: number;
  duplicate_count: number;
  invalid_count: number;
  scanned_root: string;
  errors: string[];
}

export async function uploadAsset(file: File): Promise<Asset> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/assets/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.detail ?? `Upload failed: ${res.status}`);
  }
  return res.json();
}

export async function indexDirectory(directory?: string): Promise<IndexDirectoryResponse> {
  const res = await fetch(`${API_BASE}/assets/index-directory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(directory ? { directory } : {}),
  });
  if (!res.ok) throw new Error(`Failed to index directory: ${res.status}`);
  return res.json();
}

export async function setLibraryPath(path: string): Promise<IndexDirectoryResponse> {
  const res = await fetch(`${API_BASE}/assets/set-library-path`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error(`Failed to set library path: ${res.status}`);
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

export type DraftStatus = "draft" | "in_review" | "approved" | "rejected" | "scheduled" | "publishing" | "published" | "publish_failed" | "failed";

export interface Draft {
  id: string;
  title: string;
  format: ContentFormat;
  status: DraftStatus;
  source_asset_id: string | null;
  campaign_id: string | null;
  caption: string | null;
  hashtags: string | null;
  scheduled_for: string | null;
  schedule_notes: string | null;
  metadata: Record<string, unknown> | null;
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
  metadata?: Record<string, unknown>;
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
  data: { title?: string; status?: string; caption?: string; hashtags?: string; metadata?: Record<string, unknown> },
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

export async function deleteDraft(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/drafts/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete draft: ${res.status}`);
}

export async function duplicateDraft(id: string): Promise<Draft> {
  const res = await fetch(`${API_BASE}/drafts/${id}/duplicate`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to duplicate draft: ${res.status}`);
  return res.json();
}

export async function copyAsCarousel(id: string): Promise<{ id: string; draft: Draft }> {
  const res = await fetch(`${API_BASE}/drafts/${id}/copy-as-carousel`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to copy as carousel: ${res.status}`);
  return res.json();
}

export async function rescheduleDraft(
  id: string,
  scheduled_for: string,
): Promise<Draft> {
  const res = await fetch(`${API_BASE}/drafts/${id}/reschedule`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scheduled_for }),
  });
  if (!res.ok) throw new Error(`Failed to reschedule draft: ${res.status}`);
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

// ---------------------------------------------------------------------------
// Reel Templates
// ---------------------------------------------------------------------------

export interface TemplateClipSlot {
  position: number;
  label: string;
  locked_asset_id: string | null;
  duration: number | null;
}

export interface TemplateCaptionSlot {
  text: string;
  start_time: number;
  end_time: number;
  style: string;
}

export interface ReelTemplate {
  id: string;
  name: string;
  category: string;
  tags: string[];
  hook_text: string;
  cta_text: string;
  clip_slots: TemplateClipSlot[];
  captions: TemplateCaptionSlot[];
  music_asset_id: string | null;
  thumbnail_asset_id: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateListResponse {
  templates: ReelTemplate[];
  total: number;
}

export async function fetchTemplates(category?: string): Promise<TemplateListResponse> {
  const url = new URL(`${API_BASE}/templates`);
  if (category) url.searchParams.set("category", category);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch templates: ${res.status}`);
  return res.json();
}

export async function fetchTemplate(id: string): Promise<ReelTemplate> {
  const res = await fetch(`${API_BASE}/templates/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch template: ${res.status}`);
  return res.json();
}

export async function createTemplate(data: {
  name: string;
  category?: string;
  tags?: string[];
  hook_text?: string;
  cta_text?: string;
  clip_slots?: TemplateClipSlot[];
  captions?: TemplateCaptionSlot[];
  music_asset_id?: string;
  thumbnail_asset_id?: string;
}): Promise<ReelTemplate> {
  const res = await fetch(`${API_BASE}/templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create template: ${res.status}`);
  return res.json();
}

export async function updateTemplate(
  id: string,
  data: Partial<{
    name: string;
    category: string;
    tags: string[];
    hook_text: string;
    cta_text: string;
    clip_slots: TemplateClipSlot[];
    captions: TemplateCaptionSlot[];
    music_asset_id: string | null;
    thumbnail_asset_id: string | null;
  }>,
): Promise<ReelTemplate> {
  const res = await fetch(`${API_BASE}/templates/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update template: ${res.status}`);
  return res.json();
}

export async function deleteTemplate(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/templates/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete template: ${res.status}`);
}

export async function useTemplate(id: string): Promise<ReelTemplate> {
  const res = await fetch(`${API_BASE}/templates/${id}/use`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to use template: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Hook Bank
// ---------------------------------------------------------------------------

export type HookCategory =
  | "curiosity"
  | "shock"
  | "authority"
  | "story"
  | "contrarian"
  | "transformation";

export type HookFormat = "carousel" | "reel" | "story" | "universal";

export interface Hook {
  id: string;
  hook_text: string;
  hook_category: HookCategory;
  topic_tags: string[];
  emotion_tags: string[];
  format: HookFormat;
  performance_score: number;
  times_used: number;
  saves: number;
  shares: number;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface HookListResponse {
  hooks: Hook[];
  total: number;
}

export async function fetchHooks(params?: {
  category?: HookCategory;
  topic?: string;
  emotion?: string;
  format?: HookFormat;
  min_score?: number;
  search?: string;
  favorites_only?: boolean;
  sort_by?: string;
  limit?: number;
}): Promise<HookListResponse> {
  const url = new URL(`${API_BASE}/hooks`);
  if (params?.category) url.searchParams.set("category", params.category);
  if (params?.topic) url.searchParams.set("topic", params.topic);
  if (params?.emotion) url.searchParams.set("emotion", params.emotion);
  if (params?.format) url.searchParams.set("format", params.format);
  if (params?.min_score != null) url.searchParams.set("min_score", String(params.min_score));
  if (params?.search) url.searchParams.set("search", params.search);
  if (params?.favorites_only) url.searchParams.set("favorites_only", "true");
  if (params?.sort_by) url.searchParams.set("sort_by", params.sort_by);
  if (params?.limit) url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch hooks: ${res.status}`);
  return res.json();
}

export async function suggestHooks(params?: {
  topic?: string;
  format?: HookFormat;
  limit?: number;
}): Promise<HookListResponse> {
  const url = new URL(`${API_BASE}/hooks/suggest`);
  if (params?.topic) url.searchParams.set("topic", params.topic);
  if (params?.format) url.searchParams.set("format", params.format);
  if (params?.limit) url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to suggest hooks: ${res.status}`);
  return res.json();
}

export async function createHook(data: {
  hook_text: string;
  hook_category?: HookCategory;
  topic_tags?: string[];
  emotion_tags?: string[];
  format?: HookFormat;
  performance_score?: number;
}): Promise<Hook> {
  const res = await fetch(`${API_BASE}/hooks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create hook: ${res.status}`);
  return res.json();
}

export async function updateHook(
  id: string,
  data: Partial<{
    hook_text: string;
    hook_category: HookCategory;
    topic_tags: string[];
    emotion_tags: string[];
    format: HookFormat;
    performance_score: number;
    is_favorite: boolean;
  }>,
): Promise<Hook> {
  const res = await fetch(`${API_BASE}/hooks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update hook: ${res.status}`);
  return res.json();
}

export async function deleteHook(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/hooks/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete hook: ${res.status}`);
}

export async function useHook(id: string): Promise<{ times_used: number }> {
  const res = await fetch(`${API_BASE}/hooks/${id}/use`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to track hook use: ${res.status}`);
  return res.json();
}

export async function toggleHookFavorite(id: string): Promise<{ is_favorite: boolean }> {
  const res = await fetch(`${API_BASE}/hooks/${id}/favorite`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to toggle favorite: ${res.status}`);
  return res.json();
}

export async function generateHooks(data: {
  topic: string;
  emotion?: string;
  content_type?: string;
  hook_category?: HookCategory;
  count?: number;
  save_to_bank?: boolean;
}): Promise<{ hooks: Hook[]; count: number; saved: boolean }> {
  const res = await fetch(`${API_BASE}/hooks/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to generate hooks: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Content Intelligence Engine
// ---------------------------------------------------------------------------

export interface ScoreFactor {
  label: string;
  impact: number;
  description: string;
}

export interface ContentScore {
  viral_probability: number;
  predicted_reach_low: number;
  predicted_reach_high: number;
  engagement_probability: number;
  hook_strength: number;
  save_potential: number;
  share_potential: number;
  content_category: string;
  confidence: number;
  factors: ScoreFactor[];
  recommendations: string[];
}

export interface ContentScoreRequest {
  title: string;
  format: string;
  hook_text?: string;
  caption?: string;
  content_category?: string;
  asset_count?: number;
  has_video?: boolean;
  pillar?: string;
  ai_keywords?: string[];
}

export interface ScoredDraftItem extends ContentScore {
  draft_id: string;
  title: string;
  format: string;
  status: string;
  scheduled_for: string | null;
}

export interface ContentScoresResponse {
  items: ScoredDraftItem[];
  total: number;
}

export async function scoreContent(data: ContentScoreRequest): Promise<ContentScore> {
  const res = await fetch(`${API_BASE}/intelligence/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to score content: ${res.status}`);
  return res.json();
}

export async function scoreDraft(draftId: string): Promise<ContentScore> {
  const res = await fetch(`${API_BASE}/intelligence/score/${draftId}`);
  if (!res.ok) throw new Error(`Failed to score draft: ${res.status}`);
  return res.json();
}

export async function fetchContentScores(status?: string): Promise<ContentScoresResponse> {
  const url = new URL(`${API_BASE}/intelligence/scores`);
  if (status) url.searchParams.set("status", status);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch content scores: ${res.status}`);
  return res.json();
}

// Trend Radar

export interface TrendItem {
  id: string;
  topic: string;
  platform: string;
  trend_score: number;
  velocity: "rising" | "peak" | "declining";
  volume_label: string;
  content_angle: string;
  content_formats: string[];
  tags: string[];
  relevance_to_brand: number;
  opportunity_window: string;
}

export interface TrendRadarResponse {
  trends: TrendItem[];
  last_updated: string;
  top_opportunity: TrendItem | null;
}

export async function fetchTrends(): Promise<TrendRadarResponse> {
  const res = await fetch(`${API_BASE}/intelligence/trends`);
  if (!res.ok) throw new Error(`Failed to fetch trends: ${res.status}`);
  return res.json();
}

// Hook Analyzer

export interface HookSuggestion {
  text: string;
  category: string;
  estimated_score_delta: number;
}

export interface HookAnalysis {
  hook_text: string;
  overall_score: number;
  curiosity_score: number;
  clarity_score: number;
  urgency_score: number;
  emotional_pull: number;
  word_count: number;
  optimal_length: boolean;
  strengths: string[];
  weaknesses: string[];
  suggestions: HookSuggestion[];
}

export async function analyzeHook(hook_text: string, target_format?: string): Promise<HookAnalysis> {
  const res = await fetch(`${API_BASE}/intelligence/analyze-hook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hook_text, target_format: target_format ?? "universal" }),
  });
  if (!res.ok) throw new Error(`Failed to analyze hook: ${res.status}`);
  return res.json();
}

// Portfolio Optimizer

export interface PortfolioFormatBreakdown {
  reels: number;
  carousels: number;
  stories: number;
  posts: number;
  total: number;
  reels_pct: number;
  carousels_pct: number;
  stories_pct: number;
  ideal_reels_pct: number;
  ideal_carousels_pct: number;
  ideal_stories_pct: number;
}

export interface PortfolioNarrativeBreakdown {
  education: number;
  entertainment: number;
  story: number;
  authority: number;
  total: number;
  education_pct: number;
  entertainment_pct: number;
  story_pct: number;
  authority_pct: number;
}

export interface PortfolioRecommendation {
  priority: "high" | "medium" | "low";
  action: string;
  reason: string;
  suggested_format: string | null;
  suggested_topic: string | null;
}

export interface PortfolioAnalysis {
  week_label: string;
  format_breakdown: PortfolioFormatBreakdown;
  narrative_breakdown: PortfolioNarrativeBreakdown;
  portfolio_score: number;
  recommendations: PortfolioRecommendation[];
  next_best_content: string;
  next_best_reason: string;
}

export async function fetchPortfolioAnalysis(): Promise<PortfolioAnalysis> {
  const res = await fetch(`${API_BASE}/intelligence/portfolio`);
  if (!res.ok) throw new Error(`Failed to fetch portfolio: ${res.status}`);
  return res.json();
}

// Growth Flywheel

export interface FlywheelStage {
  key: string;
  label: string;
  value: number;
  unit: string;
  delta: string | null;
  status: "healthy" | "warning" | "critical";
  icon: string;
}

export interface FlywheelMetrics {
  stages: FlywheelStage[];
  bottleneck: string | null;
  bottleneck_tip: string | null;
  ai_recommendation: string;
  next_action: string;
  content_velocity: number;
  avg_viral_score: number;
  pipeline_health: number;
}

export async function fetchFlywheelMetrics(): Promise<FlywheelMetrics> {
  const res = await fetch(`${API_BASE}/intelligence/flywheel`);
  if (!res.ok) throw new Error(`Failed to fetch flywheel: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Instagram Integration
// ---------------------------------------------------------------------------

export interface InstagramPost {
  id: string;
  timestamp: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  caption: string | null;
  permalink: string;
  like_count: number;
  comments_count: number;
  thumbnail_url: string | null;
  media_url: string | null;
  insights: {
    reach?: number;
    impressions?: number;
    saved?: number;
    shares?: number;
    video_views?: number;
    plays?: number;
    profile_visits?: number;
    follows?: number;
  };
}

export interface InstagramStatus {
  connected: boolean;
  configured?: boolean;
  auth_url?: string | null;
  ig_user_id?: string;
  username?: string;
  account_type?: string;
  followers_count?: number;
  media_count?: number;
  profile_picture_url?: string | null;
  last_synced_at?: string | null;
  post_count?: number;
  total_reach?: number;
  total_saves?: number;
  total_shares?: number;
  total_impressions?: number;
  avg_engagement_rate?: number;
}

export async function fetchInstagramStatus(): Promise<InstagramStatus> {
  const res = await fetch(`${API_BASE}/instagram/status`);
  if (!res.ok) throw new Error(`Failed to fetch Instagram status: ${res.status}`);
  return res.json();
}

export async function syncInstagram(): Promise<{ synced: number; errors: string[] }> {
  const res = await fetch(`${API_BASE}/instagram/sync`, { method: "POST" });
  if (!res.ok) throw new Error(`Instagram sync failed: ${res.status}`);
  return res.json();
}

export async function disconnectInstagram(): Promise<void> {
  await fetch(`${API_BASE}/instagram/disconnect`, { method: "POST" });
}

export async function fetchInstagramPosts(limit = 50): Promise<{ posts: InstagramPost[]; total: number }> {
  const res = await fetch(`${API_BASE}/instagram/posts?limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to fetch Instagram posts: ${res.status}`);
  return res.json();
}

export interface InstagramAnalytics {
  account: {
    username: string;
    followers_count: number;
    media_count: number;
    profile_picture_url?: string;
    last_synced_at?: string;
  };
  summary: {
    total_posts: number;
    total_reach: number;
    total_impressions: number;
    total_saves: number;
    total_shares: number;
    total_likes: number;
    total_comments: number;
    avg_engagement_rate: number;
  };
  follower_growth: { value: number; end_time: string }[];
  daily_metrics: Record<string, { value: number; end_time: string }[]>;
  audience: {
    audience_gender_age?: Record<string, number>;
    audience_country?: Record<string, number>;
    audience_city?: Record<string, number>;
  };
  content_mix: {
    type: string;
    count: number;
    avg_reach: number;
    avg_engagement: number;
    avg_saves: number;
  }[];
  posts: InstagramPost[];
  top_by_engagement: InstagramPost[];
  top_by_reach: InstagramPost[];
  top_by_saves: InstagramPost[];
  best_hours: number[];
  best_days: string[];
}

export async function fetchInstagramAnalytics(): Promise<InstagramAnalytics> {
  const res = await fetch(`${API_BASE}/instagram/analytics`);
  if (!res.ok) throw new Error(`Failed to fetch Instagram analytics: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Narrative Dominance Engine
// ---------------------------------------------------------------------------

export interface NarrativeSignal {
  id: string;
  signal_type: "environmental" | "cultural" | "political" | "social" | "trend";
  title: string;
  description: string;
  urgency: number;
  relevance: number;
  opportunity_window: string;
  narrative_angle: string;
  platforms: string[];
  tags: string[];
  status: "active" | "fading" | "emerging";
  detected_at: string;
}

export interface SignalListResponse {
  signals: NarrativeSignal[];
  total: number;
  active_count: number;
  emerging_count: number;
}

export interface NarrativeOpportunity {
  id: string;
  signal_id: string | null;
  title: string;
  narrative_type: string;
  impact_score: number;
  urgency_score: number;
  brand_fit: number;
  composite_score: number;
  recommended_action: string;
  content_formats: string[];
  estimated_reach: string;
  priority: "critical" | "high" | "medium" | "low";
  window_closes: string;
  key_angle: string;
}

export interface OpportunityListResponse {
  opportunities: NarrativeOpportunity[];
  total: number;
  critical_count: number;
  high_count: number;
}

export interface NarrativeBeat {
  beat_number: number;
  title: string;
  description: string;
  content_format: string;
  hook_suggestion: string;
  asset_category: string | null;
}

export interface NarrativeArc {
  id: string;
  title: string;
  narrative_type: string;
  protagonist: string;
  tension: string;
  resolution: string;
  beats: NarrativeBeat[];
  arc_length: number;
  estimated_duration: string;
  key_messages: string[];
  cta: string;
  emotional_arc: string;
  created_at: string;
}

export interface ArcListResponse {
  arcs: NarrativeArc[];
  total: number;
}

export interface ThreadTweet {
  position: number;
  text: string;
  char_count: number;
  engagement_hook: string | null;
  media_suggestion: string | null;
}

export interface NarrativeThread {
  id: string;
  narrative_id: string | null;
  title: string;
  platform: string;
  hook_tweet: string;
  tweets: ThreadTweet[];
  thread_length: number;
  estimated_impressions: string;
  hook_score: number;
  created_at: string;
}

export interface ThreadListResponse {
  threads: NarrativeThread[];
  total: number;
}

export interface PlanterImpactMetrics {
  trees_planted: number;
  hectares_restored: number;
  communities_served: number;
  years_active: number;
}

export interface PlanterCharacter {
  id: string;
  name: string;
  role: string;
  location: string;
  story_arc: string;
  quote: string;
  narrative_tags: string[];
  photo_asset_id: string | null;
  impact_metrics: PlanterImpactMetrics;
  content_angle: string;
  story_beats: string[];
  emotional_profile: string;
  created_at: string;
}

export interface PlanterListResponse {
  planters: PlanterCharacter[];
  total: number;
}

export interface SignalAlert {
  level: "info" | "warning" | "critical";
  message: string;
  timestamp: string;
}

export interface NarrativePerformanceRow {
  narrative: string;
  reach: number;
  engagement: number;
  momentum: "rising" | "stable" | "declining";
  posts_count: number;
}

export interface WarRoomMetrics {
  narrative_velocity: number;
  active_narratives: number;
  narrative_reach_7d: number;
  top_narrative: string;
  signals_detected: number;
  opportunities_open: number;
  content_pipeline: {
    drafts: number;
    in_review: number;
    approved: number;
    scheduled: number;
  };
  signal_alerts: SignalAlert[];
  narrative_performance: NarrativePerformanceRow[];
}

export interface CrossPlatformPlan {
  narrative_id: string | null;
  narrative_title: string;
  source_narrative: string;
  twitter_thread: {
    hook: string;
    posts: string[];
    cta: string;
    estimated_impressions: string;
  };
  instagram_carousel: {
    slide_count: number;
    slides: string[];
    caption: string;
    hashtags: string[];
  };
  instagram_reel: {
    concept: string;
    hook: string;
    script_beats: string[];
    cta: string;
    recommended_duration: string;
    sound_suggestion: string;
  };
  tiktok: {
    concept: string;
    hook: string;
    structure: string[];
    sound_suggestion: string;
    trend_angle: string;
  };
  youtube: {
    title: string;
    description: string;
    chapters: string[];
    thumbnail_concept: string;
    format: string;
  };
  substack: {
    title: string;
    subtitle: string;
    intro: string;
    body_outline: string[];
    conclusion: string;
    cta: string;
  };
  total_content_pieces: number;
  estimated_total_reach: string;
}

export async function fetchNarrativeSignals(params?: {
  status?: string;
  signal_type?: string;
  min_urgency?: number;
}): Promise<SignalListResponse> {
  const url = new URL(`${API_BASE}/narrative/signals`);
  if (params?.status) url.searchParams.set("status", params.status);
  if (params?.signal_type) url.searchParams.set("signal_type", params.signal_type);
  if (params?.min_urgency) url.searchParams.set("min_urgency", String(params.min_urgency));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch narrative signals: ${res.status}`);
  return res.json();
}

export async function fetchNarrativeOpportunities(params?: {
  priority?: string;
  narrative_type?: string;
  min_score?: number;
}): Promise<OpportunityListResponse> {
  const url = new URL(`${API_BASE}/narrative/opportunities`);
  if (params?.priority) url.searchParams.set("priority", params.priority);
  if (params?.narrative_type) url.searchParams.set("narrative_type", params.narrative_type);
  if (params?.min_score) url.searchParams.set("min_score", String(params.min_score));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch opportunities: ${res.status}`);
  return res.json();
}

export async function fetchNarrativeArcs(): Promise<ArcListResponse> {
  const res = await fetch(`${API_BASE}/narrative/arcs`);
  if (!res.ok) throw new Error(`Failed to fetch arcs: ${res.status}`);
  return res.json();
}

export async function generateNarrativeArc(data: {
  topic: string;
  narrative_type?: string;
  protagonist?: string;
  arc_length?: number;
}): Promise<NarrativeArc> {
  const res = await fetch(`${API_BASE}/narrative/generate-arc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to generate arc: ${res.status}`);
  return res.json();
}

export async function fetchNarrativeThreads(platform?: string): Promise<ThreadListResponse> {
  const url = new URL(`${API_BASE}/narrative/threads`);
  if (platform) url.searchParams.set("platform", platform);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch threads: ${res.status}`);
  return res.json();
}

export async function buildNarrativeThread(data: {
  topic: string;
  platform?: string;
  thread_length?: number;
  narrative_id?: string;
}): Promise<NarrativeThread> {
  const res = await fetch(`${API_BASE}/narrative/build-thread`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to build thread: ${res.status}`);
  return res.json();
}

export async function fetchPlanters(story_arc?: string): Promise<PlanterListResponse> {
  const url = new URL(`${API_BASE}/narrative/planters`);
  if (story_arc) url.searchParams.set("story_arc", story_arc);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch planters: ${res.status}`);
  return res.json();
}

export async function fetchWarRoomMetrics(): Promise<WarRoomMetrics> {
  const res = await fetch(`${API_BASE}/narrative/warroom`);
  if (!res.ok) throw new Error(`Failed to fetch war room metrics: ${res.status}`);
  return res.json();
}

export async function multiplyNarrative(data: {
  narrative_title: string;
  core_message: string;
  narrative_type?: string;
  narrative_id?: string;
}): Promise<CrossPlatformPlan> {
  const res = await fetch(`${API_BASE}/narrative/multiply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to multiply narrative: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Live Signal Intelligence (Signal → Narrative → Content workflow)
// ---------------------------------------------------------------------------

export interface LiveSignal {
  id: string;
  title: string;
  source: string;
  source_type: string;
  url: string | null;
  timestamp: string;
  raw_text: string;
  summary: string;
  category: string;
  urgency_score: number;
  relevance_score: number;
  emotion_score: number;
  trend_velocity: number;
  lifespan_estimate: string;
  opportunity_score: number;
  status: "active" | "emerging" | "fading";
  tags: string[];
  is_saved: boolean;
  narrative_id: string | null;
}

export interface LiveSignalFeedResponse {
  signals: LiveSignal[];
  total: number;
  active_count: number;
  emerging_count: number;
  last_refreshed: string;
}

export interface SignalStatsResponse {
  total_signals: number;
  active_signals: number;
  emerging_signals: number;
  avg_opportunity_score: number;
  top_category: string;
  top_signal_title: string;
  top_signal_score: number;
  last_refreshed: string;
  refresh_in_seconds: number;
  source_breakdown: Record<string, number>;
  daily_top_opportunities: Record<string, unknown>[];
}

export interface GeneratedNarrative {
  narrative_id: string;
  signal_id: string;
  signal_title: string;
  recommended_angle: string;
  stance: string;
  core_message: string;
  emotional_frame: string;
  audience: string;
  call_to_action: string;
  content_formats: string[];
  urgency_window: string;
  opportunity_score: number;
  tags: string[];
  created_at: string;
  enriched_by_ai: boolean;
}

export interface ThreadPost {
  position: number;
  text: string;
  char_count: number;
  engagement_hook: string | null;
  media_suggestion: string | null;
}

export interface GeneratedContent {
  content_id: string;
  narrative_id: string | null;
  signal_id: string | null;
  generated_at: string;
  x_thread: ThreadPost[];
  instagram_carousel: Record<string, unknown>;
  reel_script: Record<string, unknown>;
  story_sequence: Record<string, unknown>[];
  substack: Record<string, unknown>;
  ai_enhanced: boolean;
}

export interface AssetMatch {
  asset: Asset;
  match_score: number;
  match_reason: string;
  recommended_for: string;
}

export interface MediaMatchResponse {
  signal_id: string;
  narrative_id: string | null;
  matched_assets: AssetMatch[];
  total_library_assets: number;
  search_tags: string[];
}

export interface RecommendedAction {
  action: string;
  platform: string;
  deadline_window: string;
  reason: string;
  signal_title: string;
  signal_score: number;
  suggested_format: string;
  suggested_asset_type: string;
  urgency_level: "critical" | "high" | "medium" | "low";
}

export interface ActionPanelResponse {
  primary_action: RecommendedAction;
  secondary_actions: RecommendedAction[];
  total_open_windows: number;
  next_deadline: string;
}

export interface RefreshResponse {
  status: string;
  signals_ingested: number;
  new_signals: number;
  elapsed_seconds: number;
  next_refresh_in: number;
}

export async function fetchLiveSignals(params?: {
  category?: string;
  status?: string;
  min_score?: number;
  limit?: number;
}): Promise<LiveSignalFeedResponse> {
  const url = new URL(`${API_BASE}/signals/latest`);
  if (params?.category) url.searchParams.set("category", params.category);
  if (params?.status) url.searchParams.set("status", params.status);
  if (params?.min_score != null) url.searchParams.set("min_score", String(params.min_score));
  if (params?.limit) url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch live signals: ${res.status}`);
  return res.json();
}

export async function fetchTrendingSignals(limit?: number): Promise<LiveSignalFeedResponse> {
  const url = new URL(`${API_BASE}/signals/trending`);
  if (limit) url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch trending signals: ${res.status}`);
  return res.json();
}

export async function fetchSignalStats(): Promise<SignalStatsResponse> {
  const res = await fetch(`${API_BASE}/signals/stats`);
  if (!res.ok) throw new Error(`Failed to fetch signal stats: ${res.status}`);
  return res.json();
}

export async function refreshSignals(): Promise<RefreshResponse> {
  const res = await fetch(`${API_BASE}/signals/refresh`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to refresh signals: ${res.status}`);
  return res.json();
}

export async function saveSignal(signalId: string): Promise<{ status: string; signal_id: string }> {
  const res = await fetch(`${API_BASE}/signals/${signalId}/save`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to save signal: ${res.status}`);
  return res.json();
}

export async function buildNarrativeFromSignal(signalId: string): Promise<GeneratedNarrative> {
  const res = await fetch(`${API_BASE}/signals/${signalId}/build-narrative`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to build narrative: ${res.status}`);
  return res.json();
}

export async function getSignalNarrative(signalId: string): Promise<GeneratedNarrative> {
  const res = await fetch(`${API_BASE}/signals/${signalId}/narrative`);
  if (!res.ok) throw new Error(`Failed to get narrative: ${res.status}`);
  return res.json();
}

export async function generateSignalContent(signalId: string): Promise<GeneratedContent> {
  const res = await fetch(`${API_BASE}/signals/${signalId}/generate-content`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to generate content: ${res.status}`);
  return res.json();
}

export async function matchSignalMedia(signalId: string, limit?: number): Promise<MediaMatchResponse> {
  const url = new URL(`${API_BASE}/signals/${signalId}/media-match`);
  if (limit) url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to match media: ${res.status}`);
  return res.json();
}

export async function fetchRecommendedActions(): Promise<ActionPanelResponse> {
  const res = await fetch(`${API_BASE}/signals/recommended-actions`);
  if (!res.ok) throw new Error(`Failed to fetch recommended actions: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Narrative Response Engine
// ---------------------------------------------------------------------------

export interface NarrativeTopic {
  topic_id: string;
  title: string;
  summary: string;
  signal_count: number;
  sources: string[];
  keywords: string[];
  opportunity_score: number;
  conversation_velocity: number;
  controversy_score: number;
  engagement_potential: number;
  relevance_score: number;
  search_volume_estimate: number;
  trend_direction: string;
  status: string;
  category: string;
  lifespan_estimate: string;
  signal_ids: string[];
  top_signal_title: string;
  top_signal_url: string | null;
  created_at: string;
}

export interface NarrativeTopicListResponse {
  topics: NarrativeTopic[];
  total: number;
  respond_now_count: number;
  good_opportunity_count: number;
  last_clustered: string;
}

export interface ResponseQueueItem {
  item_id: string;
  topic_id: string;
  topic_title: string;
  platform: string;
  content_type: string;
  status: string;
  content: Record<string, unknown>;
  created_at: string;
  scheduled_for: string | null;
}

export interface ResponseQueueListResponse {
  items: ResponseQueueItem[];
  total: number;
  draft_count: number;
  review_count: number;
  approved_count: number;
  scheduled_count: number;
}

export async function fetchNarrativeTopics(params?: {
  status?: string;
  category?: string;
  min_score?: number;
  limit?: number;
}): Promise<NarrativeTopicListResponse> {
  const url = new URL(`${API_BASE}/narrative-response/topics`);
  if (params?.status)    url.searchParams.set("status", params.status);
  if (params?.category)  url.searchParams.set("category", params.category);
  if (params?.min_score != null) url.searchParams.set("min_score", String(params.min_score));
  if (params?.limit)     url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch narrative topics: ${res.status}`);
  return res.json();
}

export async function reclusterTopics(): Promise<NarrativeTopicListResponse> {
  const res = await fetch(`${API_BASE}/narrative-response/topics/recluster`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to recluster: ${res.status}`);
  return res.json();
}

export async function fetchResponseQueue(params?: {
  status?: string;
  platform?: string;
}): Promise<ResponseQueueListResponse> {
  const url = new URL(`${API_BASE}/narrative-response/queue`);
  if (params?.status)   url.searchParams.set("status", params.status);
  if (params?.platform) url.searchParams.set("platform", params.platform);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch queue: ${res.status}`);
  return res.json();
}

export async function addToResponseQueue(data: {
  topic_id: string;
  topic_title: string;
  platform: string;
  content_type: string;
  content: Record<string, unknown>;
}): Promise<ResponseQueueItem> {
  const res = await fetch(`${API_BASE}/narrative-response/queue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to add to queue: ${res.status}`);
  return res.json();
}

export async function updateResponseQueueItem(
  itemId: string,
  data: { status?: string; content?: Record<string, unknown>; scheduled_for?: string },
): Promise<ResponseQueueItem> {
  const res = await fetch(`${API_BASE}/narrative-response/queue/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update queue item: ${res.status}`);
  return res.json();
}

export async function deleteResponseQueueItem(itemId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/narrative-response/queue/${itemId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete queue item: ${res.status}`);
}

// ---------------------------------------------------------------------------
// X Post Studio
// ---------------------------------------------------------------------------

export interface XMediaItem {
  asset_id?: string;
  url?: string;
  media_type: "image" | "video";
  alt_text?: string;
}

export interface XThreadPost {
  position: number;
  text: string;
  char_count: number;
  media?: XMediaItem[];
}

export interface XPost {
  id: string;
  content: string;
  post_type: string;
  thread_posts: XThreadPost[];
  media: XMediaItem[];
  status: string;
  hook_score: number;
  estimated_reach: number;
  topic_signal: string | null;
  scheduled_time: string | null;
  published_time: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface XPostListResponse {
  posts: XPost[];
  total: number;
  draft_count: number;
  pending_count: number;
  scheduled_count: number;
  published_count: number;
}

export interface XAnalytics {
  total_posts: number;
  total_impressions: number;
  total_engagements: number;
  total_reposts: number;
  total_replies: number;
  avg_hook_score: number;
  top_post_id: string | null;
  top_post_preview: string | null;
  top_post_impressions: number;
  followers_gained: number;
}

export interface XMultiplyResult {
  source_post_id: string;
  linkedin_post: Record<string, unknown>;
  instagram_carousel: Record<string, unknown>;
  substack_outline: Record<string, unknown>;
  youtube_script: Record<string, unknown>;
  instagram_caption: Record<string, unknown>;
  generated_at: string;
}

export async function createXDraft(data: {
  content: string;
  post_type: string;
  thread_posts?: XThreadPost[];
  media?: XMediaItem[];
  hook_score?: number;
  estimated_reach?: number;
  topic_signal?: string;
}): Promise<XPost> {
  const res = await fetch(`${API_BASE}/x/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create X draft: ${res.status}`);
  return res.json();
}

export async function listXDrafts(params?: { status?: string; limit?: number }): Promise<XPostListResponse> {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.limit !== undefined) q.set("limit", String(params.limit));
  const res = await fetch(`${API_BASE}/x/drafts?${q}`);
  if (!res.ok) throw new Error(`Failed to list X drafts: ${res.status}`);
  return res.json();
}

export async function getXPost(postId: string): Promise<XPost> {
  const res = await fetch(`${API_BASE}/x/${postId}`);
  if (!res.ok) throw new Error(`Failed to get X post: ${res.status}`);
  return res.json();
}

export async function updateXPost(postId: string, data: Partial<{
  content: string;
  post_type: string;
  thread_posts: XThreadPost[];
  hook_score: number;
  estimated_reach: number;
  status: string;
  scheduled_time: string;
}>): Promise<XPost> {
  const res = await fetch(`${API_BASE}/x/${postId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update X post: ${res.status}`);
  return res.json();
}

export async function deleteXPost(postId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/x/${postId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete X post: ${res.status}`);
}

export async function submitXApproval(postId: string): Promise<XPost> {
  const res = await fetch(`${API_BASE}/x/${postId}/submit-approval`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to submit X post for approval: ${res.status}`);
  return res.json();
}

export async function scheduleXPost(postId: string, scheduledTime: string): Promise<XPost> {
  const res = await fetch(`${API_BASE}/x/${postId}/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scheduled_time: scheduledTime }),
  });
  if (!res.ok) throw new Error(`Failed to schedule X post: ${res.status}`);
  return res.json();
}

export async function publishXPost(postId: string): Promise<XPost> {
  const res = await fetch(`${API_BASE}/x/${postId}/publish`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to publish X post: ${res.status}`);
  return res.json();
}

export async function fetchXAnalytics(): Promise<XAnalytics> {
  const res = await fetch(`${API_BASE}/x/analytics/summary`);
  if (!res.ok) throw new Error(`Failed to fetch X analytics: ${res.status}`);
  return res.json();
}

export async function multiplyXPost(postId: string): Promise<XMultiplyResult> {
  const res = await fetch(`${API_BASE}/x/${postId}/multiply`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to multiply X post: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// X Account Connection
// ---------------------------------------------------------------------------

export interface XAccountStatus {
  connected: boolean;
  configured?: boolean;
  x_user_id?: string;
  username?: string;
  name?: string;
  profile_image_url?: string | null;
  followers_count?: number;
  following_count?: number;
  tweet_count?: number;
  last_synced_at?: string | null;
  post_count?: number;
  total_impressions?: number;
  total_engagements?: number;
  total_reposts?: number;
  avg_engagement_rate?: number;
}

export interface XCachedPost {
  tweet_id: string;
  text: string;
  created_at: string | null;
  impressions: number;
  likes: number;
  repost_count: number;
  replies: number;
  engagements: number;
}

export async function fetchXAccountStatus(): Promise<XAccountStatus> {
  const res = await fetch(`${API_BASE}/x/account/status`);
  if (!res.ok) throw new Error(`Failed to fetch X account status: ${res.status}`);
  return res.json();
}

export async function fetchXAccountAuthUrl(): Promise<{ auth_url: string }> {
  const res = await fetch(`${API_BASE}/x/account/auth-url`);
  if (!res.ok) throw new Error(`Failed to get X auth URL: ${res.status}`);
  return res.json();
}

export async function syncXAccount(): Promise<{ synced: number; errors: string[] }> {
  const res = await fetch(`${API_BASE}/x/account/sync`, { method: "POST" });
  if (!res.ok) throw new Error(`X sync failed: ${res.status}`);
  return res.json();
}

export async function disconnectXAccount(): Promise<void> {
  await fetch(`${API_BASE}/x/account/disconnect`, { method: "POST" });
}

export async function fetchXAccountPosts(limit = 20): Promise<{ posts: XCachedPost[]; total: number }> {
  const res = await fetch(`${API_BASE}/x/account/posts?limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to fetch X posts: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Pinterest Account Connection
// ---------------------------------------------------------------------------

export interface PinterestAccountStatus {
  connected: boolean;
  configured?: boolean;
  pinterest_user_id?: string;
  username?: string;
  account_type?: string;
  profile_image?: string | null;
  website_url?: string | null;
  follower_count?: number;
  following_count?: number;
  monthly_views?: number;
  last_synced_at?: string | null;
  board_count?: number;
  pin_count?: number;
  total_impressions?: number;
  total_saves?: number;
  total_clicks?: number;
  avg_save_rate?: number;
}

export interface PinterestBoard {
  board_id: string;
  name: string;
  description: string;
  privacy: string;
  pin_count: number;
  follower_count: number;
}

export interface PinterestCachedPin {
  pin_id: string;
  title: string;
  description: string;
  board_id: string;
  created_at: string | null;
  impression_count: number;
  save_count: number;
  outbound_clicks: number;
  pin_click: number;
}

export async function fetchPinterestAccountStatus(): Promise<PinterestAccountStatus> {
  const res = await fetch(`${API_BASE}/pinterest/account/status`);
  if (!res.ok) throw new Error(`Failed to fetch Pinterest status: ${res.status}`);
  return res.json();
}

export async function fetchPinterestAuthUrl(): Promise<{ auth_url: string }> {
  const res = await fetch(`${API_BASE}/pinterest/account/auth-url`);
  if (!res.ok) throw new Error(`Failed to get Pinterest auth URL: ${res.status}`);
  return res.json();
}

export async function syncPinterestAccount(): Promise<{ synced_boards: number; synced_pins: number; errors: string[] }> {
  const res = await fetch(`${API_BASE}/pinterest/account/sync`, { method: "POST" });
  if (!res.ok) throw new Error(`Pinterest sync failed: ${res.status}`);
  return res.json();
}

export async function disconnectPinterestAccount(): Promise<void> {
  await fetch(`${API_BASE}/pinterest/account/disconnect`, { method: "POST" });
}

export async function fetchPinterestBoards(): Promise<{ boards: PinterestBoard[] }> {
  const res = await fetch(`${API_BASE}/pinterest/account/boards`);
  if (!res.ok) throw new Error(`Failed to fetch Pinterest boards: ${res.status}`);
  return res.json();
}

export async function fetchPinterestCachedPins(limit = 25): Promise<{ pins: PinterestCachedPin[]; total: number }> {
  const res = await fetch(`${API_BASE}/pinterest/account/pins?limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to fetch Pinterest pins: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// LinkedIn Account Connection
// ---------------------------------------------------------------------------

export interface LinkedInAccountStatus {
  connected: boolean;
  configured?: boolean;
  person_urn?: string;
  name?: string;
  given_name?: string;
  email?: string;
  picture?: string | null;
  headline?: string | null;
  last_synced_at?: string | null;
  published_posts?: number;
  total_impressions?: number;
  total_reactions?: number;
  total_shares?: number;
  avg_thought_leadership_score?: number;
}

export async function fetchLinkedInAccountStatus(): Promise<LinkedInAccountStatus> {
  const res = await fetch(`${API_BASE}/linkedin/account/status`);
  if (!res.ok) throw new Error(`Failed to fetch LinkedIn status: ${res.status}`);
  return res.json();
}

export async function fetchLinkedInAuthUrl(): Promise<{ auth_url: string }> {
  const res = await fetch(`${API_BASE}/linkedin/account/auth-url`);
  if (!res.ok) throw new Error(`Failed to get LinkedIn auth URL: ${res.status}`);
  return res.json();
}

export async function syncLinkedInAccount(): Promise<{ synced: boolean; errors: string[] }> {
  const res = await fetch(`${API_BASE}/linkedin/account/sync`, { method: "POST" });
  if (!res.ok) throw new Error(`LinkedIn sync failed: ${res.status}`);
  return res.json();
}

export async function disconnectLinkedInAccount(): Promise<void> {
  await fetch(`${API_BASE}/linkedin/account/disconnect`, { method: "POST" });
}

// ---------------------------------------------------------------------------
// LinkedIn Studio — post types + list/schedule helpers
// ---------------------------------------------------------------------------

export interface LinkedInPost {
  id: string;
  content: string;
  post_type: string;
  status: string;
  scheduled_time: string | null;
  published_time: string | null;
  thought_leadership_score: number;
  estimated_reach: number;
  created_at: string;
  updated_at: string;
}

export interface LinkedInPostListResponse {
  posts: LinkedInPost[];
  total: number;
  draft_count: number;
  pending_count: number;
  scheduled_count: number;
  published_count: number;
}

export async function listLinkedInDrafts(params?: { status?: string; limit?: number }): Promise<LinkedInPostListResponse> {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.limit !== undefined) q.set("limit", String(params.limit));
  const res = await fetch(`${API_BASE}/linkedin/drafts?${q}`);
  if (!res.ok) throw new Error(`Failed to list LinkedIn drafts: ${res.status}`);
  return res.json();
}

export async function scheduleLinkedInPost(postId: string, scheduledTime: string): Promise<LinkedInPost> {
  const res = await fetch(`${API_BASE}/linkedin/${postId}/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scheduled_time: scheduledTime }),
  });
  if (!res.ok) throw new Error(`Failed to schedule LinkedIn post: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Pinterest Studio — pin types + list/schedule helpers
// ---------------------------------------------------------------------------

export interface PinterestPin {
  id: string;
  title: string;
  description: string;
  pin_type: string;
  status: string;
  scheduled_time: string | null;
  published_time: string | null;
  pin_score: number;
  estimated_monthly_views: number;
  created_at: string;
  updated_at: string;
}

export interface PinterestPinListResponse {
  pins: PinterestPin[];
  total: number;
  draft_count: number;
  pending_count: number;
  scheduled_count: number;
  published_count: number;
}

export async function listPinterestDrafts(params?: { status?: string; limit?: number }): Promise<PinterestPinListResponse> {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.limit !== undefined) q.set("limit", String(params.limit));
  const res = await fetch(`${API_BASE}/pinterest/drafts?${q}`);
  if (!res.ok) throw new Error(`Failed to list Pinterest drafts: ${res.status}`);
  return res.json();
}

export async function schedulePinterestPin(pinId: string, scheduledTime: string): Promise<PinterestPin> {
  const res = await fetch(`${API_BASE}/pinterest/${pinId}/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scheduled_time: scheduledTime }),
  });
  if (!res.ok) throw new Error(`Failed to schedule Pinterest pin: ${res.status}`);
  return res.json();
}
