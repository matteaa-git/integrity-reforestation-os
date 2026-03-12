"""Directory scanning and asset registration logic."""

import hashlib
import mimetypes
import os
from dataclasses import dataclass
from typing import List, Optional

HASH_CHUNK_SIZE = 65536  # 64 KB reads for hashing

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".svg"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}
ALL_EXTENSIONS = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS


@dataclass
class ScannedFile:
    path: str
    filename: str
    media_type: str  # "image" or "video"
    file_size: int
    mime_type: Optional[str]
    hash: str  # SHA-256 hex digest


def compute_sha256(filepath: str) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(HASH_CHUNK_SIZE):
            h.update(chunk)
    return h.hexdigest()


def classify_media_type(ext: str) -> Optional[str]:
    ext = ext.lower()
    if ext in IMAGE_EXTENSIONS:
        return "image"
    if ext in VIDEO_EXTENSIONS:
        return "video"
    return None


def scan_directory(directory: str) -> tuple[List[ScannedFile], List[str]]:
    """Walk a directory and return media files found + any errors."""
    files: List[ScannedFile] = []
    errors: List[str] = []

    if not os.path.isdir(directory):
        errors.append(f"Directory not found: {directory}")
        return files, errors

    for root, _dirs, filenames in os.walk(directory):
        for fname in filenames:
            ext = os.path.splitext(fname)[1].lower()
            media_type = classify_media_type(ext)
            if media_type is None:
                continue

            full_path = os.path.join(root, fname)
            try:
                stat = os.stat(full_path)
                mime, _ = mimetypes.guess_type(full_path)
                file_hash = compute_sha256(full_path)
                files.append(ScannedFile(
                    path=full_path,
                    filename=fname,
                    media_type=media_type,
                    file_size=stat.st_size,
                    mime_type=mime,
                    hash=file_hash,
                ))
            except OSError as e:
                errors.append(f"Error reading {full_path}: {e}")

    return files, errors
