"""
Narrative Generator
Converts a signal into a structured narrative strategy using
template logic + optional Claude API enrichment.
"""

import os
import uuid
from datetime import datetime, timezone
from typing import Optional

ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# ---------------------------------------------------------------------------
# Stance templates by category
# ---------------------------------------------------------------------------

STANCE_TEMPLATES = {
    "environmental": {
        "stance": "Direct counter-force",
        "frame": "Crisis → Action",
        "cta_template": "While {signal_title_short} makes headlines, we're in the field. Plant a tree today — $5.",
    },
    "cultural": {
        "stance": "Authentic authority",
        "frame": "Mission over marketing",
        "cta_template": "Trends come and go. We plant trees 365 days a year. Join us.",
    },
    "social": {
        "stance": "Community amplifier",
        "frame": "People-powered restoration",
        "cta_template": "Real people, real forests, real impact. Sponsor a planter today.",
    },
    "political": {
        "stance": "Field-level proof",
        "frame": "Action beats policy",
        "cta_template": "We don't wait for summits. We plant while the world debates.",
    },
    "trend": {
        "stance": "Credibility anchor",
        "frame": "Proof of work",
        "cta_template": "Curious about {signal_title_short}? Here's what we're already doing about it.",
    },
}

ANGLE_TEMPLATES = {
    "environmental": [
        "Integrity as the measurable, on-the-ground counter-force to this crisis",
        "Every tree we plant is a direct response to this destruction",
        "Field footage and impact data as real-time proof of resistance",
    ],
    "cultural": [
        "Authenticity over algorithms — real planters, real work, no spin",
        "Year-round mission vs. campaign-moment opportunism",
        "Integrity's daily field work as the antidote to greenwashing",
    ],
    "social": [
        "Human stories from our planter community as the narrative heart",
        "Community-led restoration as the most powerful force in conservation",
        "Indigenous knowledge and local expertise as competitive advantages",
    ],
    "political": [
        "Field-level action as proof that policy alone isn't enough",
        "Our impact data as the credibility signal that gets us quoted",
        "Non-partisan — we plant regardless of who's in power",
    ],
    "trend": [
        "Riding cultural momentum to convert curiosity into action",
        "Proof-of-work content that shows we were already doing this",
        "Education-first approach that builds authority in the trending space",
    ],
}

AUDIENCE_MAP = {
    "environmental": "Climate-aware adults 25–45, high engagement with environmental content, likely donators",
    "cultural": "Gen Z + Millennial skeptics, anti-greenwashing, values authenticity and proof",
    "social": "Community-focused donors, local activists, planting volunteers",
    "political": "Policy-engaged professionals, journalists, NGO partners, LinkedIn audience",
    "trend": "Curious general public entering the climate conversation, new audience",
}

FORMAT_PRIORITIES = {
    "environmental": ["reel", "carousel", "twitter_thread", "youtube_short", "instagram_story"],
    "cultural": ["reel", "tiktok", "carousel", "twitter_thread", "substack"],
    "social": ["reel", "carousel", "instagram_story", "twitter_thread"],
    "political": ["twitter_thread", "linkedin_post", "substack", "carousel"],
    "trend": ["reel", "tiktok", "twitter_thread", "instagram_story", "carousel"],
}


# ---------------------------------------------------------------------------
# Template-based narrative generation
# ---------------------------------------------------------------------------

