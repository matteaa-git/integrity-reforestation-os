"""
Content Generator
Converts a narrative + signal into platform-ready content:
X thread, Instagram carousel, Reel script, Story sequence, Substack paragraph.
Optionally enriched by Claude API.
"""

import os
import uuid
from datetime import datetime, timezone
from typing import Dict, List

ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# ---------------------------------------------------------------------------
# Template generators per platform
# ---------------------------------------------------------------------------

def _gen_x_thread(narrative: dict, signal: dict) -> List[dict]:
    title = signal.get("title", "")
    core = narrative.get("core_message", "")
    cta = narrative.get("call_to_action", "Plant a tree. Link in bio.")
    category = signal.get("category", "environmental")

    if category == "environmental":
        tweets = [
            f"🚨 {title[:100]}\n\nHere's what Integrity Reforestation is doing about it right now. 🧵",
            f"While headlines break, our field teams plant.\n\nToday: 847 trees in the ground. Yesterday: 1,203. The day before: 990.\n\nWe don't pause for news cycles.",
            f"{core[:240]}",
            "Since January 2026:\n🌳 847,000 trees planted\n🗺 12,400 hectares restored\n👥 23 communities supported\n\nThis is what doing the work looks like.",
            "The math is simple: deforestation is a daily act of destruction.\nReforestation has to be a daily act of resistance.",
            f"You can be part of this.\n\n→ Sponsor a tree ($5)\n→ Follow for daily field updates\n→ Share this thread\n\n{cta}",
        ]
    elif category == "political":
        tweets = [
            f"'{title[:80]}' is making headlines.\n\nHere's our field-level perspective. 🧵",
            "Policy matters. But forests don't wait for legislation.\n\nWe plant while the world debates.",
            f"{core[:240]}",
            "Our impact data since January:\n🌳 847K trees planted\n🌍 12,400ha restored\n\nNo summit needed to start.",
            "Want to do something that actually works?\n\nSponsor a tree. $5. Tracked, photographed, reported.\n\nLink in bio.",
        ]
    else:
        tweets = [
            f"{title[:100]}\n\nHere's what this means for reforestation — and what we're already doing. 🧵",
            f"{core[:240]}",
            "We've been doing this work every day — not for a trend, not for a campaign.\n\nBecause the planet needs it year-round.",
            "In 2026 so far:\n🌳 847K trees\n🌿 87% survival rate\n📍 6 regions\n\nReal numbers. Real forests.",
            f"{cta}\n\nFollow for daily field updates from our planters.",
        ]

    return [
        {
            "position": i + 1,
            "text": t.strip(),
            "char_count": len(t.strip()),
            "engagement_hook": ["Hook", "Proof", "Core message", "Data", "Manifesto", "CTA"][i] if i < 6 else "Supporting",
            "media_suggestion": [
                "Field drone footage",
                "Planter B-roll",
                None,
                "Impact data graphic",
                None,
                None,
            ][i] if i < 6 else None,
        }
        for i, t in enumerate(tweets)
    ]


def _gen_instagram_carousel(narrative: dict, signal: dict) -> dict:
    title = signal.get("title", "")
    core = narrative.get("core_message", "")
    cta = narrative.get("call_to_action", "Plant a tree. Link in bio.")
    angle = narrative.get("recommended_angle", "")
    tags = signal.get("tags", [])

    hashtags = [
        "#Reforestation", "#IntegrityReforestation", "#ClimateAction",
        "#ForestRestoration", "#TreePlanting", "#NatureRestoration",
    ] + [f"#{t.replace('-', '')}" for t in tags[:3]]

    slides = [
        f"SLIDE 1 — HOOK\n\n\"{title[:80]}...\"\n\nHere's our response.",
        f"SLIDE 2 — THE SITUATION\n\n{core[:150]}",
        "SLIDE 3 — THE SCALE\n\n10 million hectares of forest lost every year.\nThat's the size of South Korea — gone annually.",
        "SLIDE 4 — OUR RESPONSE TODAY\n\n847 trees planted today.\n1,203 yesterday.\n990 the day before.\n\nEvery. Single. Day.",
        "SLIDE 5 — THE PROOF\n\n847,000 trees planted in 2026.\n87% survival rate.\n12,400 hectares restored.\n23 communities supported.",
        f"SLIDE 6 — THE ANGLE\n\n{angle[:120]}",
        f"SLIDE 7 — CTA\n\n{cta}\n\nSwipe → Follow → Share",
    ]

    caption = (
        f"🌿 {title[:100]}...\n\n"
        f"{core[:200]}\n\n"
        "Swipe to see the full picture →\n\n"
        + " ".join(hashtags[:10])
    )

    return {
        "slide_count": len(slides),
        "slides": slides,
        "caption": caption,
        "hashtags": hashtags,
    }


