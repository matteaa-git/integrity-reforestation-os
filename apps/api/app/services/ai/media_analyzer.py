"""
Media Analysis Service
======================
Extracts per-clip metadata needed by the AI reel director:
  - scene cut timestamps (via ffmpeg scene filter)
  - motion score (average frame diff, proxy for visual energy)
  - audio loudness (RMS, proxy for audio energy)
  - duration, resolution, fps
  - portrait suitability score (9:16 crop quality)

All analysis is non-destructive and read-only against source files.
Results are cached in-memory by asset_id so repeated calls are free.
"""

import json
import math
import subprocess
import tempfile
from pathlib import Path
from typing import Optional, List, Dict, Tuple, Set, TypedDict

# ── Types ──────────────────────────────────────────────────────────────────

class SceneCut(TypedDict):
    timestamp: float       # seconds from clip start
    score: float           # 0-1, how different this scene is from the prev


class ClipAnalysis(TypedDict):
    asset_id: str
    duration: float
    width: int
    height: int
    fps: float
    is_portrait: bool          # True if h > w (9:16 native)
    portrait_score: float      # 0-1, how suitable for 9:16 crop
    scene_cuts: List[SceneCut]
    motion_score: float        # 0-1, average visual energy
    audio_rms: float           # 0-1 normalised loudness
    has_speech: bool           # True if audio RMS above speech threshold
    strongest_moment: float    # timestamp of highest-motion second


# ── In-memory cache ───────────────────────────────────────────────────────

_cache: Dict[str, ClipAnalysis] = {}


# ── Public API ────────────────────────────────────────────────────────────

def analyze_clip(asset_id: str, filepath: str) -> ClipAnalysis:
    """Analyze a video clip and return structured metadata. Results are cached."""
    if asset_id in _cache:
        return _cache[asset_id]

    path = Path(filepath)
    if not path.exists():
        raise FileNotFoundError(filepath)

    probe = _ffprobe(filepath)
    video_stream = next((s for s in probe.get("streams", []) if s["codec_type"] == "video"), None)
    audio_stream = next((s for s in probe.get("streams", []) if s["codec_type"] == "audio"), None)

    if not video_stream:
        raise ValueError(f"No video stream in {filepath}")

    # Basic metadata
    duration = float(probe.get("format", {}).get("duration", 0))
    width = int(video_stream.get("width", 0))
    height = int(video_stream.get("height", 0))
    fps_str = video_stream.get("r_frame_rate", "30/1")
    try:
        num, den = fps_str.split("/")
        fps = float(num) / float(den)
    except Exception:
        fps = 30.0

    is_portrait = height > width
    portrait_score = _portrait_score(width, height)

    # Scene detection
    scene_cuts = _detect_scenes(filepath, duration)

    # Motion score from scene variance
    motion_score = _motion_score(scene_cuts, duration)

    # Audio loudness
    audio_rms, has_speech = _audio_analysis(filepath) if audio_stream else (0.0, False)

    # Strongest moment = scene cut with highest score, or peak if no cuts
    strongest_moment = _find_strongest_moment(scene_cuts, duration)

    result: ClipAnalysis = {
        "asset_id": asset_id,
        "duration": duration,
        "width": width,
        "height": height,
        "fps": fps,
        "is_portrait": is_portrait,
        "portrait_score": portrait_score,
        "scene_cuts": scene_cuts,
        "motion_score": motion_score,
        "audio_rms": audio_rms,
        "has_speech": has_speech,
        "strongest_moment": strongest_moment,
    }

    _cache[asset_id] = result
    return result


def analyze_clips_batch(assets: List[dict]) -> List[ClipAnalysis]:
    """Analyze multiple clips. Skips non-video assets silently."""
    results = []
    for asset in assets:
        if asset.get("media_type") != "video":
            continue
        try:
            result = analyze_clip(asset["id"], asset["path"])
            results.append(result)
        except Exception as e:
            print(f"[media_analyzer] skipping {asset.get('filename')}: {e}")
    return results


def get_cached(asset_id: str) -> Optional[ClipAnalysis]:
    return _cache.get(asset_id)


