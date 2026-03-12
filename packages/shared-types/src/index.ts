// ─── Enums ───────────────────────────────────────────────────────────────────

export type AssetKind = "image" | "video" | "audio";

export type ContentFormat = "story" | "reel" | "carousel";

export type DraftStatus =
  | "idea"
  | "in_progress"
  | "review"
  | "approved"
  | "scheduled"
  | "published"
  | "failed"
  | "archived";

export type PublishJobStatus = "pending" | "in_progress" | "succeeded" | "failed";

export type CampaignStatus = "draft" | "active" | "paused" | "completed" | "archived";

export type AdCreativeStatus = "draft" | "active" | "paused" | "completed";

export type PerformanceEventSource = "publish_job" | "ad_creative";

export type RecommendationTargetKind = "draft" | "ad_creative";

export type RecommendationStatus = "pending" | "accepted" | "dismissed";

export type TemplateCategory = "caption" | "visual" | "layout" | "hashtag_set";

// ─── Entity interfaces ──────────────────────────────────────────────────────

interface BaseEntity {
  id: string;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
}

export interface Asset extends BaseEntity {
  kind: AssetKind;
  filename: string;
  storageUrl: string;
  mimeType: string;
  sizeBytes: number;
  widthPx?: number;
  heightPx?: number;
  durationMs?: number;
}

export interface ContentBrief extends BaseEntity {
  title: string;
  description?: string;
  targetFormat: ContentFormat;
  talkingPoints?: string;
  referenceUrls?: string;
}

export interface Template extends BaseEntity {
  name: string;
  category: TemplateCategory;
  body: string;
  description?: string;
}

export interface Draft extends BaseEntity {
  title: string;
  format: ContentFormat;
  status: DraftStatus;
  caption?: string;
  hashtags?: string;
  aiScore?: number;
  contentBriefId?: string;
  templateId?: string;
  campaignId?: string;
  sourceAssetId?: string;
}

export interface DraftAsset extends BaseEntity {
  draftId: string;
  assetId: string;
  position: number;
}

export interface Campaign extends BaseEntity {
  name: string;
  description?: string;
  status: CampaignStatus;
  budgetCents?: number;
  startsAt?: string;
  endsAt?: string;
}

export interface PublishJob extends BaseEntity {
  draftId: string;
  status: PublishJobStatus;
  scheduledAt?: string;
  publishedAt?: string;
  instagramMediaId?: string;
  errorMessage?: string;
}

export interface AdCreative extends BaseEntity {
  assetId: string;
  campaignId?: string;
  headline: string;
  bodyText?: string;
  callToAction?: string;
  status: AdCreativeStatus;
  spendCents: number;
  impressions: number;
  clicks: number;
  conversions: number;
  instagramAdId?: string;
}

export interface PerformanceEvent extends BaseEntity {
  source: PerformanceEventSource;
  publishJobId?: string;
  adCreativeId?: string;
  metricName: string;
  metricValue: number;
  metadataJson?: Record<string, unknown>;
}

export interface Recommendation extends BaseEntity {
  targetKind: RecommendationTargetKind;
  draftId?: string;
  adCreativeId?: string;
  title: string;
  body: string;
  confidence?: number;
  status: RecommendationStatus;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const DAILY_TARGETS: Record<ContentFormat, number> = {
  story: 10,
  reel: 3,
  carousel: 1,
};
