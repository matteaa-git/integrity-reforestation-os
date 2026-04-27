"""
AI Reel Director — Timeline Generator
======================================
Takes a scored clip library and a reel strategy and assembles a complete
reel timeline payload that maps directly into the existing reel editor's
state schema (clips, trims, captions, text overlays).

The output is NOT a rendered video — it's a JSON timeline that the editor
loads via its existing loadTimeline() mechanism. All edits remain possible.

Story structures (narrative arcs):
  - "narrative"         — Hook → Setup → Proof → Escalation → Payoff → CTA
  - "hook_reveal"       — Hook → Build → Build → Reveal → CTA
  - "problem_solution"  — Hook → Problem → Solution → Proof → CTA
  - "montage"           — Hook → Impact × 4 → CTA
  - "testimonial"       — Hook → Story → B-Roll → Impact → CTA
  - "educational"       — Hook → Teach → B-Roll → Recap → CTA

Strategy params (objective, audience, tone) tune CTA copy, caption style,
and clip-selection bias within the chosen structure.
"""

import uuid
from typing import Optional, List, Dict, Tuple, Set, TypedDict

from .moment_scorer import ClipScore, ScoredLibrary


# ── Types ──────────────────────────────────────────────────────────────────

class ClipSlot(TypedDict):
    role: str              # internal role key
    story_role: str        # display label shown in UI
    target_duration: float
    prefer_motion: bool
    prefer_speech: bool
    prefer_hook: bool
    prefer_emotion: bool
    prefer_clarity: bool


class TimelineClip(TypedDict):
    asset_id: str
    filename: str
    position: int
    in_point: float        # seconds (trim start)
    out_point: float       # seconds (trim end)
    duration: float        # out_point - in_point
    role: str
    story_role: str        # display label: "Hook", "Setup", "Proof" …
    why_chosen: str        # one-sentence explanation of clip selection
    effects: dict          # ClipEffects compatible


class TimelineCaption(TypedDict):
    id: str
    text: str
    startTime: float
    endTime: float
    style: str             # "default" | "bold" | "highlight" | "subtitle"


class TimelineTextOverlay(TypedDict):
    id: str
    text: str
    x: float
    y: float
    fontSize: int
    fontFamily: str
    fontWeight: str
    color: str
    opacity: float
    textAlign: str
    rotation: float
    dropShadow: bool
    bgStyle: str
    bgColor: str
    startTime: float
    endTime: float


class ReelTimeline(TypedDict):
    """Complete timeline payload — maps to reel editor state."""
    style: str
    target_duration: float
    actual_duration: float
    clips: List[TimelineClip]
    captions: List[TimelineCaption]
    text_overlays: List[TimelineTextOverlay]
    hook_text: str
    cta_text: str
    music_suggestion: str     # category/mood hint for music selection
    generation_notes: List[str]


# ── Story structure templates ──────────────────────────────────────────────
# Each slot has prefer_* flags that weight the clip-selection scorer.
# story_role is the display label shown to the user in the editor UI.

_S = True
_N = False

