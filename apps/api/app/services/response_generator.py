"""
Response Generator Service
Given a NarrativeTopic, generates X thread, LinkedIn post, and Substack outline.
Optionally enriches with Claude.
"""

import os
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any

# ---------------------------------------------------------------------------
# Template banks keyed by category
# ---------------------------------------------------------------------------

X_THREAD_OPENERS: Dict[str, List[str]] = {
    "environmental": [
        "🔥 The {title} is not a distant threat. It's happening NOW. Here's what you need to know: 🧵",
        "There's a narrative forming around {title} and most people are getting it wrong. Thread 🧵",
        "Breaking down the {title} situation — and why Integrity Reforestation is already in the field: 🧵",
    ],
    "cultural": [
        "The conversation around {title} just hit a new level. Here's the full picture: 🧵",
        "Everyone is talking about {title}. Here's what the data actually shows: 🧵",
    ],
    "social": [
        "The {title} movement is gaining momentum. Here's why it matters: 🧵",
        "People are mobilizing around {title}. Here's the ground truth: 🧵",
    ],
    "political": [
        "The {title} debate is missing the most important point. Let me explain: 🧵",
        "Policy is moving on {title}. Here's what it means for the ground: 🧵",
    ],
    "trend": [
        "The {title} trend is bigger than the headlines suggest. Full breakdown: 🧵",
        "{title} is trending for a reason. Here's the real story: 🧵",
    ],
}

LINKEDIN_TEMPLATES: Dict[str, str] = {
    "environmental": """The conversation around {title} is intensifying — and it demands a clear-eyed response.

Here's what the data shows: {summary}

At Integrity Reforestation, we've been working on the ground for years addressing exactly this kind of narrative. Our teams have planted millions of trees, restored degraded ecosystems, and built community-led conservation programs that create lasting change.

The {title} situation is a signal. It tells us that the window for action is narrowing.

Here are three things organizations can do right now:

1. **Document and share field evidence** — The best counter-narrative to misinformation is verifiable on-the-ground data.
2. **Engage the conversation, not just the crisis** — Responding to trending narratives with authentic content builds long-term authority.
3. **Mobilize community voices** — The people most affected by {category} issues are the most credible messengers.

Integrity Reforestation is active in this space. Follow along as we share what we're seeing from the field.

#Reforestation #Conservation #ClimateAction #EnvironmentalLeadership""",

    "cultural": """Something important is happening in the cultural conversation around {title}.

{summary}

For organizations working at the intersection of environment and impact, these cultural moments are opportunities — not just crises to manage.

The question isn't whether to engage. It's how to engage with integrity.

#Conservation #ImpactOrganization #Reforestation""",
}

SUBSTACK_OUTLINES: Dict[str, List[Dict[str, str]]] = {
    "environmental": [
        {"section": "The Signal", "description": "What is happening right now — the facts behind {title}"},
        {"section": "Why This Matters", "description": "The broader ecological and social context of {title}"},
        {"section": "The Misinformation Layer", "description": "What's being misrepresented and why it matters"},
        {"section": "Ground Truth", "description": "What we're seeing from field operations in real time"},
        {"section": "The Response Window", "description": "How long this narrative will remain active and why timing matters"},
        {"section": "What Organizations Should Do", "description": "Actionable guidance for conservation-aligned organizations"},
        {"section": "Integrity's Position", "description": "Where Integrity Reforestation stands and what we're doing about it"},
    ],
    "cultural": [
        {"section": "The Cultural Moment", "description": "Why {title} is resonating right now"},
        {"section": "The Data Behind the Story", "description": "Engagement, search trends, and what audiences are actually saying"},
        {"section": "The Conservation Angle", "description": "How reforestation and conservation organizations fit into this narrative"},
        {"section": "Content Strategy", "description": "How to create authentic content that adds value to the conversation"},
        {"section": "Audience Signals", "description": "What your audience expects to hear from you on this topic"},
        {"section": "The Long Game", "description": "How engaging with cultural narratives builds lasting authority"},
        {"section": "Call to Action", "description": "Specific actions your audience can take right now"},
    ],
    "default": [
        {"section": "The Narrative", "description": "What the {title} story is really about"},
        {"section": "The Evidence", "description": "Data, sources, and ground-level documentation"},
        {"section": "The Opportunity", "description": "Why this moment matters for conservation organizations"},
        {"section": "The Response", "description": "How Integrity Reforestation is responding"},
        {"section": "Community Action", "description": "How planters and communities are engaged"},
        {"section": "What You Can Do", "description": "Practical steps for individuals and organizations"},
        {"section": "The Bigger Picture", "description": "How this connects to the global reforestation mission"},
    ],
}


