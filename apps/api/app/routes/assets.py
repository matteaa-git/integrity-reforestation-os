"""Asset API routes."""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.schemas.asset import (
    AssetCreate,
    AssetListResponse,
    AssetResponse,
    AssetUpdate,
    IndexDirectoryRequest,
    IndexDirectoryResponse,
)
from app.services.asset_indexer import scan_directory
from app import store

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("", response_model=AssetListResponse)
async def list_assets(
    media_type: Optional[str] = Query(None, description="Filter by media_type: image or video"),
    search: Optional[str] = Query(None, description="Search by filename"),
):
    assets = store.list_assets(media_type=media_type, search=search)
    return AssetListResponse(assets=assets, total=len(assets))


@router.get("/{asset_id}", response_model=AssetResponse)
async def get_asset(asset_id: str):
    asset = store.get_asset(asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.post("", response_model=AssetResponse, status_code=201)
async def create_asset(body: AssetCreate):
    asset = store.create_asset(body.model_dump())
    return asset


@router.patch("/{asset_id}", response_model=AssetResponse)
async def update_asset(asset_id: str, body: AssetUpdate):
    updates = body.model_dump(exclude_unset=True)
    asset = store.update_asset(asset_id, updates)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.post("/index-directory", response_model=IndexDirectoryResponse)
async def index_directory(body: IndexDirectoryRequest):
    scanned, errors = scan_directory(body.directory)
    indexed = 0
    skipped = 0
    for f in scanned:
        if store.has_hash(f.hash):
            skipped += 1
            continue
        store.create_asset({
            "path": f.path,
            "filename": f.filename,
            "media_type": f.media_type,
            "file_size": f.file_size,
            "hash": f.hash,
        })
        indexed += 1
    return IndexDirectoryResponse(indexed=indexed, skipped=skipped, errors=errors)