REEL_STRUCTURES: Dict[str, List[ClipSlot]] = {

    # ── Full Narrative Arc: Hook → Setup → Proof → Escalation → Payoff → CTA ──
    "narrative": [
        {"role": "hook",       "story_role": "Hook",       "target_duration": 2.5,  "prefer_hook": _S, "prefer_motion": _S, "prefer_speech": _S, "prefer_emotion": _S, "prefer_clarity": _N},
        {"role": "setup",      "story_role": "Setup",      "target_duration": 5.0,  "prefer_hook": _N, "prefer_motion": _N, "prefer_speech": _S, "prefer_emotion": _N, "prefer_clarity": _S},
        {"role": "proof",      "story_role": "Proof",      "target_duration": 5.0,  "prefer_hook": _N, "prefer_motion": _N, "prefer_speech": _S, "prefer_emotion": _N, "prefer_clarity": _S},
        {"role": "escalation", "story_role": "Escalation", "target_duration": 4.0,  "prefer_hook": _N, "prefer_motion": _S, "prefer_speech": _N, "prefer_emotion": _S, "prefer_clarity": _N},
        {"role": "payoff",     "story_role": "Payoff",     "target_duration": 5.0,  "prefer_hook": _N, "prefer_motion": _S, "prefer_speech": _S, "prefer_emotion": _S, "prefer_clarity": _S},
        {"role": "cta",        "story_role": "CTA",        "target_duration": 2.5,  "prefer_hook": _N, "prefer_motion": _N, "prefer_speech": _S, "prefer_emotion": _N, "prefer_clarity": _S},
    ],

    # ── Hook + Reveal ─────────────────────────────────────────────────────────
    "hook_reveal": [
        {"role": "hook",    "story_role": "Hook",   "target_duration": 2.5,  "prefer_hook": _S, "prefer_motion": _S, "prefer_speech": _S, "prefer_emotion": _S, "prefer_clarity": _N},
        {"role": "buildup", "story_role": "Build",  "target_duration": 5.0,  "prefer_hook": _N, "prefer_motion": _S, "prefer_speech": _N, "prefer_emotion": _S, "prefer_clarity": _N},
        {"role": "buildup", "story_role": "Build",  "target_duration": 5.0,  "prefer_hook": _N, "prefer_motion": _N, "prefer_speech": _S, "prefer_emotion": _N, "prefer_clarity": _S},
        {"role": "reveal",  "story_role": "Reveal", "target_duration": 7.0,  "prefer_hook": _N, "prefer_motion": _S, "prefer_speech": _S, "prefer_emotion": _S, "prefer_clarity": _S},
        {"role": "cta",     "story_role": "CTA",    "target_duration": 3.0,  "prefer_hook": _N, "prefer_motion": _N, "prefer_speech": _S, "prefer_emotion": _N, "prefer_clarity": _S},
    ],

    # ── Problem → Solution ────────────────────────────────────────────────────
    "problem_solution": [
        {"role": "hook",     "story_role": "Hook",     "target_duration": 2.0,  "prefer_hook": _S, "prefer_motion": _S, "prefer_speech": _S, "prefer_emotion": _S, "prefer_clarity": _N},
        {"role": "problem",  "story_role": "Problem",  "target_duration": 6.0,  "prefer_hook": _N, "prefer_motion": _N, "prefer_speech": _S, "prefer_emotion": _S, "prefer_clarity": _S},
        {"role": "solution", "story_role": "Solution", "target_duration": 8.0,  "prefer_hook": _N, "prefer_motion": _S, "prefer_speech": _S, "prefer_emotion": _S, "prefer_clarity": _S},
        {"role": "proof",    "story_role": "Proof",    "target_duration": 5.0,  "prefer_hook": _N, "prefer_motion": _N, "prefer_speech": _S, "prefer_emotion": _N, "prefer_clarity": _S},
        {"role": "cta",      "story_role": "CTA",      "target_duration": 3.0,  "prefer_hook": _N, "prefer_motion": _N, "prefer_speech": _S, "prefer_emotion": _N, "prefer_clarity": _S},
    ],

    # ── Montage ───────────────────────────────────────────────────────────────
    "montage": [
        {"role": "hook",  "story_role": "Hook",   "target_duration": 1.5,  "prefer_hook": _S, "prefer_motion": _S, "prefer_speech": _N, "prefer_emotion": _S, "prefer_clarity": _N},
        {"role": "main",  "story_role": "Impact", "target_duration": 3.0,  "prefer_hook": _N, "prefer_motion": _S, "prefer_speech": _N, "prefer_emotion": _S, "prefer_clarity": _N},
        {"role": "main",  "story_role": "Impact", "target_duration": 3.0,  "prefer_hook": _N, "prefer_motion": _S, "prefer_speech": _N, "prefer_emotion": _S, "prefer_clarity": _N},
        {"role": "main",  "story_role": "Impact", "target_duration": 3.0,  "prefer_hook": _N, "prefer_motion": _S, "prefer_speech": _N, "prefer_emotion": _S, "prefer_clarity": _N},
        {"role": "main",  "story_role": "Payoff", "target_duration": 3.0,  "prefer_hook": _N, "prefer_motion": _S, "prefer_speech": _N, "prefer_emotion": _S, "prefer_clarity": _N},
        {"role": "cta",   "story_role": "CTA",    "target_duration": 2.0,  "prefer_hook": _N, "prefer_motion": _N, "prefer_speech": _N, "prefer_emotion": _N, "prefer_clarity": _S},
    ],

    # ── Testimonial ───────────────────────────────────────────────────────────
    "testimonial": [
        {"role": "hook",        "story_role": "Hook",   "target_duration": 2.0,  "prefer_hook": _S, "prefer_motion": _S, "prefer_speech": _S, "prefer_emotion": _S, "prefer_clarity": _N},
        {"role": "testimonial", "story_role": "Story",  "target_duration": 12.0, "prefer_hook": _N, "prefer_motion": _N, "prefer_speech": _S, "prefer_emotion": _S, "prefer_clarity": _S},
        {"role": "broll",       "story_role": "B-Roll", "target_duration": 5.0,  "prefer_hook": _N, "prefer_motion": _S, "prefer_speech": _N, "prefer_emotion": _S, "prefer_clarity": _N},
        {"role": "payoff",      "story_role": "Impact", "target_duration": 5.0,  "prefer_hook": _N, "prefer_motion": _S, "prefer_speech": _S, "prefer_emotion": _S, "prefer_clarity": _S},
        {"role": "cta",         "story_role": "CTA",    "target_duration": 3.0,  "prefer_hook": _N, "prefer_motion": _N, "prefer_speech": _S, "prefer_emotion": _N, "prefer_clarity": _S},
    ],

    # ── Educational ───────────────────────────────────────────────────────────
    "educational": [
        {"role": "hook",  "story_role": "Hook",   "target_duration": 3.0,  "prefer_hook": _S, "prefer_motion": _N, "prefer_speech": _S, "prefer_emotion": _S, "prefer_clarity": _S},
        {"role": "main",  "story_role": "Teach",  "target_duration": 10.0, "prefer_hook": _N, "prefer_motion": _N, "prefer_speech": _S, "prefer_emotion": _N, "prefer_clarity": _S},
        {"role": "broll", "story_role": "B-Roll", "target_duration": 5.0,  "prefer_hook": _N, "prefer_motion": _S, "prefer_speech": _N, "prefer_emotion": _N, "prefer_clarity": _N},
        {"role": "main",  "story_role": "Recap",  "target_duration": 8.0,  "prefer_hook": _N, "prefer_motion": _N, "prefer_speech": _S, "prefer_emotion": _N, "prefer_clarity": _S},
        {"role": "cta",   "story_role": "CTA",    "target_duration": 4.0,  "prefer_hook": _N, "prefer_motion": _N, "prefer_speech": _S, "prefer_emotion": _N, "prefer_clarity": _S},
    ],
}

