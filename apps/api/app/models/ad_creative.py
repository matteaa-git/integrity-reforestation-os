"""AdCreative — a paid ad creative linked to an asset and campaign."""

import uuid
from typing import List, Optional

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import AdCreativeStatus


class AdCreative(Base):
    __tablename__ = "ad_creatives"

    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.id"), nullable=False
    )
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=True
    )
    headline: Mapped[str] = mapped_column(String(256), nullable=False)
    body_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    call_to_action: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    status: Mapped[AdCreativeStatus] = mapped_column(
        Enum(AdCreativeStatus), nullable=False, default=AdCreativeStatus.DRAFT
    )
    spend_cents: Mapped[int] = mapped_column(Integer, default=0)
    impressions: Mapped[int] = mapped_column(Integer, default=0)
    clicks: Mapped[int] = mapped_column(Integer, default=0)
    conversions: Mapped[int] = mapped_column(Integer, default=0)
    instagram_ad_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    # relationships
    asset: Mapped["Asset"] = relationship(back_populates="ad_creatives")
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
from app.models.campaign import Campaign  # noqa: E402, F811
from app.models.performance_event import PerformanceEvent  # noqa: E402, F811
from app.models.recommendation import Recommendation  # noqa: E402, F811
