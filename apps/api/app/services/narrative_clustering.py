"""
Narrative Clustering Service
Groups raw signals into semantic NarrativeTopic clusters using keyword overlap.
"""

import hashlib
from datetime import datetime, timezone
from typing import List, Dict, Tuple

# ---------------------------------------------------------------------------
# Keyword → narrative label mapping
# ---------------------------------------------------------------------------

TOPIC_LABELS: Dict[str, str] = {
    "wildfire":         "Wildfire Crisis Response",
    "deforestation":    "Deforestation Alert",
    "reforestation":    "Reforestation Movement",
    "tree planting":    "Tree Planting Initiative",
    "tree-planting":    "Tree Planting Initiative",
    "climate":          "Climate Action Narrative",
    "amazon":           "Amazon Deforestation Crisis",
    "forest fire":      "Forest Fire Response",
    "carbon":           "Carbon & Climate Policy",
    "biodiversity":     "Biodiversity Protection",
    "drought":          "Drought & Water Crisis",
    "flood":            "Flood & Ecosystem Response",
    "indigenous":       "Indigenous Land Rights",
    "greenwashing":     "Greenwashing Controversy",
    "conservation":     "Conservation Momentum",
    "ecosystem":        "Ecosystem Restoration",
    "forest":           "Forest Protection",
    "policy":           "Environmental Policy",
    "protest":          "Activism & Protest Wave",
    "viral":            "Viral Environmental Trend",
}

CONTROVERSY_KEYWORDS = [
    "debate", "controversial", "dispute", "conflict", "divide", "oppose",
    "against", "criticism", "failure", "broken", "wrong", "misleading",
    "greenwashing", "scandal", "backlash", "accused", "fraud",
]

VELOCITY_BOOST_SOURCES = ["Reddit", "Google Trends", "X / Twitter"]


def _extract_keywords(signal: dict) -> List[str]:
    """Extract relevant keywords from a signal."""
    text = f"{signal.get('title','')} {signal.get('raw_text','') or signal.get('summary','')}".lower()
    found = []
    for kw in TOPIC_LABELS:
        if kw in text:
            found.append(kw)
    # Also add the signal's own tags
    found.extend(signal.get("tags", []))
    return list(set(found))


def _topic_id(keywords: List[str]) -> str:
    raw = "-".join(sorted(keywords[:4]))
    return "topic-" + hashlib.md5(raw.encode()).hexdigest()[:10]


def _compute_controversy(signals: List[dict]) -> int:
    count = 0
    for sig in signals:
        text = f"{sig.get('title','')} {sig.get('raw_text','')}".lower()
        for kw in CONTROVERSY_KEYWORDS:
            if kw in text:
                count += 1
                break
    return min(count * 12, 100)