def _generate_narrative_template(signal: dict) -> dict:
    """Generate a narrative strategy from a signal using templates."""
    category = signal.get("category", "environmental")
    title = signal.get("title", "")
    short_title = title[:50] + ("..." if len(title) > 50 else "")
    summary = signal.get("summary", signal.get("raw_text", ""))[:300]
    urgency = signal.get("urgency_score", 50)
    tags = signal.get("tags", [])

    tmpl = STANCE_TEMPLATES.get(category, STANCE_TEMPLATES["environmental"])
    angles = ANGLE_TEMPLATES.get(category, ANGLE_TEMPLATES["environmental"])
    audience = AUDIENCE_MAP.get(category, AUDIENCE_MAP["environmental"])
    formats = FORMAT_PRIORITIES.get(category, FORMAT_PRIORITIES["environmental"])

    recommended_angle = angles[0]
    stance = tmpl["stance"]
    emotional_frame = tmpl["frame"]
    cta = tmpl["cta_template"].format(signal_title_short=short_title)

    # Core message construction
    if category == "environmental":
        core_message = (
            f"While '{short_title}' is dominating headlines, Integrity Reforestation "
            f"is already in the field — planting, restoring, and building the forests "
            f"the planet needs. Our response isn't a press release. It's 847 trees in the ground today."
        )
    elif category == "cultural":
        core_message = (
            f"The conversation around '{short_title}' is heating up. Integrity Reforestation "
            f"doesn't ride trends — we create proof. Every post we publish is backed by "
            f"real field work from real planters, not a marketing budget."
        )
    elif category == "social":
        core_message = (
            f"'{short_title}' shows the power of people taking action on environmental issues. "
            f"At Integrity, we've built a community of planters who do this every single day — "
            f"not for a moment, but for a mission."
        )
    elif category == "political":
        core_message = (
            f"While '{short_title}' plays out in policy circles, Integrity Reforestation "
            f"continues its daily field operations. We plant regardless of political cycles. "
            f"Our impact data speaks louder than any summit declaration."
        )
    else:
        core_message = (
            f"The momentum around '{short_title}' has created a massive opportunity for "
            f"Integrity Reforestation to establish authority and convert curiosity into "
            f"real action. Here's our proof-of-work response."
        )

    return {
        "narrative_id": f"nar-{uuid.uuid4().hex[:10]}",
        "signal_id": signal.get("id"),
        "signal_title": title,
        "recommended_angle": recommended_angle,
        "stance": stance,
        "core_message": core_message,
        "emotional_frame": emotional_frame,
        "audience": audience,
        "call_to_action": cta,
        "content_formats": formats[:5],
        "urgency_window": signal.get("lifespan_estimate", "48h"),
        "opportunity_score": signal.get("opportunity_score", 50),
        "tags": tags,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


async def _enrich_with_claude(narrative: dict, signal: dict) -> dict:
    """Optionally enrich the narrative using Claude API if key is available."""
    if not ANTHROPIC_KEY:
        return narrative
    try:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_KEY)

        prompt = f"""You are a strategic content director for Integrity Reforestation, an NGO that plants trees in deforested regions worldwide.

A breaking signal has been detected:
Title: {signal.get('title')}
Category: {signal.get('category')}
Summary: {signal.get('summary', signal.get('raw_text', ''))[:400]}
Urgency: {signal.get('urgency_score')}/100
Opportunity Score: {signal.get('opportunity_score')}/100

Current narrative draft:
Core Message: {narrative['core_message']}
Angle: {narrative['recommended_angle']}

Improve the core_message and recommended_angle to be more compelling, specific, and action-oriented for Integrity Reforestation's audience. Keep it under 3 sentences for core_message and 1 sentence for recommended_angle.

Respond in JSON with keys: core_message, recommended_angle"""

        message = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        import json
        text = message.content[0].text.strip()
        # Extract JSON
        json_match = text[text.find("{"):text.rfind("}") + 1]
        enriched = json.loads(json_match)
        narrative["core_message"] = enriched.get("core_message", narrative["core_message"])
        narrative["recommended_angle"] = enriched.get("recommended_angle", narrative["recommended_angle"])
        narrative["enriched_by_ai"] = True
    except Exception:
        pass  # Fall back to template version
    return narrative


async def generate_narrative(signal: dict) -> dict:
    narrative = _generate_narrative_template(signal)
    narrative = await _enrich_with_claude(narrative, signal)
    return narrative