# CTA copy per story type — overridden by strategy objective when set
STYLE_CTAS: Dict[str, str] = {
    "narrative":        "Follow @integrityreforestation for more",
    "hook_reveal":      "Save this + follow for more",
    "problem_solution": "Link in bio — let's fix this together",
    "montage":          "Follow @integrityreforestation",
    "testimonial":      "Share this with someone who needs to see it",
    "educational":      "Save this for later",
    # Legacy aliases
    "story":   "Share this with someone who needs to see it",
    "product": "Link in bio — limited availability",
}

# Strategy-objective CTA overrides
OBJECTIVE_CTAS: Dict[str, str] = {
    "awareness":   "Follow @integrityreforestation",
    "engagement":  "Save this + follow for more",
    "conversion":  "Link in bio — act now",
    "education":   "Save this for later",
}

STYLE_MUSIC_HINTS: Dict[str, str] = {
    "narrative":        "emotional, cinematic, building",
    "hook_reveal":      "upbeat, energetic, 120+ BPM",
    "problem_solution": "tense opening, resolving to uplifting",
    "montage":          "high energy, driving beat",
    "testimonial":      "warm, personal, acoustic",
    "educational":      "calm, focused, lo-fi",
    "story":            "emotional, atmospheric, soft",
    "product":          "clean, modern, minimal",
}


# ── Public API ─────────────────────────────────────────────────────────────

