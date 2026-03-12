"""ContentBrief — high-level creative direction for a piece of content."""

from typing import List, Optional

from sqlalchemy import Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import ContentFormat


class ContentBrief(Base):
    __tablename__ = "content_briefs"

    title: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    target_format: Mapped[ContentFormat] = mapped_column(
        Enum(ContentFormat), nullable=False
    )
    talking_points: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reference_urls: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # relationships
    drafts: Mapped[List["Draft"]] = relationship(back_populates="content_brief")


from app.models.draft import Draft  # noqa: E402, F811
