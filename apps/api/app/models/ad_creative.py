"""AdCreative — a paid ad creative for hook/CTA/thumbnail testing."""

import uuid
from typing import List, Optional

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import AdCreativeStatus


class AdCreative(Base):
    __tablename__ = "ad_creatives"

    title: Mapped[str] = mapped_column(String(256), nullable=False)
    asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.id"), nullable=True
    )
    draft_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drafts.id"), nullable=True
    )
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=True
    )
    hook_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    cta_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    thumbnail_label: Mapped[str] = mapped_column(String(256), nullable=False, default="")
    status: Mapped[AdCreativeStatus] = mapped_column(
        Enum(AdCreativeStatus), nullable=False, default=AdCreativeStatus.DRAFT
    )

    # relationships
    asset: Mapped[Optional["Asset"]] = relationship(back_populates="ad_creatives")
    draft: Mapped[Optional["Draft"]] = relationship(back_populates="ad_creatives")
    campaign: Mapped[Optional["Campaign"]] = relationship(
        back_populates="ad_creatives"
    )
    performance_events: Mapped[List["PerformanceEvent"]] = relationship(
        back_populates="ad_creative"
    )
    recommendations: Mapped[List["Recommendation"]] = relationship(
        back_populates="ad_creative"
    )


from app.models.asset import Asset  # noqa: E402, F811
from app.models.draft import Draft  # noqa: E402, F811
from app.models.campaign import Campaign  # noqa: E402, F811
from app.models.performance_event import PerformanceEvent  # noqa: E402, F811
from app.models.recommendation import Recommendation  # noqa: E402, F811
