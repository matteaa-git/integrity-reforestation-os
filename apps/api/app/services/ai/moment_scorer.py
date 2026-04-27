"""
Moment Scoring Engine
=====================
Scores video clips on multiple dimensions to determine their value
for reel assembly. Outputs a ranked list of clips with best-use segments.

Scoring dimensions (all 0-1):
  - hook_score:             suitability for the opening hook
  - motion_score:           visual energy and movement
  - audio_score:            audio presence and speech clarity
  - portrait_score:         native 9:16 suitability
  - brand_score:            heuristic brand relevance (file path / category)
  - emotion_score:          predicted emotional impact on viewer
  - clarity_score:          visual readability and composition quality
  - engagement_score:       predicted watch-through retention strength

Final composite score weights are tuned for Instagram Reels:
  hook(25%) + motion(20%) + audio(18%) + portrait(12%) + brand(8%)
  + emotion(10%) + clarity(7%)
"""

from typing import Optional, List, Dict, Tuple, Set, TypedDict
from .media_analyzer import ClipAnalysis
from .transcript_service import Transcript


# ── Types ──────────────────────────────────────────────────────────────────

class ClipScore(TypedDict):
    asset_id: str
    filename: str
    composite: float             # 0-1 weighted final score
    hook_score: float
    motion_score: float
    audio_score: float
    portrait_score: float
    brand_score: float
    emotion_score: float         # emotional impact on viewer
    clarity_score: float         # visual readability / composition quality
    engagement_score: float      # predicted watch-through retention
    story_role_suggestion: str   # best narrative arc slot for this clip
    best_in_point: float         # recommended trim start (seconds)
    best_out_point: float        # recommended trim end (seconds)
    best_duration: float         # best_out - best_in
    hook_text: str               # suggested hook caption (from transcript)
    notes: List[str]             # human-readable reasoning


class ScoredLibrary(TypedDict):
    clips: List[ClipScore]
    best_hook: Optional[ClipScore]
    best_motion: Optional[ClipScore]
    avg_composite: float


# ── Scoring weights ────────────────────────────────────────────────────────

WEIGHTS = {
    "hook":      0.25,
    "motion":    0.20,
    "audio":     0.18,
    "portrait":  0.12,
    "brand":     0.08,
    "emotion":   0.10,
    "clarity":   0.07,
}

# Brand-relevant keywords found in file paths / categories
BRAND_KEYWORDS = [
    "camp", "field", "forest", "plant", "tree", "nature", "outdoor",
    "reforest", "green", "work", "team", "action", "integrity",
    "bts", "behind", "story", "brand",
]

# Hook-quality indicators in transcript text
HOOK_PHRASES = [
    "did you know", "most people", "nobody talks", "the truth",
    "stop doing", "here's why", "this is why", "before you",
    "you need to", "the secret", "we plant", "trees", "impact",
]


# ── Public API ─────────────────────────────────────────────────────────────

