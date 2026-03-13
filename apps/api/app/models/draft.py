"""Draft — a content item being produced through the pipeline."""

import uuid
from typing import List, Optional

from sqlalchemy import Enum, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import ContentFormat, DraftStatus


class Draft(Base):
    __tablename__ = "drafts"

    title: Mapped[str] = mapped_column(String(256), nullable=False)
    format: Mapped[ContentFormat] = mapped_column(Enum(ContentFormat), nullable=False)
    status: Mapped[DraftStatus] = mapped_column(
        Enum(DraftStatus), nullable=False, default=DraftStatus.DRAFT
    )
    caption: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    hashtags: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ai_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # foreign keys
    content_brief_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("content_briefs.id"), nullable=True
    )
    template_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("templates.id"), nullable=True
    )
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=True
    )
    source_asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.id"), nullable=True
    )

    # relationships
    content_brief: Mapped[Optional["ContentBrief"]] = relationship(
        back_populates="drafts"
    )
    template: Mapped[Optional["Template"]] = relationship(back_populates="drafts")
    campaign: Mapped[Optional["Campaign"]] = relationship(back_populates="drafts")
    source_asset: Mapped[Optional["Asset"]] = relationship(
        back_populates="source_drafts", foreign_keys=[source_asset_id]
    )
    draft_assets: Mapped[List["DraftAsset"]] = relationship(back_populates="draft")
    publish_jobs: Mapped[List["PublishJob"]] = relationship(back_populates="draft")
    recommendations: Mapped[List["Recommendation"]] = relationship(
        back_populates="draft"
    )
    ad_creatives: Mapped[List["AdCreative"]] = relationship(back_populates="draft")


from app.models.asset import Asset  # noqa: E402, F811
from app.models.content_brief import ContentBrief  # noqa: E402, F811
from app.models.template import Template  # noqa: E402, F811
from app.models.campaign import Campaign  # noqa: E402, F811
from app.models.draft_asset import DraftAsset  # noqa: E402, F811
from app.models.publish_job import PublishJob  # noqa: E402, F811
from app.models.recommendation import Recommendation  # noqa: E402, F811
from app.models.ad_creative import AdCreative  # noqa: E402, F811