def _gen_reel_script(narrative: dict, signal: dict) -> dict:
    title = signal.get("title", "")
    core = narrative.get("core_message", "")
    cta = narrative.get("call_to_action", "")
    category = signal.get("category", "environmental")

    hook = f"\"{title[:60]}...\"\n— this just changed everything."
    if category == "environmental":
        hook = f"Breaking: {title[:50]}.\nWhile the world reacts — we plant."

    return {
        "concept": f"60-second field-documentary response to: {title[:80]}",
        "hook": hook,
        "script_beats": [
            f"0–3s: Bold text overlay — '{title[:40]}...'",
            "3–8s: Aerial drone of restored forest (contrast: before/after implied)",
            "8–20s: Field planter hands-in-soil B-roll, seedlings going in",
            f"20–35s: Text overlays — impact data (847K trees, 87% survival, 12,400ha)",
            f"35–50s: Direct-to-camera planter: \"{narrative.get('core_message', '')[:80]}...\"",
            f"50–58s: CTA screen — '{cta[:60]}'",
            "58–60s: Logo + handle lock-up",
        ],
        "cta": cta,
        "recommended_duration": "60s",
        "sound_suggestion": "Cinematic ambient — low strings + nature SFX, no lyrics in hook",
        "caption_hook": hook,
        "platform_notes": "First 3 seconds are critical — text overlay + movement + contrast",
    }


def _gen_story_sequence(narrative: dict, signal: dict) -> List[dict]:
    title = signal.get("title", "")
    core = narrative.get("core_message", "")
    cta = narrative.get("call_to_action", "")

    return [
        {
            "slide": 1,
            "type": "text_overlay",
            "content": f"🚨 {title[:80]}",
            "design_note": "Dark background, red urgency dot, bold white text",
            "cta": "TAP FOR MORE →",
        },
        {
            "slide": 2,
            "type": "photo_text",
            "content": "While headlines break...\nWe plant.",
            "design_note": "Field photo background, bold text overlay, low opacity dark gradient",
            "cta": None,
        },
        {
            "slide": 3,
            "type": "data_card",
            "content": "TODAY:\n847 trees in the ground\n1,203 yesterday\n990 the day before\n\nEvery single day.",
            "design_note": "Clean dark card, green numbers, monospace font",
            "cta": "SWIPE UP → SPONSOR A TREE",
        },
        {
            "slide": 4,
            "type": "cta_poll",
            "content": f"{core[:100]}...",
            "design_note": "Brand green background, white text, poll sticker or link sticker",
            "cta": cta[:60],
        },
    ]


def _gen_substack(narrative: dict, signal: dict) -> dict:
    title = signal.get("title", "")
    core = narrative.get("core_message", "")
    angle = narrative.get("recommended_angle", "")
    cta = narrative.get("call_to_action", "")
    summary = signal.get("summary", "")

    return {
        "subject_line": f"Field Report: Our response to '{title[:60]}'",
        "preview_text": f"While the news cycle reacts, our planters act. Here's what we're doing.",
        "opening_paragraph": (
            f"This week, '{title}' broke into the mainstream news cycle. "
            f"By the time most organizations drafted a statement, our field teams had already planted 847 more trees. "
            f"This is our field report."
        ),
        "body_outline": [
            f"1. The Signal: What '{title[:60]}' actually means for global forests",
            "2. Our Response: What Integrity's field teams did in the past 48 hours",
            "3. The Numbers: Impact data that proves the approach works",
            "4. The Angle: " + angle[:120],
            "5. What You Can Do: Specific action + sponsor link",
        ],
        "closing_paragraph": (
            "You don't need to wait for the next summit or the next headline. "
            "You can plant a tree today. That's always been where we start. "
            f"{cta}"
        ),
        "cta": cta,
    }


# ---------------------------------------------------------------------------
# Main content generation
# ---------------------------------------------------------------------------

async def _enrich_with_claude(content: dict, narrative: dict, signal: dict) -> dict:
    """Optionally enrich X thread hook with Claude."""
    if not ANTHROPIC_KEY:
        return content
    try:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_KEY)

        current_hook = content["x_thread"][0]["text"] if content["x_thread"] else ""

        prompt = f"""You are a viral content strategist for Integrity Reforestation.

Signal: {signal.get('title')}
Category: {signal.get('category')}
Opportunity Score: {signal.get('opportunity_score')}/100

Rewrite this X thread opening tweet to be more compelling and viral (max 240 chars):
Current: {current_hook}

Requirements: Must hook in first 10 words. Must create curiosity or urgency. Must mention reforestation or forests.
Respond with ONLY the tweet text, nothing else."""

        message = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=100,
            messages=[{"role": "user", "content": prompt}],
        )
        improved_hook = message.content[0].text.strip()
        if improved_hook and len(improved_hook) < 280:
            content["x_thread"][0]["text"] = improved_hook
            content["x_thread"][0]["char_count"] = len(improved_hook)
            content["ai_enhanced"] = True
    except Exception:
        pass
    return content


async def generate_content(narrative: dict, signal: dict) -> dict:
    """Generate all platform content from a narrative + signal."""
    content = {
        "content_id": f"cnt-{uuid.uuid4().hex[:10]}",
        "narrative_id": narrative.get("narrative_id"),
        "signal_id": signal.get("id"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "x_thread": _gen_x_thread(narrative, signal),
        "instagram_carousel": _gen_instagram_carousel(narrative, signal),
        "reel_script": _gen_reel_script(narrative, signal),
        "story_sequence": _gen_story_sequence(narrative, signal),
        "substack": _gen_substack(narrative, signal),
        "ai_enhanced": False,
    }
    content = await _enrich_with_claude(content, narrative, signal)
    return content