def score_clip(
    analysis: ClipAnalysis,
    transcript: Optional[Transcript] = None,
    target_duration: float = 15.0,
) -> ClipScore:
    """Score a single clip across all dimensions."""
    asset_id = analysis["asset_id"]
    filename = ""   # caller sets this from asset metadata
    notes: List[str] = []

    # ── Hook score ──────────────────────────────────────────────────────
    hook_score = _compute_hook_score(analysis, transcript, notes)

    # ── Motion score ────────────────────────────────────────────────────
    motion_score = analysis["motion_score"]
    if motion_score > 0.7:
        notes.append("High motion — good energy")
    elif motion_score < 0.2:
        notes.append("Low motion — better for talking-head or B-roll")

    # ── Audio score ─────────────────────────────────────────────────────
    audio_score = _compute_audio_score(analysis, transcript, notes)

    # ── Portrait score ───────────────────────────────────────────────────
    portrait_score = analysis["portrait_score"]
    if portrait_score < 0.5:
        notes.append("Wide aspect — will be cropped for 9:16")

    # ── Brand score ──────────────────────────────────────────────────────
    brand_score = 0.5  # default neutral (caller may supply filename)

    # ── Emotion score ─────────────────────────────────────────────────────
    # Proxy: motion + audio dynamics + hook language → emotional engagement
    emotion_score = _compute_emotion_score(hook_score, motion_score, audio_score)

    # ── Clarity score ─────────────────────────────────────────────────────
    # Proxy: portrait framing + stable (non-chaotic) motion + audible audio
    clarity_score = _compute_clarity_score(portrait_score, motion_score, audio_score)

    # ── Engagement score ──────────────────────────────────────────────────
    # Predicted watch-through retention strength
    engagement_score = _compute_engagement_score(hook_score, motion_score, audio_score, emotion_score)

    # ── Story role suggestion ─────────────────────────────────────────────
    story_role_suggestion = _suggest_story_role(hook_score, motion_score, audio_score)

    # ── Composite ────────────────────────────────────────────────────────
    composite = (
        hook_score     * WEIGHTS["hook"] +
        motion_score   * WEIGHTS["motion"] +
        audio_score    * WEIGHTS["audio"] +
        portrait_score * WEIGHTS["portrait"] +
        brand_score    * WEIGHTS["brand"] +
        emotion_score  * WEIGHTS["emotion"] +
        clarity_score  * WEIGHTS["clarity"]
    )
    composite = round(min(1.0, max(0.0, composite)), 3)

    # ── Best trim window ──────────────────────────────────────────────────
    best_in, best_out = _find_best_window(analysis, transcript, target_duration)

    # ── Hook text ─────────────────────────────────────────────────────────
    hook_text = ""
    if transcript and transcript["hook_candidate"]:
        hook_text = transcript["hook_candidate"]

    return {
        "asset_id": asset_id,
        "filename": filename,
        "composite": composite,
        "hook_score": round(hook_score, 3),
        "motion_score": round(motion_score, 3),
        "audio_score": round(audio_score, 3),
        "portrait_score": round(portrait_score, 3),
        "brand_score": round(brand_score, 3),
        "emotion_score": round(emotion_score, 3),
        "clarity_score": round(clarity_score, 3),
        "engagement_score": round(engagement_score, 3),
        "story_role_suggestion": story_role_suggestion,
        "best_in_point": round(best_in, 2),
        "best_out_point": round(best_out, 2),
        "best_duration": round(best_out - best_in, 2),
        "hook_text": hook_text,
        "notes": notes,
    }


def score_library(
    analyses: List[ClipAnalysis],
    transcripts: Dict[str, Transcript],
    assets: List[dict],
    target_duration: float = 30.0,
) -> ScoredLibrary:
    """Score all analyzed clips and rank them."""
    asset_map = {a["id"]: a for a in assets}
    scored: List[ClipScore] = []

    for analysis in analyses:
        asset_id = analysis["asset_id"]
        asset = asset_map.get(asset_id)
        if not asset:
            continue

        transcript = transcripts.get(asset_id)
        clip_score = score_clip(analysis, transcript, target_duration)

        # Apply brand score from filename/path
        filename = asset.get("filename", "")
        relative_path = asset.get("relative_path", "").lower()
        brand_score = _brand_score(filename + " " + relative_path)
        clip_score["brand_score"] = brand_score
        clip_score["filename"] = filename

        # Recompute composite with real brand score
        clip_score["composite"] = round(min(1.0, (
            clip_score["hook_score"]     * WEIGHTS["hook"] +
            clip_score["motion_score"]   * WEIGHTS["motion"] +
            clip_score["audio_score"]    * WEIGHTS["audio"] +
            clip_score["portrait_score"] * WEIGHTS["portrait"] +
            brand_score                  * WEIGHTS["brand"] +
            clip_score["emotion_score"]  * WEIGHTS["emotion"] +
            clip_score["clarity_score"]  * WEIGHTS["clarity"]
        )), 3)

        scored.append(clip_score)

    scored.sort(key=lambda c: c["composite"], reverse=True)

    avg = sum(c["composite"] for c in scored) / max(1, len(scored))
    best_hook = max(scored, key=lambda c: c["hook_score"]) if scored else None
    best_motion = max(scored, key=lambda c: c["motion_score"]) if scored else None

    return {
        "clips": scored,
        "best_hook": best_hook,
        "best_motion": best_motion,
        "avg_composite": round(avg, 3),
    }


# ── Internal helpers ───────────────────────────────────────────────────────

def _compute_emotion_score(hook: float, motion: float, audio: float) -> float:
    """Proxy for emotional impact: hook language + kinetic energy + vocal presence."""
    return round(min(1.0, hook * 0.30 + motion * 0.35 + audio * 0.35), 3)


