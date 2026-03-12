# Data Model

10 tables supporting organic publishing and paid ad workflows. All tables share `id` (UUID), `created_at`, and `updated_at` columns.

## Entity-Relationship Overview

```
content_briefs ──┐
                 ├──▶ drafts ◀── templates
campaigns ───────┤      │
                 │      ├──▶ draft_assets ◀── assets ──▶ ad_creatives
                 │      │                                     │
                 └──────┼──▶ publish_jobs        campaigns ◀──┘
                        │         │
                        │         ▼
                        │   performance_events ◀── ad_creatives
                        │
                        ▼
                   recommendations ──▶ ad_creatives
```

## Tables

### assets
Uploaded media files (images, video, audio).

| Column | Type | Notes |
|--------|------|-------|
| kind | enum: image, video, audio | |
| filename | varchar(512) | Original filename |
| storage_url | text | Path or URL to stored file |
| mime_type | varchar(128) | |
| size_bytes | integer | |
| width_px | integer | Nullable — not applicable to audio |
| height_px | integer | Nullable |
| duration_ms | integer | Nullable — for video/audio |

### content_briefs
High-level creative direction before a draft is produced.

| Column | Type | Notes |
|--------|------|-------|
| title | varchar(256) | |
| description | text | Nullable |
| target_format | enum: story, reel, carousel | |
| talking_points | text | Nullable — bullet points or freeform |
| reference_urls | text | Nullable — inspiration links |

### templates
Reusable caption, visual, layout, or hashtag set templates.

| Column | Type | Notes |
|--------|------|-------|
| name | varchar(256) | |
| category | enum: caption, visual, layout, hashtag_set | |
| body | text | Template content |
| description | text | Nullable |

### drafts
A content item moving through the production pipeline.

| Column | Type | Notes |
|--------|------|-------|
| title | varchar(256) | |
| format | enum: story, reel, carousel | |
| status | enum: idea, in_progress, review, approved, scheduled, published, failed, archived | |
| caption | text | Nullable |
| hashtags | text | Nullable |
| ai_score | float | Nullable — for future AI scoring |
| content_brief_id | FK → content_briefs | Nullable |
| template_id | FK → templates | Nullable |
| campaign_id | FK → campaigns | Nullable |
| source_asset_id | FK → assets | Nullable — primary asset used to generate the draft |

### draft_assets
Join table — many-to-many between drafts and assets.

| Column | Type | Notes |
|--------|------|-------|
| draft_id | FK → drafts | Required |
| asset_id | FK → assets | Required |
| position | integer | Ordering within a carousel or multi-asset draft |

### campaigns
Groups drafts and ad creatives under a single initiative.

| Column | Type | Notes |
|--------|------|-------|
| name | varchar(256) | |
| description | text | Nullable |
| status | enum: draft, active, paused, completed, archived | |
| budget_cents | integer | Nullable — total budget in cents |
| starts_at | timestamptz | Nullable |
| ends_at | timestamptz | Nullable |

### publish_jobs
A scheduled or completed attempt to publish a draft to Instagram.

| Column | Type | Notes |
|--------|------|-------|
| draft_id | FK → drafts | Required |
| status | enum: pending, in_progress, succeeded, failed | |
| scheduled_at | timestamptz | Nullable |
| published_at | timestamptz | Nullable |
| instagram_media_id | varchar(128) | Nullable — returned by Instagram API |
| error_message | text | Nullable |

### ad_creatives
A paid ad creative linked to an asset and optionally a campaign.

| Column | Type | Notes |
|--------|------|-------|
| asset_id | FK → assets | Required |
| campaign_id | FK → campaigns | Nullable |
| headline | varchar(256) | |
| body_text | text | Nullable |
| call_to_action | varchar(64) | Nullable |
| status | enum: draft, active, paused, completed | |
| spend_cents | integer | Running spend total |
| impressions | integer | |
| clicks | integer | |
| conversions | integer | |
| instagram_ad_id | varchar(128) | Nullable |

### performance_events
Metric snapshots for either a publish_job or an ad_creative (polymorphic via two nullable FKs + source discriminator).

| Column | Type | Notes |
|--------|------|-------|
| source | enum: publish_job, ad_creative | Discriminator |
| publish_job_id | FK → publish_jobs | Nullable — set when source = publish_job |
| ad_creative_id | FK → ad_creatives | Nullable — set when source = ad_creative |
| metric_name | varchar(128) | e.g. "impressions", "reach", "saves" |
| metric_value | integer | |
| metadata_json | JSONB | Nullable — additional context |

### recommendations
AI-generated suggestions targeting either a draft or an ad_creative (polymorphic via two nullable FKs + target_kind discriminator).

| Column | Type | Notes |
|--------|------|-------|
| target_kind | enum: draft, ad_creative | Discriminator |
| draft_id | FK → drafts | Nullable — set when target = draft |
| ad_creative_id | FK → ad_creatives | Nullable — set when target = ad_creative |
| title | varchar(256) | |
| body | text | Recommendation details |
| confidence | float | Nullable — AI confidence score 0.0–1.0 |
| status | enum: pending, accepted, dismissed | |

## Design Notes

- **Polymorphic FKs**: `performance_events` and `recommendations` use two nullable FKs with a discriminator enum rather than generic foreign keys. This keeps referential integrity enforced at the DB level.
- **Money in cents**: `budget_cents` and `spend_cents` are stored as integers to avoid floating-point rounding issues.
- **ai_score on drafts**: Placeholder for future AI quality/engagement prediction.
- **JSONB**: `metadata_json` on performance_events allows flexible metric context without schema changes.