def generate_reel(
    library: ScoredLibrary,
    style: str = "narrative",
    target_duration: float = 30.0,
    version: int = 1,
    strategy: Optional[Dict[str, str]] = None,
) -> ReelTimeline:
    """
    Generate a complete reel timeline from a scored clip library.

    version 1 = best clips for each slot
    version 2 = second-best (diversity)
    version 3 = alternate emphasis (e.g. highest emotion)

    strategy = {"objective": ..., "audience": ..., "tone": ...}
    """
    structure = REEL_STRUCTURES.get(style) or REEL_STRUCTURES["narrative"]
    clips_pool = list(library["clips"])  # sorted by composite score desc

    if not clips_pool:
        return _empty_timeline(style, target_duration)

    # Scale slot durations to fit target
    total_slot_duration = sum(s["target_duration"] for s in structure)
    scale = target_duration / total_slot_duration if total_slot_duration > 0 else 1.0
    scaled_structure = [
        {**slot, "target_duration": slot["target_duration"] * scale}
        for slot in structure
    ]

    # Build the clip sequence
    used_ids: Set[str] = set()
    timeline_clips: List[TimelineClip] = []
    notes: List[str] = []
    current_time = 0.0
    position = 0

    for slot in scaled_structure:
        clip_score = _select_clip(clips_pool, slot, used_ids, version)
        if clip_score is None:
            # Reuse best available if pool exhausted
            clip_score = clips_pool[0] if clips_pool else None
        if clip_score is None:
            break

        slot_duration = slot["target_duration"]
        in_point = clip_score["best_in_point"]

        # For hook slot, always start from strongest moment
        if slot["role"] == "hook":
            in_point = max(0.0, clip_score["best_in_point"])
            notes.append(f"Hook: {clip_score['filename']} @{in_point:.1f}s (score: {clip_score['composite']:.2f})")

        out_point = min(
            clip_score["best_out_point"],
            in_point + slot_duration,
        )
        # Ensure minimum 1s clip
        if out_point - in_point < 1.0:
            out_point = min(clip_score["best_out_point"], in_point + slot_duration)

        duration = out_point - in_point

        timeline_clips.append({
            "asset_id": clip_score["asset_id"],
            "filename": clip_score["filename"],
            "position": position,
            "in_point": round(in_point, 2),
            "out_point": round(out_point, 2),
            "duration": round(duration, 2),
            "role": slot["role"],
            "story_role": slot["story_role"],
            "why_chosen": _build_why_chosen(clip_score, slot),
            "effects": {
                "brightness": 100,
                "contrast": 105 if slot["role"] == "hook" else 100,
                "saturation": 110 if style == "montage" else 100,
                "zoom": 100,
                "panX": 0,
                "panY": 0,
            },
        })

        used_ids.add(clip_score["asset_id"])
        current_time += duration
        position += 1

    actual_duration = sum(c["duration"] for c in timeline_clips)

    # Build captions from best hook clip transcript
    captions = _build_captions(timeline_clips, library, style)

    # CTA: strategy objective overrides style default
    if strategy and strategy.get("objective") in OBJECTIVE_CTAS:
        cta_text = OBJECTIVE_CTAS[strategy["objective"]]
    else:
        cta_text = STYLE_CTAS.get(style, "Follow for more")

    # Tone modifier
    if strategy and strategy.get("tone") == "urgent":
        cta_text = "Act now — " + cta_text

    # Build text overlays (hook + CTA)
    hook_text = library["best_hook"]["hook_text"] if library["best_hook"] else ""
    text_overlays = _build_text_overlays(hook_text, cta_text, actual_duration)

    notes.append(f"Generated {len(timeline_clips)} clips | {actual_duration:.1f}s total")
    notes.append(f"Style: {style} | Version: {version}")

    return {
        "style": style,
        "target_duration": target_duration,
        "actual_duration": round(actual_duration, 2),
        "clips": timeline_clips,
        "captions": captions,
        "text_overlays": text_overlays,
        "hook_text": hook_text,
        "cta_text": cta_text,
        "music_suggestion": STYLE_MUSIC_HINTS.get(style, ""),
        "generation_notes": notes,
    }


def generate_versions(
    library: ScoredLibrary,
    style: str = "narrative",
    target_duration: float = 30.0,
    count: int = 3,
    strategy: Optional[Dict[str, str]] = None,
) -> List[ReelTimeline]:
    """Generate multiple reel versions with different clip selections."""
    return [
        generate_reel(library, style, target_duration, version=i + 1, strategy=strategy)
        for i in range(count)
    ]


# ── Selection logic ────────────────────────────────────────────────────────

def _build_why_chosen(clip: ClipScore, slot: ClipSlot) -> str:
    """One-sentence explanation of why this clip was selected for this slot."""
    reasons = []
    if slot["prefer_hook"] and clip["hook_score"] >= 0.55:
        reasons.append(f"hook score {clip['hook_score']:.0%}")
    if slot["prefer_emotion"] and clip.get("emotion_score", 0) >= 0.50:
        reasons.append(f"emotional impact {clip.get('emotion_score', 0):.0%}")
    if slot["prefer_motion"] and clip["motion_score"] >= 0.55:
        reasons.append(f"motion energy {clip['motion_score']:.0%}")
    if slot["prefer_speech"] and clip["audio_score"] >= 0.45:
        reasons.append(f"speech clarity {clip['audio_score']:.0%}")
    if slot["prefer_clarity"] and clip.get("clarity_score", 0) >= 0.55:
        reasons.append(f"visual clarity {clip.get('clarity_score', 0):.0%}")
    if clip["portrait_score"] >= 0.85:
        reasons.append("native 9:16")
    if clip["brand_score"] >= 0.65:
        reasons.append("brand-relevant")
    if not reasons:
        reasons.append(f"best available for {slot['story_role']} (composite {clip['composite']:.0%})")
    return ", ".join(reasons[:3])