def _compute_clarity_score(portrait: float, motion: float, audio: float) -> float:
    """Visual readability: well-framed, not chaotic, audible.
    Penalises extremely hectic motion (hard to read text/subjects)."""
    chaos_penalty = max(0.0, motion - 0.65) * 0.5
    return round(min(1.0, max(0.0,
        portrait * 0.50 + audio * 0.30 + (0.20 - chaos_penalty)
    )), 3)


def _compute_engagement_score(hook: float, motion: float, audio: float, emotion: float) -> float:
    """Predicted watch-through retention."""
    return round(min(1.0, hook * 0.35 + motion * 0.20 + audio * 0.20 + emotion * 0.25), 3)


def _suggest_story_role(hook: float, motion: float, audio: float) -> str:
    """Map clip characteristics to the most suitable narrative arc slot."""
    if hook >= 0.65:
        return "hook"
    if audio >= 0.60 and motion < 0.45:
        return "setup"
    if audio >= 0.55 and motion >= 0.45:
        return "proof"
    if motion >= 0.65 and audio < 0.35:
        return "escalation"
    if motion >= 0.45 and audio >= 0.45:
        return "payoff"
    return "broll"


def _compute_hook_score(
    analysis: ClipAnalysis,
    transcript: Optional[Transcript],
    notes: List[str],
) -> float:
    """Score how good this clip would be for the opening 2 seconds."""
    score = 0.5  # base

    # Strong opening motion boosts hook score
    if analysis["motion_score"] > 0.6:
        score += 0.2
        notes.append("Strong opening motion — good hook candidate")

    # Speech in the first segment suggests a talking-head hook
    if transcript and transcript["has_speech"]:
        first_word = transcript["word_count"] > 0
        if first_word:
            # Check if hook phrase appears early in transcript
            first_text = " ".join(
                s["text"] for s in transcript["segments"][:2]
            ).lower()
            if any(phrase in first_text for phrase in HOOK_PHRASES):
                score += 0.3
                notes.append("Hook phrase detected in opening speech")
            else:
                score += 0.1

    # Portrait orientation preferred for hook
    if analysis["portrait_score"] > 0.8:
        score += 0.1

    # Penalise very short clips (<2s) — bad for hooks
    if analysis["duration"] < 2.0:
        score -= 0.3
        notes.append("Clip too short for hook (<2s)")

    return min(1.0, max(0.0, score))


def _compute_audio_score(
    analysis: ClipAnalysis,
    transcript: Optional[Transcript],
    notes: List[str],
) -> float:
    """Score the audio quality and presence."""
    score = analysis["audio_rms"]

    if transcript:
        if transcript["has_speech"]:
            score = min(1.0, score + 0.2)
            notes.append("Contains speech")
        if transcript["word_count"] > 20:
            score = min(1.0, score + 0.1)

    return score


def _brand_score(text: str) -> float:
    """Score brand relevance from filename/path keywords."""
    text_lower = text.lower()
    hits = sum(1 for kw in BRAND_KEYWORDS if kw in text_lower)
    return round(min(1.0, 0.3 + hits * 0.1), 3)


def _find_best_window(
    analysis: ClipAnalysis,
    transcript: Optional[Transcript],
    target_duration: float,
) -> Tuple[float, float]:
    """
    Find the best in/out trim points within a clip.
    Prefers the window containing the strongest scene change.
    Respects target_duration max.
    """
    duration = analysis["duration"]
    target = min(target_duration, duration)

    if target >= duration:
        return 0.0, duration

    # Start at the strongest moment, backtrack half the target duration
    strongest = analysis["strongest_moment"]
    half = target / 2

    in_point = max(0.0, strongest - half)
    out_point = min(duration, in_point + target)

    # Ensure we have the full target duration
    if out_point - in_point < target:
        in_point = max(0.0, out_point - target)

    # If transcript exists, align in_point to a segment boundary
    if transcript and transcript["segments"]:
        best_segment_start = min(
            transcript["segments"],
            key=lambda s: abs(s["start"] - in_point),
        )
        in_point = best_segment_start["start"]
        out_point = min(duration, in_point + target)

    return round(in_point, 2), round(out_point, 2)