def _generate_x_thread(topic: dict) -> List[dict]:
    category = topic.get("category", "environmental")
    title = topic.get("title", "this narrative")
    keywords = topic.get("keywords", [])[:4]
    summary = topic.get("summary", "")
    sources = topic.get("sources", [])
    score = topic.get("opportunity_score", 50)
    controversy = topic.get("controversy_score", 0)

    openers = X_THREAD_OPENERS.get(category, X_THREAD_OPENERS["environmental"])
    opener = openers[0].format(title=title)

    tweets = [
        {
            "position": 1,
            "text": opener,
            "char_count": len(opener),
            "engagement_hook": "pattern_interrupt",
            "media_suggestion": "Aerial drone footage or striking visual",
        },
        {
            "position": 2,
            "text": f"Here's the situation: {summary[:200] if summary else 'Multiple credible sources are reporting significant developments.'}",
            "char_count": 0,
            "engagement_hook": None,
            "media_suggestion": None,
        },
        {
            "position": 3,
            "text": f"The signals are clear: {', '.join(keywords[:3])} are all converging. This isn't isolated — it's a pattern.",
            "char_count": 0,
            "engagement_hook": "data_point",
            "media_suggestion": None,
        },
        {
            "position": 4,
            "text": f"Sources tracking this include: {', '.join(sources[:4])}. The conversation velocity is {'high' if score >= 70 else 'moderate'} and {'rising' if topic.get('trend_direction') == 'rising' else 'sustained'}.",
            "char_count": 0,
            "engagement_hook": None,
            "media_suggestion": "Source screenshots or data visualization",
        },
        {
            "position": 5,
            "text": "At Integrity Reforestation, we've been responding to exactly this kind of signal from the field for years. Here's what's different about how we approach it:",
            "char_count": 0,
            "engagement_hook": "authority",
            "media_suggestion": "Field team photo or B-roll clip",
        },
        {
            "position": 6,
            "text": "We don't just plant trees — we build the narrative infrastructure for lasting conservation. Every signal like this is an opportunity to show what ground-level response looks like.",
            "char_count": 0,
            "engagement_hook": None,
            "media_suggestion": None,
        },
    ]

    if controversy >= 40:
        tweets.append({
            "position": 7,
            "text": f"There's controversy in this space. We've seen the {keywords[0] if keywords else 'greenwashing'} debate before. Our answer: verified impact, transparent data, boots on the ground.",
            "char_count": 0,
            "engagement_hook": "controversy_acknowledgment",
            "media_suggestion": "Impact documentation or before/after imagery",
        })

    tweets.append({
        "position": len(tweets) + 1,
        "text": "Follow @IntegrityReforestation for real-time field updates. And if this thread was useful — repost it. This conversation needs more signal, less noise. 🌱",
        "char_count": 0,
        "engagement_hook": "cta",
        "media_suggestion": None,
    })

    # Fill char counts
    for t in tweets:
        if t["char_count"] == 0:
            t["char_count"] = len(t["text"])

    return tweets


def _generate_linkedin_post(topic: dict) -> dict:
    category = topic.get("category", "environmental")
    title = topic.get("title", "this narrative")
    summary = topic.get("summary", "")
    template_key = category if category in LINKEDIN_TEMPLATES else "environmental"
    body = LINKEDIN_TEMPLATES[template_key].format(
        title=title,
        summary=summary[:200] if summary else "significant developments are emerging",
        category=category,
    )
    return {
        "title": f"Responding to: {title}",
        "body": body,
        "word_count": len(body.split()),
        "suggested_image": "Field operation or impact visual",
        "suggested_cta": "Comment with your perspective or DM us to collaborate",
    }


def _generate_substack_outline(topic: dict) -> dict:
    category = topic.get("category", "environmental")
    title = topic.get("title", "this narrative")
    template = SUBSTACK_OUTLINES.get(category, SUBSTACK_OUTLINES["default"])
    sections = [
        {
            "section": s["section"],
            "description": s["description"].format(
                title=title,
                category=category,
            ),
        }
        for s in template
    ]
    return {
        "title": f"Narrative Intelligence Report: {title}",
        "subtitle": f"A field-level response to the {category} conversation",
        "intro": f"This edition covers the {title} narrative — what it means, why it's trending, and how conservation organizations should respond.",
        "sections": sections,
        "suggested_length": "1,200 – 1,800 words",
        "suggested_cta": "Subscribe for weekly narrative intelligence from the field",
        "tags": topic.get("keywords", [])[:5],
    }


async def generate_response(topic: dict) -> dict:
    """Generate full response package for a narrative topic."""
    response_id = "resp-" + str(uuid.uuid4())[:10]
    now = datetime.now(timezone.utc).isoformat()

    x_thread = _generate_x_thread(topic)
    linkedin_post = _generate_linkedin_post(topic)
    substack_outline = _generate_substack_outline(topic)

    # Optional Claude enrichment
    ai_enhanced = False
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
    if anthropic_key:
        try:
            from anthropic import AsyncAnthropic
            client = AsyncAnthropic(api_key=anthropic_key)
            prompt = (
                f"You are a strategic content writer for Integrity Reforestation, a conservation organization. "
                f"Improve the opening tweet of this X thread for maximum engagement. "
                f"The narrative topic is: '{topic.get('title')}'. "
                f"Current opener: '{x_thread[0]['text']}'. "
                f"Return only the improved tweet text, max 280 characters. Keep the emoji and thread indicator."
            )
            msg = await client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=100,
                messages=[{"role": "user", "content": prompt}],
            )
            improved = msg.content[0].text.strip()
            if improved and len(improved) <= 280:
                x_thread[0]["text"] = improved
                x_thread[0]["char_count"] = len(improved)
                ai_enhanced = True
        except Exception:
            pass

    return {
        "response_id": response_id,
        "topic_id": topic.get("topic_id", ""),
        "topic_title": topic.get("title", ""),
        "x_thread": x_thread,
        "linkedin_post": linkedin_post,
        "substack_outline": substack_outline,
        "generated_at": now,
        "ai_enhanced": ai_enhanced,
    }
