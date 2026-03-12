"""initial schema — 10 tables

Revision ID: e669bf7c2d2c
Revises:
Create Date: 2026-03-12 15:19:02.442729

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision: str = 'e669bf7c2d2c'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# --- Enum type names ---
ASSET_KIND = sa.Enum('image', 'video', 'audio', name='assetkind')
CONTENT_FORMAT = sa.Enum('story', 'reel', 'carousel', name='contentformat')
DRAFT_STATUS = sa.Enum(
    'idea', 'in_progress', 'review', 'approved',
    'scheduled', 'published', 'failed', 'archived',
    name='draftstatus',
)
PUBLISH_JOB_STATUS = sa.Enum('pending', 'in_progress', 'succeeded', 'failed', name='publishjobstatus')
CAMPAIGN_STATUS = sa.Enum('draft', 'active', 'paused', 'completed', 'archived', name='campaignstatus')
AD_CREATIVE_STATUS = sa.Enum('draft', 'active', 'paused', 'completed', name='adcreativestatus')
PERF_EVENT_SOURCE = sa.Enum('publish_job', 'ad_creative', name='performanceeventsource')
REC_TARGET_KIND = sa.Enum('draft', 'ad_creative', name='recommendationtargetkind')
REC_STATUS = sa.Enum('pending', 'accepted', 'dismissed', name='recommendationstatus')
TEMPLATE_CATEGORY = sa.Enum('caption', 'visual', 'layout', 'hashtag_set', name='templatecategory')


def upgrade() -> None:
    # --- Independent tables (no FKs) ---

    op.create_table(
        'assets',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('kind', ASSET_KIND, nullable=False),
        sa.Column('filename', sa.String(512), nullable=False),
        sa.Column('storage_url', sa.Text, nullable=False),
        sa.Column('mime_type', sa.String(128), nullable=False),
        sa.Column('size_bytes', sa.Integer, nullable=False),
        sa.Column('width_px', sa.Integer, nullable=True),
        sa.Column('height_px', sa.Integer, nullable=True),
        sa.Column('duration_ms', sa.Integer, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'campaigns',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(256), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('status', CAMPAIGN_STATUS, nullable=False),
        sa.Column('budget_cents', sa.Integer, nullable=True),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ends_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'content_briefs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('title', sa.String(256), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('target_format', CONTENT_FORMAT, nullable=False),
        sa.Column('talking_points', sa.Text, nullable=True),
        sa.Column('reference_urls', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'templates',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(256), nullable=False),
        sa.Column('category', TEMPLATE_CATEGORY, nullable=False),
        sa.Column('body', sa.Text, nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # --- Tables with FKs to independent tables ---

    op.create_table(
        'drafts',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('title', sa.String(256), nullable=False),
        sa.Column('format', CONTENT_FORMAT, nullable=False),
        sa.Column('status', DRAFT_STATUS, nullable=False),
        sa.Column('caption', sa.Text, nullable=True),
        sa.Column('hashtags', sa.Text, nullable=True),
        sa.Column('ai_score', sa.Float, nullable=True),
        sa.Column('content_brief_id', UUID(as_uuid=True), sa.ForeignKey('content_briefs.id'), nullable=True),
        sa.Column('template_id', UUID(as_uuid=True), sa.ForeignKey('templates.id'), nullable=True),
        sa.Column('campaign_id', UUID(as_uuid=True), sa.ForeignKey('campaigns.id'), nullable=True),
        sa.Column('source_asset_id', UUID(as_uuid=True), sa.ForeignKey('assets.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'ad_creatives',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('asset_id', UUID(as_uuid=True), sa.ForeignKey('assets.id'), nullable=False),
        sa.Column('campaign_id', UUID(as_uuid=True), sa.ForeignKey('campaigns.id'), nullable=True),
        sa.Column('headline', sa.String(256), nullable=False),
        sa.Column('body_text', sa.Text, nullable=True),
        sa.Column('call_to_action', sa.String(64), nullable=True),
        sa.Column('status', AD_CREATIVE_STATUS, nullable=False),
        sa.Column('spend_cents', sa.Integer, nullable=False, server_default='0'),
        sa.Column('impressions', sa.Integer, nullable=False, server_default='0'),
        sa.Column('clicks', sa.Integer, nullable=False, server_default='0'),
        sa.Column('conversions', sa.Integer, nullable=False, server_default='0'),
        sa.Column('instagram_ad_id', sa.String(128), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # --- Join table ---

    op.create_table(
        'draft_assets',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('draft_id', UUID(as_uuid=True), sa.ForeignKey('drafts.id'), nullable=False),
        sa.Column('asset_id', UUID(as_uuid=True), sa.ForeignKey('assets.id'), nullable=False),
        sa.Column('position', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # --- Tables with FKs to drafts ---

    op.create_table(
        'publish_jobs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('draft_id', UUID(as_uuid=True), sa.ForeignKey('drafts.id'), nullable=False),
        sa.Column('status', PUBLISH_JOB_STATUS, nullable=False),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('instagram_media_id', sa.String(128), nullable=True),
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # --- Polymorphic tables ---

    op.create_table(
        'performance_events',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('source', PERF_EVENT_SOURCE, nullable=False),
        sa.Column('publish_job_id', UUID(as_uuid=True), sa.ForeignKey('publish_jobs.id'), nullable=True),
        sa.Column('ad_creative_id', UUID(as_uuid=True), sa.ForeignKey('ad_creatives.id'), nullable=True),
        sa.Column('metric_name', sa.String(128), nullable=False),
        sa.Column('metric_value', sa.Integer, nullable=False),
        sa.Column('metadata_json', JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'recommendations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('target_kind', REC_TARGET_KIND, nullable=False),
        sa.Column('draft_id', UUID(as_uuid=True), sa.ForeignKey('drafts.id'), nullable=True),
        sa.Column('ad_creative_id', UUID(as_uuid=True), sa.ForeignKey('ad_creatives.id'), nullable=True),
        sa.Column('title', sa.String(256), nullable=False),
        sa.Column('body', sa.Text, nullable=False),
        sa.Column('confidence', sa.Float, nullable=True),
        sa.Column('status', REC_STATUS, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('recommendations')
    op.drop_table('performance_events')
    op.drop_table('publish_jobs')
    op.drop_table('draft_assets')
    op.drop_table('ad_creatives')
    op.drop_table('drafts')
    op.drop_table('templates')
    op.drop_table('content_briefs')
    op.drop_table('campaigns')
    op.drop_table('assets')

    # Drop enum types
    for enum_type in [
        REC_STATUS, REC_TARGET_KIND, PERF_EVENT_SOURCE,
        AD_CREATIVE_STATUS, PUBLISH_JOB_STATUS, CAMPAIGN_STATUS,
        DRAFT_STATUS, TEMPLATE_CATEGORY, CONTENT_FORMAT, ASSET_KIND,
    ]:
        enum_type.drop(op.get_bind(), checkfirst=True)
