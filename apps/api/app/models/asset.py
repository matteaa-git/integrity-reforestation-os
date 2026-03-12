"""Asset — an uploaded media file (image, video, audio)."""

from typing import List, Optional

from sqlalchemy import Enum, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import AssetKind


class Asset(Base):
    __tablename__ = "assets"

    kind: Mapped[AssetKind] = mapped_column(Enum(AssetKind), nullable=False)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    storage_url: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(128), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    width_px: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height_px: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # relationships
    draft_assets: Mapped[List["DraftAsset"]] = relationship(back_populates="asset")
    ad_creatives: Mapped[List["AdCreative"]] = relationship(back_populates="asset")
    source_drafts: Mapped[List["Draft"]] = relationship(
        back_populates="source_asset", foreign_keys="[Draft.source_asset_id]"
    )


# resolve forward refs
from app.models.draft import Draft  # noqa: E402, F811
from app.models.draft_asset import DraftAsset  # noqa: E402, F811
from app.models.ad_creative import AdCreative  # noqa: E402, F811
