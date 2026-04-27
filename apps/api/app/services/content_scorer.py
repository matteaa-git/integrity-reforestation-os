"""Rule-based content scoring engine for viral probability prediction."""

import re
from typing import List, Optional

POWER_WORDS = {
    "secret", "mistake", "truth", "never", "always", "exactly", "warning",
    "stop", "watch", "shocking", "nobody", "everyone", "wrong", "hidden",
    "exposed", "revealed", "proven", "urgent", "critical", "dangerous",
    "controversial", "forbidden", "finally", "instant", "free", "new",
}

CURIOSITY_PHRASES = [
    "here's what", "nobody tells", "the secret", "what nobody",
    "you need to know", "wait until", "here's why", "this is why",
    "what happens when", "the real reason", "most people don't",
    "i didn't know", "they don't want", "the hidden",
]

TRANSFORMATION_KEYWORDS = [
    "transformation", "before and after", "changed", "from", "now",
    "years later", "look at", "turned into", "became", "watch what",
]


def _word_count(text: str) -> int:
    return len(text.split())


def _has_number(text: str) -> bool:
    return bool(re.search(r"\d+", text))


def _has_question(text: str) -> bool:
    return "?" in text


def _count_power_words(text: str) -> int:
    words = set(text.lower().split())
    return len(words & POWER_WORDS)


def _has_curiosity_gap(text: str) -> bool:
    t = text.lower()
    return any(phrase in t for phrase in CURIOSITY_PHRASES)


def _has_transformation_angle(text: str) -> bool:
    t = text.lower()
    return any(kw in t for kw in TRANSFORMATION_KEYWORDS)


def score_hook(hook_text: str) -> float:
    """Return a 0-100 hook strength score."""
    if not hook_text:
        return 30.0

    score = 40.0
    wc = _word_count(hook_text)

    # Length: optimal 6-15 words
    if 6 <= wc <= 15:
        score += 15
    elif 4 <= wc <= 20:
        score += 7
    else:
        score -= 5

    # Power words (cap at 15pts)
    pw = _count_power_words(hook_text)
    score += min(pw * 5, 15)

    # Curiosity gap
    if _has_curiosity_gap(hook_text):
        score += 12

    # Specific number
    if _has_number(hook_text):
        score += 8

    # Question form
    if _has_question(hook_text):
        score += 6

    # Transformation angle
    if _has_transformation_angle(hook_text):
        score += 8

    return min(max(score, 0), 100)


def _infer_category(text: str, pillar: Optional[str] = None) -> str:
    t = text.lower()
    if any(w in t for w in ["before", "after", "transformation", "look at", "years later", "watch what"]):
        return "transformation"
    if any(w in t for w in ["wrong", "stop", "mistake", "truth", "exposed", "lie", "actually"]):
        return "authority"
    if any(w in t for w in ["i ", "we ", "our ", "story", "journey", "behind", "pov"]):
        return "story"
    if any(w in t for w in ["why", "how", "science", "research", "study", "learn", "fact", "guide"]):
        return "education"
    if pillar in ("BTS", "CAMP"):
        return "story"
    return "education"


def _save_potential(fmt: str, category: str, hook_score: float) -> float:
    base = {"carousel": 65, "reel": 55, "story": 35, "post": 45}.get(fmt, 45)
    cat_boost = {"education": 20, "authority": 15, "transformation": 10, "story": 5}.get(category, 0)
    return min(base + cat_boost + (hook_score - 50) * 0.2, 97)


def _share_potential(fmt: str, category: str, hook_score: float) -> float:
    base = {"reel": 70, "carousel": 55, "story": 40, "post": 50}.get(fmt, 45)
    cat_boost = {"transformation": 20, "authority": 15, "story": 10, "education": 5}.get(category, 0)
    return min(base + cat_boost + (hook_score - 50) * 0.25, 97)


def _build_recommendations(
    score: float,
    fmt: str,
    hook_score: float,
    asset_count: int,
    has_video: bool,
    keywords: list,
) -> list:
    recs = []
    if hook_score < 60:
        recs.append("Strengthen your hook — add a curiosity gap or specific number to boost engagement by ~18%")
    if fmt == "carousel" and asset_count < 7:
        recs.append(f"Expand carousel to 7-10 slides (currently {asset_count}) for maximum swipe-through rate")
    if fmt == "reel" and not has_video:
        recs.append("Add original video footage — reels with native video get 3x more reach than image slideshows")
    if len(keywords) < 5:
        recs.append("Add more descriptive keywords to improve content discoverability in Explore")
    if score < 55:
        recs.append("Consider a transformation or story angle — these consistently outperform in the reforestation niche")
    if score >= 75:
        recs.append("High-potential content — prioritize for peak posting times (Tue–Thu, 6–9 PM local)")
    return recs[:4]