def _select_clip(
    pool: List[ClipScore],
    slot: ClipSlot,
    used_ids: Set[str],
    version: int,
) -> Optional[ClipScore]:
    """Select the best unused clip for a given slot based on slot preferences."""
    candidates = [c for c in pool if c["asset_id"] not in used_ids]
    if not candidates:
        return None

    def slot_score(c: ClipScore) -> float:
        s = c["composite"]
        if slot["prefer_hook"]:
            s = s * 0.3 + c["hook_score"] * 0.7
        elif slot["prefer_emotion"]:
            emotion = c.get("emotion_score", c["composite"])
            s = s * 0.3 + emotion * 0.7
        elif slot["prefer_motion"]:
            s = s * 0.4 + c["motion_score"] * 0.6
        elif slot["prefer_speech"]:
            s = s * 0.4 + c["audio_score"] * 0.6
        elif slot["prefer_clarity"]:
            clarity = c.get("clarity_score", c["composite"])
            s = s * 0.4 + clarity * 0.6
        return s

    candidates.sort(key=slot_score, reverse=True)

    # version 1 = best; version 2 = second-best (diversity); version 3 = alternate
    offset = min(version - 1, len(candidates) - 1)
    return candidates[offset]


# ── Caption builder ────────────────────────────────────────────────────────

def _build_captions(
    timeline_clips: List[TimelineClip],
    library: ScoredLibrary,
    style: str,
) -> List[TimelineCaption]:
    """
    Build caption overlays from clip transcripts.
    Only generates captions for clips that have speech.
    """
    from .transcript_service import get_cached as get_transcript
    from .transcript_service import generate_captions

    captions: List[TimelineCaption] = []
    current_offset = 0.0

    for tc in timeline_clips:
        transcript = get_transcript(tc["asset_id"])
        if not transcript or not transcript["has_speech"]:
            current_offset += tc["duration"]
            continue

        # Filter transcript segments to the trimmed window
        in_p = tc["in_point"]
        out_p = tc["out_point"]
        filtered_transcript = {
            **transcript,
            "segments": [
                s for s in transcript["segments"]
                if s["start"] >= in_p and s["end"] <= out_p
            ],
        }

        raw_captions = generate_captions(filtered_transcript, max_chars=35)

        # Shift times to global timeline
        for cap in raw_captions:
            global_start = current_offset + (cap["startTime"] - in_p)
            global_end = current_offset + (cap["endTime"] - in_p)
            if global_start < 0 or global_end > current_offset + tc["duration"]:
                continue
            captions.append({
                "id": str(uuid.uuid4()),
                "text": cap["text"],
                "startTime": round(global_start, 2),
                "endTime": round(global_end, 2),
                "style": "bold" if tc["role"] == "hook" else "default",
            })

        current_offset += tc["duration"]

    return captions


# ── Text overlay builder ───────────────────────────────────────────────────

def _build_text_overlays(
    hook_text: str,
    cta_text: str,
    total_duration: float,
) -> List[TimelineTextOverlay]:
    overlays: List[TimelineTextOverlay] = []

    if hook_text:
        overlays.append({
            "id": str(uuid.uuid4()),
            "text": hook_text[:60],   # truncate for mobile safety
            "x": 50.0,
            "y": 20.0,
            "fontSize": 22,
            "fontFamily": "'Noto Sans', sans-serif",
            "fontWeight": "900",
            "color": "#ffffff",
            "opacity": 1.0,
            "textAlign": "center",
            "rotation": 0,
            "dropShadow": True,
            "bgStyle": "pill",
            "bgColor": "#002a27",
            "startTime": 0.0,
            "endTime": min(3.0, total_duration),
        })

    if cta_text and total_duration > 3:
        cta_start = max(0.0, total_duration - 4.0)
        overlays.append({
            "id": str(uuid.uuid4()),
            "text": cta_text,
            "x": 50.0,
            "y": 85.0,
            "fontSize": 18,
            "fontFamily": "'Noto Sans', sans-serif",
            "fontWeight": "700",
            "color": "#002a27",
            "opacity": 1.0,
            "textAlign": "center",
            "rotation": 0,
            "dropShadow": False,
            "bgStyle": "pill",
            "bgColor": "#39de8b",
            "startTime": cta_start,
            "endTime": total_duration,
        })

    return overlays


def _empty_timeline(style: str, target_duration: float) -> ReelTimeline:
    return {
        "style": style,
        "target_duration": target_duration,
        "actual_duration": 0.0,
        "clips": [],
        "captions": [],
        "text_overlays": [],
        "hook_text": "",
        "cta_text": STYLE_CTAS.get(style, "Follow for more"),
        "music_suggestion": STYLE_MUSIC_HINTS.get(style, ""),
        "generation_notes": ["No video clips available in library."],
    }
