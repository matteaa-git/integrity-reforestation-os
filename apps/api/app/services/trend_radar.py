"""Curated trend intelligence for Integrity Reforestation content strategy."""

import uuid
from datetime import datetime, timezone
from typing import List

_TREND_SEEDS = [
    {
        "topic": "Carbon Credit Transparency",
        "platform": "reddit",
        "trend_score": 91.0,
        "velocity": "rising",
        "volume_label": "24.3K mentions/day",
        "content_angle": "Expose the verification gap in carbon offsets — audiences want accountability from brands. Integrity's verified planting data is a differentiator.",
        "content_formats": ["carousel", "reel"],
        "tags": ["carbon", "transparency", "sustainability", "offsets"],
        "relevance_to_brand": 96.0,
        "opportunity_window": "3d",
    },
    {
        "topic": "Wildfire Season 2026",
        "platform": "google",
        "trend_score": 94.0,
        "velocity": "peak",
        "volume_label": "2.1M searches/day",
        "content_angle": "Timely hook — connect Integrity's reforestation work directly to wildfire prevention and forest resilience. Strike now while the topic peaks.",
        "content_formats": ["reel", "carousel"],
        "tags": ["wildfire", "forests", "climate", "prevention"],
        "relevance_to_brand": 94.0,
        "opportunity_window": "24h",
    },
    {
        "topic": "Biodiversity Collapse Warning",
        "platform": "instagram",
        "trend_score": 88.0,
        "velocity": "peak",
        "volume_label": "31.2K engagements/day",
        "content_angle": "Shock + solution: show the biodiversity crisis then position Integrity as a real-world solution. Pair alarming stats with hopeful field footage.",
        "content_formats": ["carousel", "reel", "story"],
        "tags": ["biodiversity", "climate", "forests", "wildlife"],
        "relevance_to_brand": 92.0,
        "opportunity_window": "24h",
    },
    {
        "topic": "Corporate ESG Skepticism",
        "platform": "reddit",
        "trend_score": 86.0,
        "velocity": "rising",
        "volume_label": "19.5K posts/day",
        "content_angle": "Contrarian play — separate Integrity from greenwashing brands with verified impact numbers. Authenticity is your competitive moat here.",
        "content_formats": ["carousel"],
        "tags": ["ESG", "greenwashing", "corporate", "sustainability"],
        "relevance_to_brand": 93.0,
        "opportunity_window": "3d",
    },
    {
        "topic": "Reforestation vs Afforestation",
        "platform": "youtube",
        "trend_score": 84.0,
        "velocity": "rising",
        "volume_label": "18.7K searches/day",
        "content_angle": "Educational authority piece — most people confuse these terms. Own the correct narrative with a clear explainer carousel that gets saved and shared.",
        "content_formats": ["carousel", "reel"],
        "tags": ["reforestation", "afforestation", "education", "trees"],
        "relevance_to_brand": 98.0,
        "opportunity_window": "1w",
    },
    {
        "topic": "Nature-Based Climate Solutions (NbS)",
        "platform": "news",
        "trend_score": 81.0,
        "velocity": "rising",
        "volume_label": "450 articles this week",
        "content_angle": "Authority content — position Integrity at the frontier of NbS with real project data. Link field operations to the broader policy conversation.",
        "content_formats": ["carousel", "reel"],
        "tags": ["NbS", "climate", "solutions", "forests"],
        "relevance_to_brand": 95.0,
        "opportunity_window": "1w",
    },
    {
        "topic": "Regenerative Agriculture Wave",
        "platform": "tiktok",
        "trend_score": 79.0,
        "velocity": "rising",
        "volume_label": "8.9M video views",
        "content_angle": "BTS of how tree planting supports soil regeneration. Authentic field footage performs 4x better than polished brand content on TikTok.",
        "content_formats": ["reel"],
        "tags": ["regenerative", "agriculture", "soil", "trees"],
        "relevance_to_brand": 87.0,
        "opportunity_window": "1w",
    },
    {
        "topic": "Rewilding Movements",
        "platform": "instagram",
        "trend_score": 76.0,
        "velocity": "rising",
        "volume_label": "5.4K posts/day",
        "content_angle": "Transformation storytelling — before/after land restoration over time. Long-form carousel or time-lapse reel showing real ecological recovery.",
        "content_formats": ["carousel", "reel"],
        "tags": ["rewilding", "conservation", "nature", "restoration"],
        "relevance_to_brand": 89.0,
        "opportunity_window": "1w",
    },
    {
        "topic": "1 Billion Trees Challenge",
        "platform": "tiktok",
        "trend_score": 73.0,
        "velocity": "rising",
        "volume_label": "3.2M video views",
        "content_angle": "Ride the momentum — show Integrity's contribution to the global planting movement with real numbers and an emotional community hook.",
        "content_formats": ["reel", "story"],
        "tags": ["trees", "challenge", "reforestation", "impact"],
        "relevance_to_brand": 91.0,
        "opportunity_window": "3d",
    },
    {
        "topic": "Forest Bathing & Mental Health",
        "platform": "youtube",
        "trend_score": 71.0,
        "velocity": "declining",
        "volume_label": "6.1K searches/day",
        "content_angle": "Emotional wellness angle — connect the mental health benefits of forests to why Integrity protects them. Softer, story-driven content.",
        "content_formats": ["reel", "story"],
        "tags": ["forest", "mental health", "wellbeing", "nature"],
        "relevance_to_brand": 78.0,
        "opportunity_window": "1w",
    },
    {
        "topic": "Indigenous Land Rights & Forests",
        "platform": "news",
        "trend_score": 83.0,
        "velocity": "rising",
        "volume_label": "320 articles this week",
        "content_angle": "Social impact angle — highlight how Integrity's projects support indigenous communities alongside ecosystem restoration.",
        "content_formats": ["carousel", "reel"],
        "tags": ["indigenous", "land rights", "forests", "community"],
        "relevance_to_brand": 85.0,
        "opportunity_window": "3d",
    },
    {
        "topic": "AI in Conservation",
        "platform": "instagram",
        "trend_score": 77.0,
        "velocity": "rising",
        "volume_label": "4.8K posts/day",
        "content_angle": "Innovation story — showcase how Integrity uses technology (drone mapping, AI monitoring) to scale reforestation. Tech-forward brand positioning.",
        "content_formats": ["carousel", "reel"],
        "tags": ["AI", "conservation", "technology", "innovation"],
        "relevance_to_brand": 82.0,
        "opportunity_window": "1w",
    },
]


def get_trends() -> dict:
    now = datetime.now(timezone.utc).isoformat()
    trends = [
        {"id": str(uuid.uuid5(uuid.NAMESPACE_DNS, s["topic"])), **s}
        for s in _TREND_SEEDS
    ]
    # Sort by combined score (trend × relevance)
    trends.sort(key=lambda t: t["trend_score"] * (t["relevance_to_brand"] / 100), reverse=True)
    top = trends[0] if trends else None
    return {
        "trends": trends,
        "last_updated": now,
        "top_opportunity": top,
    }
