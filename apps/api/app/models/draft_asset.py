"""DraftAsset — join table linking drafts to assets (many-to-many)."""

import uuid

from sqlalchemy import ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class DraftAsset(Base):
    __tablename__ = "draft_assets"

    draft_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drafts.id"), nullable=False
    )
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.id"), nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, default=0)

    # relationships
    draft: Mapped["Draft"] = relationship(back_populates="draft_assets")
    asset: Mapped["Asset"] = relationship(back_populates="draft_assets")


from app.models.draft import Draft  # noqa: E402, F811
from app.models.asset import Asset  # noqa: E402, F811
