"""Directory scanning, metadata extraction, and asset registration logic.

Reads library path directly from ~/Integrity_AssetLibrary/config.yaml so the
Growth OS stays in sync with the Integrity File Ingest configuration.
"""

import hashlib
import json
import mimetypes
import os
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    import yaml  # PyYAML — optional; falls back to hardcoded defaults
    _YAML_AVAILABLE = True
except ImportError:
    _YAML_AVAILABLE = False

HASH_CHUNK_SIZE = 65536  # 64 KB reads for hashing

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".tif", ".svg", ".heic", ".heif", ".dng", ".cr2", ".cr3", ".nef", ".arw"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".mts", ".m2ts"}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".aac", ".m4a", ".ogg", ".flac", ".wma", ".aiff", ".aif"}
ALL_EXTENSIONS = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS | AUDIO_EXTENSIONS

# Files and directories to skip
IGNORED_FILENAMES = {".DS_Store", "Thumbs.db", "desktop.ini", ".gitkeep", ".gitignore"}
IGNORED_PREFIXES = ("._", ".__")  # AppleDouble resource forks
IGNORED_DIRS = {".venv", "__pycache__", "node_modules", ".git", "state", "LOGS", "AGENTS"}

# Integrity File Ingest root — always at this location
INTEGRITY_ROOT = os.path.expanduser("~/Integrity_AssetLibrary")
INTEGRITY_CONFIG = os.path.join(INTEGRITY_ROOT, "config.yaml")


def _load_integrity_config() -> dict:
    """Load ~/Integrity_AssetLibrary/config.yaml. Returns {} on any failure."""
    if not _YAML_AVAILABLE or not os.path.isfile(INTEGRITY_CONFIG):
        return {}
    try:
        with open(INTEGRITY_CONFIG, "r") as f:
            return yaml.safe_load(f) or {}
    except Exception:
        return {}


def _resolve_library_path(cfg: dict) -> str:
    """Resolve the canonical LIBRARY path from config, falling back to convention."""
    paths = cfg.get("paths", {})
    library = paths.get("library", "")
    if library and os.path.isdir(library):
        return library
    # Fall back to convention
    return os.path.join(INTEGRITY_ROOT, "LIBRARY")


def _build_location_map(cfg: dict) -> Dict[str, str]:
    """Build location code → human name map from config, with safe fallbacks."""
    locations = cfg.get("codes", {}).get("location", {})
    # Config format: {"Ogoki": "OGK", "Kenora": "KEN", ...} — invert it
    code_to_name = {v: k for k, v in locations.items()} if locations else {}
    # Merge with hardcoded fallbacks for codes not in config
    defaults = {
        "OGK": "Ogoki",
        "KEN": "Kenora",
        "NAGAGAMI": "Nagagami",
        "PICFOREST": "Pic Forest",
        "WRIVER": "White River",
        "ALG": "Algonquin",
        "UNK": "Unknown Location",
    }
    return {**defaults, **code_to_name}


def _build_pillar_map(cfg: dict) -> Dict[str, str]:
    """Build pillar code → human name map from config."""
    pillars = cfg.get("codes", {}).get("pillar", {})
    # Config format: {"Behind the Scenes": "BTS", ...} — invert it
    code_to_name = {v: k for k, v in pillars.items()} if pillars else {}
    defaults = {
        "BTS": "Behind the Scenes",
        "WF": "Wildfire",
        "OTB": "On The Block",
        "FP": "Founder POV",
        "CAMP": "Camp",
        "PC": "Planter Culture",
        "AP": "Apparel",
        "BP": "Brand Partners",
        "EXTREME": "Extreme Conditions",
        "UNK": "Unknown",
    }
    return {**defaults, **code_to_name}


# Eagerly load config once at module import
_CFG = _load_integrity_config()
LOCATION_MAP = _build_location_map(_CFG)
PILLAR_MAP = _build_pillar_map(_CFG)
DEFAULT_LIBRARY_ROOT = _resolve_library_path(_CFG)
INTEGRITY_LIBRARY_ROOT = INTEGRITY_ROOT  # kept for backward compat

