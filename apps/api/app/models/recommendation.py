"""Recommendation — AI-generated suggestion targeting a draft or ad_creative."""

import uuid
from typing import Optional

from sqlalchemy import Enum, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import RecommendationStatus, RecommendationTargetKind


class Recommendation(Base):
    __tablename__ = "recommendations"

    target_kind: Mapped[RecommendationTargetKind] = mapped_column(
        Enum(RecommendationTargetKind), nullable=False
    )

    # Polymorphic FKs — exactly one must be set.
    draft_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drafts.id"), nullable=True
    )
    ad_creative_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ad_creatives.id"), nullable=True
    )

    title: Mapped[str] = mapped_column(String(256), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    status: Mapped[RecommendationStatus] = mapped_column(
        Enum(RecommendationStatus), nullable=False, default=RecommendationStatus.PENDING
    )

    # relationships
    draft: Mapped[Optional["Draft"]] = relationship(back_populates="recommendations")
    ad_creative: Mapped[Optional["AdCreative"]] = relationship(
        back_populates="recommendations"
    )


from app.models.draft import Draft  # noqa: E402, F811
from app.models.ad_creative import AdCreative  # noqa: E402, F811
