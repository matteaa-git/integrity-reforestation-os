"""
Transcript Service
==================
Extracts speech transcripts from video/audio clips using OpenAI Whisper (local).

Model selection:
  - "tiny"  — fastest, least accurate (~1s per minute of audio)
  - "base"  — good balance for most use cases (~3s per minute)
  - "small" — better accuracy (~8s per minute)

The service extracts audio to a temp WAV, runs Whisper, and returns
word-level segments suitable for generating captions and scoring moments.

Results are cached per asset_id. Re-transcription only happens on cache clear.
"""

import subprocess
import tempfile
from pathlib import Path
from typing import Optional, List, Dict, Tuple, Set, TypedDict

# ── Types ──────────────────────────────────────────────────────────────────

class TranscriptSegment(TypedDict):
    start: float     # seconds from clip start
    end: float       # seconds
    text: str        # transcribed text for this segment
    confidence: float  # 0-1 (from Whisper avg_logprob)


class Transcript(TypedDict):
    asset_id: str
    language: str
    full_text: str
    segments: List[TranscriptSegment]
    has_speech: bool
    word_count: int
    hook_candidate: str   # first strong sentence (good caption)
    cta_candidate: str    # last strong sentence


# ── Cache ─────────────────────────────────────────────────────────────────

_cache: Dict[str, Transcript] = {}
_whisper_model = None   # lazy-loaded


# ── Public API ────────────────────────────────────────────────────────────

def transcribe(asset_id: str, filepath: str, model_size: str = "base") -> Transcript:
    """
    Transcribe a video or audio file. Returns cached result if available.
    First call loads the Whisper model (~2s for 'base').
    """
    if asset_id in _cache:
        return _cache[asset_id]

    path = Path(filepath)
    if not path.exists():
        raise FileNotFoundError(filepath)

    audio_path = _extract_audio(filepath)
    try:
        raw = _run_whisper(audio_path, model_size)
    finally:
        audio_path.unlink(missing_ok=True)

    result = _build_transcript(asset_id, raw)
    _cache[asset_id] = result
    return result


def get_cached(asset_id: str) -> Optional[Transcript]:
    return _cache.get(asset_id)


def clear_cache(asset_id: Optional[str] = None) -> None:
    if asset_id:
        _cache.pop(asset_id, None)
    else:
        _cache.clear()


def generate_captions(transcript: Transcript, max_chars: int = 40) -> List[dict]:
    """
    Convert transcript segments into Caption objects compatible with the
    reel editor's Caption schema (id, text, startTime, endTime, style).

    Breaks long segments at sentence boundaries to fit mobile screens.
    """
    import uuid
    captions = []
    style = "bold"  # default caption style for AI-generated content

    for seg in transcript["segments"]:
        if not seg["text"].strip():
            continue

        text = seg["text"].strip()
        duration = seg["end"] - seg["start"]

        # Split long text into chunks
        chunks = _split_text(text, max_chars)
        chunk_duration = duration / max(1, len(chunks))

        for i, chunk in enumerate(chunks):
            start = seg["start"] + i * chunk_duration
            end = start + chunk_duration
            captions.append({
                "id": str(uuid.uuid4()),
                "text": chunk,
                "startTime": round(start, 2),
                "endTime": round(end, 2),
                "style": style,
            })

    return captions


# ── Internal ──────────────────────────────────────────────────────────────

def _extract_audio(filepath: str) -> Path:
    """Extract audio track to a 16kHz mono WAV (Whisper's preferred format)."""
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()

    cmd = [
        "ffmpeg", "-y", "-i", filepath,
        "-ar", "16000",          # 16kHz sample rate
        "-ac", "1",              # mono
        "-c:a", "pcm_s16le",     # PCM 16-bit
        tmp.name,
    ]
    subprocess.run(cmd, capture_output=True, timeout=120, check=True)
    return Path(tmp.name)


def _run_whisper(audio_path: Path, model_size: str) -> dict:
    """Load Whisper model (cached globally) and transcribe."""
    global _whisper_model

    try:
        import whisper
    except ImportError:
        raise RuntimeError("openai-whisper is not installed. Run: pip install openai-whisper")

    if _whisper_model is None or getattr(_whisper_model, "_model_size", None) != model_size:
        _whisper_model = whisper.load_model(model_size)
        _whisper_model._model_size = model_size

    result = _whisper_model.transcribe(
        str(audio_path),
        fp16=False,           # fp32 for CPU compatibility
        language=None,        # auto-detect
        verbose=False,
    )
    return result


def _build_transcript(asset_id: str, raw: dict) -> Transcript:
    segments: List[TranscriptSegment] = []

    for seg in raw.get("segments", []):
        text = seg.get("text", "").strip()
        if not text:
            continue
        avg_logprob = seg.get("avg_logprob", -1.0)
        confidence = max(0.0, min(1.0, (avg_logprob + 1.0)))  # -1 to 0 → 0 to 1
        segments.append({
            "start": round(float(seg["start"]), 2),
            "end": round(float(seg["end"]), 2),
            "text": text,
            "confidence": round(confidence, 3),
        })

    full_text = " ".join(s["text"] for s in segments)
    has_speech = len(full_text.strip()) > 3
    word_count = len(full_text.split())

    hook_candidate = _extract_hook(segments)
    cta_candidate = _extract_cta(segments)

    return {
        "asset_id": asset_id,
        "language": raw.get("language", "en"),
        "full_text": full_text,
        "segments": segments,
        "has_speech": has_speech,
        "word_count": word_count,
        "hook_candidate": hook_candidate,
        "cta_candidate": cta_candidate,
    }


def _extract_hook(segments: List[TranscriptSegment]) -> str:
    """Return the first high-confidence segment as the hook candidate."""
    for seg in segments[:3]:
        if seg["confidence"] > 0.5 and len(seg["text"]) > 5:
            return seg["text"]
    return segments[0]["text"] if segments else ""


def _extract_cta(segments: List[TranscriptSegment]) -> str:
    """Return the last meaningful segment as a CTA candidate."""
    for seg in reversed(segments[-3:]):
        if seg["confidence"] > 0.4 and len(seg["text"]) > 5:
            return seg["text"]
    return segments[-1]["text"] if segments else ""


def _split_text(text: str, max_chars: int) -> List[str]:
    """Break text into caption-friendly chunks of max_chars each."""
    if len(text) <= max_chars:
        return [text]

    words = text.split()
    chunks = []
    current = ""

    for word in words:
        if len(current) + len(word) + 1 <= max_chars:
            current = f"{current} {word}".strip()
        else:
            if current:
                chunks.append(current)
            current = word

    if current:
        chunks.append(current)

    return chunks