# Content type codes from Integrity naming convention
CONTENT_TYPE_MAP = {
    "PHO": "photo",
    "VID": "video",
    "DRO": "drone",
    "TH": "talking_head",
    "TL": "timelapse",
}

# Known top-level categories
KNOWN_CATEGORIES = {"LIBRARY", "INBOX", "STAGING", "DESIGNS", "RAW", "EDIT", "EXPORT", "REVIEW", "BATCHES", "CAMPAIGNS"}


@dataclass
class ScannedFile:
    path: str
    filename: str
    media_type: str  # "image", "video", or "audio"
    file_size: int
    mime_type: Optional[str]
    hash: str  # SHA-256 hex digest
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[float] = None
    extension: Optional[str] = None
    relative_path: Optional[str] = None
    category: Optional[str] = None
    project: Optional[str] = None
    pillar: Optional[str] = None
    # Enriched from sidecar .json and canonical filename
    description: Optional[str] = None
    orientation: Optional[str] = None
    subject: Optional[str] = None
    action: Optional[str] = None
    content_type: Optional[str] = None   # photo | video | drone | talking_head | timelapse
    ai_keywords: Optional[List[str]] = None
    ai_confidence: Optional[float] = None  # lowest confidence score from sidecar


@dataclass
class ScanResult:
    files: List[ScannedFile] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    scanned_root: str = ""
    total_scanned: int = 0
    skipped_non_media: int = 0
    skipped_ignored: int = 0


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
    if ext in AUDIO_EXTENSIONS:
        return "audio"
    return None


def _should_skip_file(fname: str) -> bool:
    if fname in IGNORED_FILENAMES:
        return True
    if any(fname.startswith(p) for p in IGNORED_PREFIXES):
        return True
    return False


def _should_skip_dir(dirname: str) -> bool:
    if dirname.startswith("."):
        return True
    if dirname in IGNORED_DIRS:
        return True
    return False


def _extract_image_dimensions(filepath: str) -> Tuple[Optional[int], Optional[int]]:
    try:
        from PIL import Image
        with Image.open(filepath) as img:
            return img.width, img.height
    except Exception:
        return None, None


def _extract_video_metadata(filepath: str) -> Tuple[Optional[int], Optional[int], Optional[float]]:
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", "-show_format", filepath],
            capture_output=True, text=True, timeout=15,
        )
        if result.returncode != 0:
            return None, None, None
        data = json.loads(result.stdout)
        width, height, duration = None, None, None
        fmt = data.get("format", {})
        if "duration" in fmt:
            try:
                duration = float(fmt["duration"])
            except (ValueError, TypeError):
                pass
        for stream in data.get("streams", []):
            if stream.get("codec_type") == "video":
                width = stream.get("width")
                height = stream.get("height")
                if duration is None and "duration" in stream:
                    try:
                        duration = float(stream["duration"])
                    except (ValueError, TypeError):
                        pass
                break
        return width, height, duration
    except Exception:
        return None, None, None


def _extract_audio_duration(filepath: str) -> Optional[float]:
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", filepath],
            capture_output=True, text=True, timeout=15,
        )
        if result.returncode != 0:
            return None
        data = json.loads(result.stdout)
        fmt = data.get("format", {})
        if "duration" in fmt:
            return float(fmt["duration"])
        return None
    except Exception:
        return None


