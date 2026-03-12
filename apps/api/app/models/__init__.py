"""SQLAlchemy models — re-exports everything for Alembic and application use."""

from app.models.base import Base
from app.models.enums import (
    AssetKind,
    AdCreativeStatus,
    CampaignStatus,
    ContentFormat,
    DraftStatus,
    PerformanceEventSource,
    PublishJobStatus,
    RecommendationStatus,
    RecommendationTargetKind,
    TemplateCategory,
)
from app.models.asset import Asset
from app.models.content_brief import ContentBrief
from app.models.template import Template
from app.models.draft import Draft
from app.models.draft_asset import DraftAsset
from app.models.campaign import Campaign
from app.models.publish_job import PublishJob
from app.models.ad_creative import AdCreative
from app.models.performance_event import PerformanceEvent
from app.models.recommendation import Recommendation

__all__ = [
    "Base",
    # enums
    "AssetKind",
    "AdCreativeStatus",
    "CampaignStatus",
    "ContentFormat",
    "DraftStatus",
    "PerformanceEventSource",
    "PublishJobStatus",
    "RecommendationStatus",
    "RecommendationTargetKind",
    "TemplateCategory",
    # tables
    "Asset",
    "ContentBrief",
    "Template",
    "Draft",
    "DraftAsset",
    "Campaign",
    "PublishJob",
    "AdCreative",
    "PerformanceEvent",
    "Recommendation",
]
