"""Pydantic schemas for the Asset API."""

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel


MediaType = Literal["image", "video", "audio"]


class AssetCreate(BaseModel):
    path: str
    filename: str
    media_type: MediaType
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[float] = None
    file_size: int
    hash: Optional[str] = None
    extension: Optional[str] = None
    relative_path: Optional[str] = None
    category: Optional[str] = None
    project: Optional[str] = None
    pillar: Optional[str] = None
    # Integrity library enriched fields
    description: Optional[str] = None
    orientation: Optional[str] = None
    subject: Optional[str] = None
    action: Optional[str] = None
    content_type: Optional[str] = None   # photo | video | drone | talking_head | timelapse
    ai_keywords: Optional[List[str]] = None
    ai_confidence: Optional[float] = None


class AssetUpdate(BaseModel):
    filename: Optional[str] = None
    media_type: Optional[MediaType] = None
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[float] = None


class AssetResponse(BaseModel):
    id: str
    path: str
    filename: str
    media_type: MediaType
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[float] = None
    file_size: int
    hash: Optional[str] = None
    extension: Optional[str] = None
    relative_path: Optional[str] = None
    category: Optional[str] = None
    project: Optional[str] = None
    pillar: Optional[str] = None
    description: Optional[str] = None
    orientation: Optional[str] = None
    subject: Optional[str] = None
    action: Optional[str] = None
    content_type: Optional[str] = None
    ai_keywords: Optional[List[str]] = None
    ai_confidence: Optional[float] = None
    created_at: str
    updated_at: str


class AssetListResponse(BaseModel):
    assets: List[AssetResponse]
    total: int


class IndexDirectoryRequest(BaseModel):
    directory: Optional[str] = None


class IndexDirectoryResponse(BaseModel):
    indexed_count: int
    skipped_count: int
    duplicate_count: int
    invalid_count: int
    scanned_root: str
    errors: List[str]


class LibraryStatusResponse(BaseModel):
    connected: bool
    library_root: str
    library_path: str
    total_assets: int
    images: int
    videos: int
    audio: int
    last_synced_at: Optional[str]
    sync_in_progress: bool
    projects: List[str]
    pillars: List[str]