def _parse_sidecar(filepath: str) -> Dict[str, object]:
    """
    Read the Integrity sidecar .json file alongside a media file.

    Sidecar format (from Integrity File Ingest librarian):
      {
        "decision": "commit",
        "canonical_name": "BTS_PHO_KEN_INCAMP_GEN_20260228_0001__LANDSCAPE__camp.jpg",
        "tags":  { "pillar", "type", "location", "subject", "action", "orientation" },
        "ai":    { "pillar", "subject", "location", "action", "keywords", <conf fields> },
        "confidence": { "pillar", "subject", "location", "action" }
      }

    Priority: sidecar ai.* (most specific AI result) > tags.* (committed decision) > filename parse
    """
    sidecar_path = filepath + ".json"
    if not os.path.isfile(sidecar_path):
        return {}
    try:
        with open(sidecar_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        tags = data.get("tags", {})
        ai = data.get("ai", {})
        confidence = data.get("confidence", {})
        result: Dict[str, object] = {}

        # Orientation — from tags (not available in ai section)
        ori = tags.get("orientation", "")
        if ori:
            result["orientation"] = ori.upper()

        # Subject — tags is the committed decision
        subject = tags.get("subject") or ai.get("subject")
        if subject:
            result["subject"] = subject.upper()

        # Action — prefer ai.action (more specific, e.g. CAMP_SETUP vs GEN)
        ai_action = ai.get("action")
        tag_action = tags.get("action")
        result["action"] = (ai_action or tag_action or "").upper() or None

        # Pillar — prefer ai.pillar if available
        pillar = ai.get("pillar") or tags.get("pillar")
        if pillar:
            result["pillar"] = pillar.upper()

        # Location → project name
        loc = tags.get("location") or ai.get("location") or ""
        if loc and loc.upper() in LOCATION_MAP:
            result["project"] = LOCATION_MAP[loc.upper()]
        elif loc:
            result["project"] = loc  # fallback to raw code

        # Content type from tags.type
        content_type_code = tags.get("type", "").upper()
        if content_type_code in CONTENT_TYPE_MAP:
            result["content_type"] = CONTENT_TYPE_MAP[content_type_code]

        # AI keywords — normalise to lowercase
        keywords = ai.get("keywords") or []
        if keywords:
            result["ai_keywords"] = [str(k).lower() for k in keywords if k]

        # Minimum confidence score across all dimensions
        conf_values = [v for v in confidence.values() if isinstance(v, (int, float))]
        if conf_values:
            result["ai_confidence"] = round(min(conf_values), 3)

        # Description from canonical name
        canonical = data.get("canonical_name", "")
        if canonical:
            desc = _description_from_canonical(canonical)
            if desc:
                result["description"] = desc

        return result
    except Exception:
        return {}


def _description_from_canonical(canonical_name: str) -> Optional[str]:
    """
    Extract the human-readable description from a canonical filename.
    BTS_PHO_KEN_INCAMP_GEN_20260228_0001__LANDSCAPE__camp-equipment-working.jpg
    → "camp equipment working"
    """
    try:
        stem = Path(canonical_name).stem
        parts = stem.split("__")
        if len(parts) >= 3:
            return parts[2].replace("-", " ").strip()
        if len(parts) == 2:
            return parts[1].replace("-", " ").strip()
    except Exception:
        pass
    return None


def _parse_canonical_filename(filename: str) -> Dict[str, Optional[str]]:
    """
    Parse an Integrity canonical filename.
    Format: {PILLAR}_{TYPE}_{LOCATION}_{SUBJECT}_{ACTION}_{DATE}_{SEQ}__{ORIENTATION}__{description}.ext
    """
    result: Dict[str, Optional[str]] = {
        "pillar": None, "project": None, "subject": None,
        "action": None, "orientation": None, "description": None,
        "content_type": None,
    }
    try:
        stem = Path(filename).stem
        parts = stem.split("__")
        if len(parts) >= 3:
            result["description"] = parts[2].replace("-", " ").strip()
        if len(parts) >= 2:
            result["orientation"] = parts[1].upper()
        if parts:
            code_parts = parts[0].split("_")
            if len(code_parts) >= 1:
                p = code_parts[0].upper()
                result["pillar"] = p
            if len(code_parts) >= 2:
                t = code_parts[1].upper()
                if t in CONTENT_TYPE_MAP:
                    result["content_type"] = CONTENT_TYPE_MAP[t]
            if len(code_parts) >= 3:
                loc = code_parts[2].upper()
                if loc in LOCATION_MAP:
                    result["project"] = LOCATION_MAP[loc]
                elif loc != "UNK":
                    result["project"] = loc
            if len(code_parts) >= 4:
                result["subject"] = code_parts[3].upper()
            if len(code_parts) >= 5:
                result["action"] = code_parts[4].upper()
    except Exception:
        pass
    return result


def _infer_library_metadata(filepath: str, library_root: str) -> Dict[str, Optional[str]]:
    """Infer category and project from file path relative to library root."""
    result: Dict[str, Optional[str]] = {
        "relative_path": None, "category": None, "project": None, "pillar": None,
    }
    try:
        rel = os.path.relpath(filepath, library_root)
        result["relative_path"] = rel
    except ValueError:
        return result

    parts = Path(rel).parts
    if not parts:
        return result

    top = parts[0].upper()
    if top in KNOWN_CATEGORIES:
        result["category"] = parts[0]

    # Walk path parts for known location codes
    for part in parts:
        part_upper = part.upper()
        for code, name in LOCATION_MAP.items():
            if code == part_upper or (len(code) >= 3 and code in part_upper):
                result["project"] = name
                break
        if result["project"]:
            break

    # Walk path parts for known pillar codes
    for part in parts:
        part_upper = part.upper()
        for code in PILLAR_MAP:
            if code == part_upper or code in part_upper:
                result["pillar"] = code
                break
        if result["pillar"]:
            break

    return result


def scan_directory(
    directory: Optional[str] = None,
    library_root: Optional[str] = None,
) -> ScanResult:
    """Walk a directory recursively and return media files with enriched metadata."""
    root = directory or DEFAULT_LIBRARY_ROOT
    lib_root = library_root or INTEGRITY_ROOT
    result = ScanResult(scanned_root=root)

    if not os.path.isdir(root):
        result.errors.append(f"Directory not found: {root}")
        return result

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not _should_skip_dir(d)]

        for fname in filenames:
            result.total_scanned += 1

            if _should_skip_file(fname):
                result.skipped_ignored += 1
                continue

            ext = os.path.splitext(fname)[1].lower()
            media_type = classify_media_type(ext)
            if media_type is None:
                result.skipped_non_media += 1
                continue

            full_path = os.path.join(dirpath, fname)
            try:
                stat = os.stat(full_path)
                mime, _ = mimetypes.guess_type(full_path)
                file_hash = compute_sha256(full_path)

                width, height, duration = None, None, None
                if media_type == "image":
                    width, height = _extract_image_dimensions(full_path)
                elif media_type == "video":
                    width, height, duration = _extract_video_metadata(full_path)
                elif media_type == "audio":
                    duration = _extract_audio_duration(full_path)

                # Three-source metadata merge (priority: sidecar > filename > path)
                path_meta = _infer_library_metadata(full_path, lib_root)
                canonical_meta = _parse_canonical_filename(fname)
                sidecar_meta = _parse_sidecar(full_path)

                pillar = sidecar_meta.get("pillar") or canonical_meta.get("pillar") or path_meta["pillar"]
                project = sidecar_meta.get("project") or canonical_meta.get("project") or path_meta["project"]
                content_type = sidecar_meta.get("content_type") or canonical_meta.get("content_type")

                result.files.append(ScannedFile(
                    path=full_path,
                    filename=fname,
                    media_type=media_type,
                    file_size=stat.st_size,
                    mime_type=mime,
                    hash=file_hash,
                    width=width,
                    height=height,
                    duration=duration,
                    extension=ext,
                    relative_path=path_meta["relative_path"],
                    category=path_meta["category"] or "LIBRARY",
                    project=project,
                    pillar=pillar,
                    description=sidecar_meta.get("description") or canonical_meta.get("description"),
                    orientation=sidecar_meta.get("orientation") or canonical_meta.get("orientation"),
                    subject=sidecar_meta.get("subject") or canonical_meta.get("subject"),
                    action=sidecar_meta.get("action") or canonical_meta.get("action"),
                    content_type=content_type,
                    ai_keywords=sidecar_meta.get("ai_keywords"),
                    ai_confidence=sidecar_meta.get("ai_confidence"),
                ))
            except OSError as e:
                result.errors.append(f"Error reading {full_path}: {e}")

    return result
