"""All database enums — kept in one file for easy reference."""

import enum


class AssetKind(str, enum.Enum):
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"


class ContentFormat(str, enum.Enum):
    STORY = "story"
    REEL = "reel"
    CAROUSEL = "carousel"


class DraftStatus(str, enum.Enum):
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    SCHEDULED = "scheduled"


class PublishJobStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class CampaignStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class AdCreativeStatus(str, enum.Enum):
    DRAFT = "draft"
    READY = "ready"
    ARCHIVED = "archived"


class PerformanceEventSource(str, enum.Enum):
    PUBLISH_JOB = "publish_job"
    AD_CREATIVE = "ad_creative"


class RecommendationTargetKind(str, enum.Enum):
    DRAFT = "draft"
    AD_CREATIVE = "ad_creative"


class RecommendationStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DISMISSED = "dismissed"


class TemplateCategory(str, enum.Enum):
    CAPTION = "caption"
    VISUAL = "visual"
    LAYOUT = "layout"
    HASHTAG_SET = "hashtag_set"
