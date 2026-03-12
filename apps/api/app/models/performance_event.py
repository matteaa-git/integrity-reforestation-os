"""PerformanceEvent — a metric snapshot for a publish_job or ad_creative."""

import uuid
from typing import Any, Dict, Optional

from sqlalchemy import Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import PerformanceEventSource


class PerformanceEvent(Base):
    __tablename__ = "performance_events"

    source: Mapped[PerformanceEventSource] = mapped_column(
        Enum(PerformanceEventSource), nullable=False
    )

    # Polymorphic FKs — exactly one must be set.
    publish_job_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("publish_jobs.id"), nullable=True
    )
    ad_creative_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ad_creatives.id"), nullable=True
    )

    metric_name: Mapped[str] = mapped_column(String(128), nullable=False)
    metric_value: Mapped[int] = mapped_column(Integer, nullable=False)
    metadata_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True
    )

    # relationships
    publish_job: Mapped[Optional["PublishJob"]] = relationship(
        back_populates="performance_events"
    )
    ad_creative: Mapped[Optional["AdCreative"]] = relationship(
        back_populates="performance_events"
    )


from app.models.publish_job import PublishJob  # noqa: E402, F811
from app.models.ad_creative import AdCreative  # noqa: E402, F811