def clear_cache(asset_id: Optional[str] = None) -> None:
    if asset_id:
        _cache.pop(asset_id, None)
    else:
        _cache.clear()


# ── Internal helpers ───────────────────────────────────────────────────────

def _ffprobe(filepath: str) -> dict:
    cmd = [
        "ffprobe", "-v", "quiet",
        "-print_format", "json",
        "-show_streams", "-show_format",
        filepath,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    return json.loads(result.stdout)


def _detect_scenes(filepath: str, duration: float) -> List[SceneCut]:
    """
    Use ffmpeg's scene filter to detect scene changes.
    Returns a list of timestamps where scene changes occur.
    Threshold 0.3 catches hard cuts; 0.15 also catches soft transitions.
    """
    threshold = 0.3
    cmd = [
        "ffmpeg", "-i", filepath,
        "-vf", f"select='gt(scene,{threshold})',showinfo",
        "-vsync", "vfr",
        "-f", "null", "-",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    stderr = result.stderr

    cuts: List[SceneCut] = []
    for line in stderr.splitlines():
        if "showinfo" in line and "pts_time:" in line:
            try:
                pts_part = line.split("pts_time:")[1].split()[0]
                ts = float(pts_part)
                # Extract scene score from the select filter output
                score_part = line.split("scene_score=")
                score = float(score_part[1].split()[0]) if len(score_part) > 1 else 0.5
                cuts.append({"timestamp": ts, "score": min(1.0, score)})
            except (IndexError, ValueError):
                continue

    # If no scene cuts detected, add an artificial one at the midpoint
    if not cuts and duration > 0:
        cuts.append({"timestamp": duration / 2, "score": 0.3})

    return sorted(cuts, key=lambda c: c["timestamp"])


def _motion_score(scene_cuts: List[SceneCut], duration: float) -> float:
    """
    Estimate visual energy from scene cut density + score magnitude.
    More frequent cuts with higher scores = higher motion.
    Normalised to 0-1.
    """
    if not scene_cuts or duration <= 0:
        return 0.1  # static/minimal motion
    avg_score = sum(c["score"] for c in scene_cuts) / len(scene_cuts)
    cut_density = min(1.0, len(scene_cuts) / max(1, duration / 3))  # expect 1 cut per 3s
    return round((avg_score * 0.6 + cut_density * 0.4), 3)


def _audio_analysis(filepath: str) -> Tuple[float, bool]:
    """
    Measure audio RMS loudness using ffmpeg astats filter.
    Returns (normalised_rms 0-1, has_speech bool).
    Speech threshold: RMS > 0.15 suggests vocal content.
    """
    cmd = [
        "ffmpeg", "-i", filepath,
        "-af", "astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level",
        "-vn", "-f", "null", "-",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

    rms_values = []
    for line in result.stderr.splitlines():
        if "RMS_level=" in line:
            try:
                val = float(line.split("=")[1].strip())
                if not math.isinf(val):
                    rms_values.append(val)
            except (IndexError, ValueError):
                continue

    if not rms_values:
        return 0.0, False

    avg_rms_db = sum(rms_values) / len(rms_values)
    # Convert dBFS to 0-1 scale (0 dBFS = full scale, -60 dBFS ≈ silence)
    normalised = max(0.0, min(1.0, (avg_rms_db + 60) / 60))
    has_speech = normalised > 0.15
    return round(normalised, 3), has_speech


def _portrait_score(width: int, height: int) -> float:
    """
    Score how well the clip suits a 9:16 crop (0-1).
    Native 9:16 portrait = 1.0
    Square = 0.6
    Wide landscape = 0.3 (needs heavy cropping)
    """
    if width <= 0 or height <= 0:
        return 0.5
    aspect = width / height
    target = 9 / 16  # 0.5625
    if aspect <= target:
        return 1.0  # portrait or narrower — perfect
    # Score decreases as aspect ratio gets wider
    ratio = target / aspect
    return round(max(0.1, ratio), 3)


def _find_strongest_moment(scene_cuts: List[SceneCut], duration: float) -> float:
    """Return the timestamp of the highest-score scene cut, or 0.0."""
    if not scene_cuts:
        return 0.0
    best = max(scene_cuts, key=lambda c: c["score"])
    return best["timestamp"]
