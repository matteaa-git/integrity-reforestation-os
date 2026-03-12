"""PublishJob — a scheduled or completed attempt to publish a draft to Instagram."""

import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import PublishJobStatus


class PublishJob(Base):
    __tablename__ = "publish_jobs"

    draft_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drafts.id"), nullable=False
    )
    status: Mapped[PublishJobStatus] = mapped_column(
        Enum(PublishJobStatus), nullable=False, default=PublishJobStatus.PENDING
    )
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    instagram_media_id: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # relationships
    draft: Mapped["Draft"] = relationship(back_populates="publish_jobs")
    performance_events: Mapped[List["PerformanceEvent"]] = relationship(
        back_populates="publish_job"
    )


from app.models.draft import Draft  # noqa: E402, F811
from app.models.performance_event import PerformanceEvent  # noqa: E402, F811