def _compute_engagement_potential(signals: List[dict]) -> int:
    avg_emotion = sum(s.get("emotion_score", 30) for s in signals) / max(len(signals), 1)
    engagement_estimate = sum(s.get("engagement_estimate", 0) for s in signals)
    base = int(avg_emotion * 0.7)
    boost = min(engagement_estimate // 50, 30)
    return min(base + boost, 100)


def _compute_search_volume(signals: List[dict]) -> int:
    google_trends_sigs = [s for s in signals if "Google Trends" in s.get("source", "")]
    google_news_sigs = [s for s in signals if "Google News" in s.get("source", "")]
    base = len(google_trends_sigs) * 25 + len(google_news_sigs) * 10
    return min(base, 100)


def _compute_topic_opportunity(
    relevance: int, velocity: float, controversy: int, search_volume: int, engagement: int
) -> int:
    score = (
        relevance * 0.35
        + min(velocity * 20, 25)
        + controversy * 0.10
        + search_volume * 0.15
        + engagement * 0.15
    )
    return min(int(score), 100)


def _trend_direction(signals: List[dict]) -> str:
    avg_velocity = sum(s.get("trend_velocity", 1.0) for s in signals) / max(len(signals), 1)
    recent_count = sum(
        1 for s in signals
        if s.get("urgency_score", 0) >= 60
    )
    if avg_velocity >= 2.5 and recent_count >= 2:
        return "rising"
    if avg_velocity >= 1.8:
        return "peak"
    if avg_velocity >= 1.2:
        return "stable"
    return "declining"


def _topic_status(score: int) -> str:
    if score >= 80:
        return "respond_now"
    if score >= 60:
        return "good_opportunity"
    if score >= 40:
        return "monitor"
    return "low_priority"


def _build_topic_title(keywords: List[str], signals: List[dict]) -> str:
    for kw in keywords:
        if kw in TOPIC_LABELS:
            return TOPIC_LABELS[kw]
    if signals:
        title = signals[0].get("title", "Unknown Narrative")
        return title[:60] + ("…" if len(title) > 60 else "")
    return "Environmental Narrative"


def _build_topic_summary(signals: List[dict]) -> str:
    titles = [s.get("title", "") for s in signals[:3]]
    return " | ".join(t[:80] for t in titles if t)


def cluster_signals(signals: List[dict]) -> List[dict]:
    """
    Group signals into NarrativeTopic clusters by keyword overlap.
    Returns list of topic dicts sorted by opportunity_score descending.
    """
    if not signals:
        return []

    # Build keyword index for each signal
    sig_keywords: Dict[str, List[str]] = {}
    for sig in signals:
        sig_keywords[sig["id"]] = _extract_keywords(sig)

    # Greedy clustering: each signal joins the first cluster it shares >= 2 keywords with
    clusters: List[List[dict]] = []
    cluster_keywords: List[set] = []

    for sig in signals:
        kws = set(sig_keywords[sig["id"]])
        placed = False
        for i, ckws in enumerate(cluster_keywords):
            overlap = len(kws & ckws)
            if overlap >= 2:
                clusters[i].append(sig)
                cluster_keywords[i].update(kws)
                placed = True
                break
        if not placed:
            clusters.append([sig])
            cluster_keywords.append(kws)

    topics = []
    now = datetime.now(timezone.utc).isoformat()

    for cluster_sigs, ckws in zip(clusters, cluster_keywords):
        if not cluster_sigs:
            continue

        keyword_list = sorted(ckws)[:10]
        topic_id = _topic_id(keyword_list)
        title = _build_topic_title(keyword_list, cluster_sigs)
        summary = _build_topic_summary(cluster_sigs)

        sources = sorted(set(s.get("source", "") for s in cluster_sigs))
        avg_relevance = int(sum(s.get("relevance_score", 0) for s in cluster_sigs) / max(len(cluster_sigs), 1))
        avg_velocity = round(sum(s.get("trend_velocity", 1.0) for s in cluster_sigs) / max(len(cluster_sigs), 1), 1)
        controversy = _compute_controversy(cluster_sigs)
        engagement = _compute_engagement_potential(cluster_sigs)
        search_vol = _compute_search_volume(cluster_sigs)
        opp_score = _compute_topic_opportunity(avg_relevance, avg_velocity, controversy, search_vol, engagement)
        direction = _trend_direction(cluster_sigs)
        status = _topic_status(opp_score)
        lifespan = cluster_sigs[0].get("lifespan_estimate", "48h")
        category = cluster_sigs[0].get("category", "environmental")

        # Top signal for reference
        top_signal = max(cluster_sigs, key=lambda s: s.get("opportunity_score", 0))

        topics.append({
            "topic_id": topic_id,
            "title": title,
            "summary": summary,
            "signal_count": len(cluster_sigs),
            "sources": sources,
            "keywords": keyword_list,
            "opportunity_score": opp_score,
            "conversation_velocity": avg_velocity,
            "controversy_score": controversy,
            "engagement_potential": engagement,
            "relevance_score": avg_relevance,
            "search_volume_estimate": search_vol,
            "trend_direction": direction,
            "status": status,
            "category": category,
            "lifespan_estimate": lifespan,
            "signal_ids": [s["id"] for s in cluster_sigs],
            "top_signal_title": top_signal.get("title", ""),
            "top_signal_url": top_signal.get("url", ""),
            "created_at": now,
        })

    topics.sort(key=lambda t: t["opportunity_score"], reverse=True)
    return topics
