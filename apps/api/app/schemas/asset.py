"""Pydantic schemas for the Asset API."""

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


MediaType = Literal["image", "video"]


class AssetCreate(BaseModel):
    path: str
    filename: str
    media_type: MediaType
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[float] = None
    file_size: int
    hash: Optional[str] = None


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
    created_at: str
    updated_at: str


class AssetListResponse(BaseModel):
    assets: List[AssetResponse]
    total: int


class IndexDirectoryRequest(BaseModel):
    directory: str


class IndexDirectoryResponse(BaseModel):
    indexed: int
    skipped: int
    errors: List[str]
