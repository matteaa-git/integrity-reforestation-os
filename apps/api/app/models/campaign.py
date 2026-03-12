"""Campaign — a group of drafts and ad creatives under one initiative."""

from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, Enum, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import CampaignStatus


class Campaign(Base):
    __tablename__ = "campaigns"

    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[CampaignStatus] = mapped_column(
        Enum(CampaignStatus), nullable=False, default=CampaignStatus.DRAFT
    )
    budget_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    starts_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ends_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # relationships
    drafts: Mapped[List["Draft"]] = relationship(back_populates="campaign")
    ad_creatives: Mapped[List["AdCreative"]] = relationship(back_populates="campaign")


from app.models.draft import Draft  # noqa: E402, F811
from app.models.ad_creative import AdCreative  # noqa: E402, F811
