/** Content format types produced by the system. */
export type ContentFormat = "story" | "reel" | "carousel";

/** Status of a content item through the pipeline. */
export type ContentStatus = "draft" | "review" | "scheduled" | "published" | "failed";

/** A single piece of content flowing through the system. */
export interface ContentItem {
  id: string;
  format: ContentFormat;
  caption: string;
  mediaUrls: string[];
  status: ContentStatus;
  scheduledAt?: string; // ISO-8601
  publishedAt?: string; // ISO-8601
  createdAt: string;    // ISO-8601
}

/** Ad creative for paid-growth testing. */
export interface AdCreative {
  id: string;
  contentItemId: string;
  headline: string;
  spendCents: number;
  impressions: number;
  clicks: number;
  conversions: number;
  status: "active" | "paused" | "completed";
}

/** Daily production targets. */
export const DAILY_TARGETS: Record<ContentFormat, number> = {
  story: 10,
  reel: 3,
  carousel: 1,
};