def score_content(
    title: str,
    format: str,
    hook_text: Optional[str] = None,
    caption: Optional[str] = None,
    content_category: Optional[str] = None,
    asset_count: int = 0,
    has_video: bool = False,
    pillar: Optional[str] = None,
    ai_keywords: Optional[List[str]] = None,
) -> dict:
    """Generate a full content intelligence score."""
    factors = []

    # ── Base score by format ────────────────────────────────────────────────
    format_bases = {"reel": 62, "carousel": 54, "story": 42, "post": 38}
    base = format_bases.get(format, 45)
    factors.append({
        "label": f"{format.title()} format",
        "impact": base - 50,
        "description": f"Instagram algorithm baseline for {format} content",
    })
    score = float(base)

    # ── Hook strength ───────────────────────────────────────────────────────
    hook_score = score_hook(hook_text or title)
    hook_boost = (hook_score - 50) * 0.28
    score += hook_boost
    factors.append({
        "label": "Hook strength",
        "impact": round(hook_boost, 1),
        "description": f"Hook quality score: {hook_score:.0f}/100",
    })

    # ── Video asset ─────────────────────────────────────────────────────────
    if has_video:
        score += 10
        factors.append({
            "label": "Native video",
            "impact": 10,
            "description": "Original video dramatically boosts algorithmic distribution",
        })

    # ── Asset count (carousel) ──────────────────────────────────────────────
    if format == "carousel":
        if asset_count >= 7:
            score += 8
            factors.append({"label": "Full carousel", "impact": 8, "description": f"{asset_count} slides — encourages full swipe-through"})
        elif asset_count >= 5:
            score += 4
            factors.append({"label": "Medium carousel", "impact": 4, "description": f"{asset_count} slides"})
        elif asset_count > 0:
            score -= 3
            factors.append({"label": "Short carousel", "impact": -3, "description": f"Only {asset_count} slides — expand to 7+ for best results"})

    # ── Pillar alignment ────────────────────────────────────────────────────
    high_value_pillars = {"BTS", "FP", "WF"}
    if pillar and pillar.upper() in high_value_pillars:
        score += 6
        factors.append({
            "label": "High-value pillar",
            "impact": 6,
            "description": f"{pillar} content drives strong organic discovery",
        })

    # ── AI keywords ─────────────────────────────────────────────────────────
    kw_count = len(ai_keywords or [])
    if kw_count >= 5:
        score += 5
        factors.append({"label": "Rich metadata", "impact": 5, "description": f"{kw_count} AI keywords improve targeting"})
    elif kw_count >= 2:
        score += 2
        factors.append({"label": "Some metadata", "impact": 2, "description": f"{kw_count} keywords attached"})

    # ── Content category ────────────────────────────────────────────────────
    cat = content_category or _infer_category(hook_text or title, pillar)
    category_boosts = {
        "transformation": 10, "story": 8, "entertainment": 6,
        "education": 5, "authority": 4,
    }
    cat_boost = category_boosts.get(cat, 0)
    if cat_boost:
        score += cat_boost
        factors.append({
            "label": f"{cat.title()} content",
            "impact": cat_boost,
            "description": f"{cat.title()} posts outperform in this niche",
        })

    # ── Caption quality ─────────────────────────────────────────────────────
    if caption and len(caption) > 80:
        score += 3
        factors.append({"label": "Strong caption", "impact": 3, "description": "Longer captions improve dwell time signals"})

    score = min(max(score, 5), 97)

    # ── Derived metrics ──────────────────────────────────────────────────────
    reach_base = int(score * 200)
    reach_low = max(int(reach_base * 0.4), 200)
    reach_high = int(reach_base * 3.8)

    engagement = min(score * 0.88, 95)
    save_pot = _save_potential(format, cat, hook_score)
    share_pot = _share_potential(format, cat, hook_score)

    return {
        "viral_probability": round(score, 1),
        "predicted_reach_low": reach_low,
        "predicted_reach_high": reach_high,
        "engagement_probability": round(engagement, 1),
        "hook_strength": round(hook_score, 1),
        "save_potential": round(save_pot, 1),
        "share_potential": round(share_pot, 1),
        "content_category": cat,
        "confidence": 0.74,
        "factors": factors,
        "recommendations": _build_recommendations(score, format, hook_score, asset_count, has_video, ai_keywords or []),
    }
