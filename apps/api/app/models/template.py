"""Template — reusable caption, visual, or layout template."""

from typing import List, Optional

from sqlalchemy import Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import TemplateCategory


class Template(Base):
    __tablename__ = "templates"

    name: Mapped[str] = mapped_column(String(256), nullable=False)
    category: Mapped[TemplateCategory] = mapped_column(
        Enum(TemplateCategory), nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # relationships
    drafts: Mapped[List["Draft"]] = relationship(back_populates="template")


from app.models.draft import Draft  # noqa: E402, F811
