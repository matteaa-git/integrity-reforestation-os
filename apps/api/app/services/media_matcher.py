"""
Media Matcher
Matches signals/narratives to assets in the Integrity Asset Library
using tag overlap, category alignment, and content-type scoring.
"""

from typing import List, Dict

SIGNAL_TAG_TO_ASSET_TAGS = {
    "wildfire":       ["fire", "smoke", "burn", "emergency", "forest", "drone"],
    "forest-fire":    ["fire", "smoke", "forest", "aerial", "drone"],
    "deforestation":  ["deforestation", "clear-cut", "barren", "before", "aerial"],
    "reforestation":  ["planting", "seedling", "nursery", "restoration", "growth"],
    "tree-planting":  ["planting", "seedling", "hands", "crew", "team"],
    "climate":        ["forest", "canopy", "aerial", "ecosystem"],
    "forest":         ["canopy", "aerial", "drone", "forest", "trees"],
    "amazon":         ["aerial", "canopy", "rainforest", "river"],
    "drought":        ["dry", "barren", "cracked", "seedling"],
    "flood":          ["water", "river", "riparian", "wetland"],
    "ecosystem":      ["biodiversity", "canopy", "wildlife", "forest"],
    "conservation":   ["forest", "planting", "restoration", "crew"],
}

CATEGORY_CONTENT_TYPES = {
    "environmental": ["drone", "timelapse", "video"],
    "cultural":      ["talking_head", "photo", "video"],
    "social":        ["talking_head", "photo", "video"],
    "political":     ["talking_head", "photo", "drone"],
    "trend":         ["video", "talking_head", "photo"],
}

NARRATIVE_TYPE_CONTENT_TYPES = {
    "crisis_response": ["drone", "video", "timelapse"],
    "story":           ["talking_head", "photo", "video"],
    "authority":       ["drone", "photo", "talking_head"],
    "education":       ["talking_head", "photo", "video"],
    "movement":        ["video", "drone", "talking_head"],
}


def score_asset_for_signal(asset: dict, signal: dict, narrative: dict) -> int:
    """Score how well an asset matches a signal/narrative. Returns 0–100."""
    score = 0
    signal_tags = [t.lower() for t in signal.get("tags", [])]
    signal_category = signal.get("category", "environmental")
    asset_keywords = [kw.lower() for kw in (asset.get("ai_keywords") or [])]
    asset_subject = (asset.get("subject") or "").lower()
    asset_action = (asset.get("action") or "").lower()
    asset_content_type = (asset.get("content_type") or "").lower()
    asset_pillar = (asset.get("pillar") or "").lower()

    # Tag overlap
    for sig_tag in signal_tags:
        mapped_tags = SIGNAL_TAG_TO_ASSET_TAGS.get(sig_tag, [sig_tag])
        for at in mapped_tags:
            if at in asset_keywords or at in asset_subject or at in asset_action:
                score += 15

    # Content type alignment with signal category
    preferred_types = CATEGORY_CONTENT_TYPES.get(signal_category, [])
    if asset_content_type in preferred_types:
        score += 20
        if preferred_types.index(asset_content_type) == 0:  # Top priority
            score += 10

    # Video gets bonus for environmental signals
    if signal_category == "environmental" and asset.get("media_type") == "video":
        score += 15

    # Pillar alignment
    if asset_pillar in ["impact", "restoration", "field", "environment"]:
        score += 10

    return min(score, 100)


def match_assets_to_signal(assets: List[dict], signal: dict, narrative: dict, limit: int = 8) -> List[dict]:
    """Return top matching assets for a signal, with match scores."""
    scored = []
    for asset in assets:
        match_score = score_asset_for_signal(asset, signal, narrative)
        if match_score > 0:
            scored.append({**asset, "_match_score": match_score})

    scored.sort(key=lambda a: a["_match_score"], reverse=True)

    results = []
    for a in scored[:limit]:
        ms = a.pop("_match_score")
        results.append({
            "asset": a,
            "match_score": ms,
            "match_reason": _explain_match(a, signal),
            "recommended_for": _recommended_for(a, signal),
        })
    return results


def _explain_match(asset: dict, signal: dict) -> str:
    content_type = asset.get("content_type", asset.get("media_type", ""))
    subject = asset.get("subject") or ""
    tags = signal.get("tags", [])
    if content_type == "drone":
        return "Aerial perspective ideal for environmental scale storytelling"
    if content_type == "talking_head":
        return "Direct-to-camera authenticity matches the narrative's emotional frame"
    if content_type == "timelapse":
        return "Visual proof of transformation — perfect for before/after narrative"
    if any(t in (subject.lower() + " ".join(tags)) for t in ["planting", "seedling"]):
        return "Planting B-roll directly illustrates the response action"
    return f"Keyword overlap with signal tags: {', '.join(tags[:3])}"


def _recommended_for(asset: dict, signal: dict) -> str:
    ct = asset.get("content_type", "")
    mt = asset.get("media_type", "video")
    if ct == "drone" or (mt == "video" and ct == "drone"):
        return "Reel opening shot, Carousel cover slide"
    if ct == "talking_head":
        return "Reel mid-section, Story sequence"
    if ct == "timelapse":
        return "Reel climax, YouTube Short"
    if mt == "image":
        return "Carousel slide, Twitter post, Substack header"
    return "Supporting B-roll"
