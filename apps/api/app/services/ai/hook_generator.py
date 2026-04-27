"""
Hook Generator
==============
Template-driven AI-style hook generation.
Produces varied, high-quality hooks based on topic, emotion, content type,
and optional hook category.
"""

import random
from typing import Optional, List, Dict

# ── Pattern templates ──────────────────────────────────────────────────────
# Each entry is (template_string, category, emotion_tags)
# {topic} is replaced with the user's topic; {topic_lower} with lowercase.

_CURIOSITY_PATTERNS = [
    ("Here's what nobody tells you about {topic}", "curiosity", ["surprising", "educational"]),
    ("The truth about {topic} that most people ignore", "curiosity", ["surprising", "educational"]),
    ("Most people get {topic} completely wrong — here's why", "curiosity", ["surprising", "contrarian"]),
    ("What {topic} actually does (and why it matters)", "curiosity", ["educational", "surprising"]),
    ("The hidden side of {topic} no one is talking about", "curiosity", ["surprising", "urgent"]),
    ("I discovered something about {topic} that changed everything", "curiosity", ["surprising", "inspiring"]),
    ("Why {topic} is more important than you think", "curiosity", ["educational", "urgent"]),
    ("The question nobody asks about {topic}", "curiosity", ["surprising", "thought-provoking"]),
    ("This is what {topic} looks like from the inside", "curiosity", ["educational", "authentic"]),
    ("Before you dismiss {topic}, read this", "curiosity", ["educational", "contrarian"]),
]

_SHOCK_PATTERNS = [
    ("We're losing {topic} faster than you can imagine", "shock", ["alarming", "urgent"]),
    ("The numbers behind {topic} will shock you", "shock", ["alarming", "surprising"]),
    ("Nobody prepared me for what {topic} actually involves", "shock", ["alarming", "authentic"]),
    ("This is the reality of {topic} — and it's not pretty", "shock", ["alarming", "honest"]),
    ("How bad is {topic} really? Worse than you think.", "shock", ["alarming", "urgent"]),
    ("{topic} is failing — and here's the proof", "shock", ["alarming", "credible"]),
    ("Every day we delay on {topic}, here's what we lose", "shock", ["urgent", "alarming"]),
    ("The cost of ignoring {topic} is higher than you think", "shock", ["alarming", "educational"]),
]

_AUTHORITY_PATTERNS = [
    ("I spent 3 years working on {topic}. Here's what I learned", "authority", ["credible", "educational"]),
    ("After studying hundreds of {topic} cases, I found one common pattern", "authority", ["credible", "educational"]),
    ("The data on {topic} tells a clear story", "authority", ["credible", "educational"]),
    ("Here's what the science says about {topic}", "authority", ["credible", "educational"]),
    ("I've worked with 50+ teams on {topic}. This is what works", "authority", ["credible", "practical"]),
    ("The research on {topic} is finally clear — here's the summary", "authority", ["educational", "credible"]),
    ("5 things experts know about {topic} that most people don't", "authority", ["educational", "credible"]),
    ("What professionals in {topic} wish you understood", "authority", ["educational", "authoritative"]),
    ("The framework we use to evaluate {topic} success", "authority", ["educational", "practical"]),
]

_STORY_PATTERNS = [
    ("Three years ago we started {topic}. Here's where we are now", "story", ["authentic", "inspiring"]),
    ("When I first discovered {topic}, I had no idea it would change my perspective", "story", ["authentic", "inspiring"]),
    ("Our {topic} journey started with a single decision", "story", ["authentic", "hopeful"]),
    ("We almost gave up on {topic}. Here's what kept us going", "story", ["authentic", "inspiring"]),
    ("The moment I realized {topic} was more than I thought", "story", ["authentic", "surprising"]),
    ("This is the story of how {topic} transformed everything", "story", ["inspiring", "authentic"]),
    ("One year ago, {topic} looked impossible. Not anymore.", "story", ["inspiring", "hopeful"]),
    ("The day {topic} changed our entire approach", "story", ["authentic", "educational"]),
]

_CONTRARIAN_PATTERNS = [
    ("Stop doing {topic} the conventional way — it's not working", "contrarian", ["provocative", "educational"]),
    ("Unpopular opinion: most advice about {topic} is wrong", "contrarian", ["provocative", "surprising"]),
    ("Everyone talks about {topic} — almost no one does it right", "contrarian", ["provocative", "educational"]),
    ("The {topic} advice you've been given is holding you back", "contrarian", ["provocative", "urgent"]),
    ("Why I stopped following the mainstream approach to {topic}", "contrarian", ["authentic", "contrarian"]),
    ("The industry doesn't want you to know the truth about {topic}", "contrarian", ["provocative", "alarming"]),
    ("Rethinking {topic}: everything we thought we knew was wrong", "contrarian", ["thought-provoking", "surprising"]),
    ("{topic} doesn't work the way everyone says it does", "contrarian", ["provocative", "educational"]),
]

_TRANSFORMATION_PATTERNS = [
    ("This is what {topic} can do in 12 months if you commit", "transformation", ["inspiring", "hopeful"]),
    ("Before and after: the impact of {topic} done right", "transformation", ["inspiring", "credible"]),
    ("What {topic} looks like when it actually works", "transformation", ["inspiring", "hopeful"]),
    ("From broken to thriving: the {topic} transformation", "transformation", ["inspiring", "hopeful"]),
    ("How {topic} changed everything we thought we knew", "transformation", ["inspiring", "surprising"]),
    ("This is what's possible when you take {topic} seriously", "transformation", ["inspiring", "motivating"]),
    ("The 5-year {topic} transformation nobody expected", "transformation", ["surprising", "inspiring"]),
    ("Watch what happens when {topic} is done with intention", "transformation", ["inspiring", "educational"]),
]

_ALL_PATTERNS: Dict[str, List] = {
    "curiosity": _CURIOSITY_PATTERNS,
    "shock": _SHOCK_PATTERNS,
    "authority": _AUTHORITY_PATTERNS,
    "story": _STORY_PATTERNS,
    "contrarian": _CONTRARIAN_PATTERNS,
    "transformation": _TRANSFORMATION_PATTERNS,
}

# Emotion → preferred categories mapping
_EMOTION_CATEGORY_BIAS: Dict[str, List[str]] = {
    "inspiring": ["transformation", "story"],
    "educational": ["authority", "curiosity"],
    "urgent": ["shock", "contrarian"],
    "surprising": ["curiosity", "shock"],
    "authentic": ["story", "authority"],
    "provocative": ["contrarian", "shock"],
    "hopeful": ["transformation", "story"],
    "alarming": ["shock", "contrarian"],
}

VALID_CATEGORIES = list(_ALL_PATTERNS.keys())


def generate_hooks(
    topic: str,
    emotion: str = "inspiring",
    content_type: str = "carousel",
    hook_category: Optional[str] = None,
    count: int = 5,
) -> List[dict]:
    """
    Generate hook variations for a given topic and emotion.
    Returns a list of hook dicts (not saved to store — caller decides).
    """
    if not topic.strip():
        return []

    topic_title = topic.strip().title()
    topic_lower = topic.strip().lower()

    results = []
    used_texts: set = set()

    # Determine which categories to draw from
    if hook_category and hook_category in _ALL_PATTERNS:
        categories = [hook_category] * count  # only that category
    else:
        preferred = _EMOTION_CATEGORY_BIAS.get(emotion.lower(), VALID_CATEGORIES)
        # Cycle through preferred categories, then fill with others
        remaining = [c for c in VALID_CATEGORIES if c not in preferred]
        category_pool = (preferred * 3 + remaining * 2)
        random.shuffle(category_pool)
        categories = category_pool[:count * 2]

    attempts = 0
    cat_index = 0
    while len(results) < count and attempts < count * 6:
        attempts += 1
        category = categories[cat_index % len(categories)]
        cat_index += 1

        patterns = _ALL_PATTERNS.get(category, _CURIOSITY_PATTERNS)
        template, cat, emotion_tags = random.choice(patterns)

        # Vary capitalisation slightly
        use_lower = random.random() < 0.3
        t = topic_lower if use_lower else topic_title

        hook_text = template.replace("{topic}", t).replace("{topic_lower}", topic_lower)

        if hook_text in used_texts:
            continue
        used_texts.add(hook_text)

        # Rough performance estimate: authority + story tend to score higher
        base_score = {
            "authority": 80.0,
            "story": 78.0,
            "transformation": 76.0,
            "curiosity": 74.0,
            "contrarian": 72.0,
            "shock": 70.0,
        }.get(category, 65.0)
        # ±8 jitter
        perf_score = round(min(100.0, max(40.0, base_score + random.uniform(-8, 8))), 1)

        results.append({
            "hook_text": hook_text,
            "hook_category": category,
            "topic_tags": [topic_lower] + _infer_topic_tags(topic_lower),
            "emotion_tags": emotion_tags,
            "format": content_type,
            "performance_score": perf_score,
            "times_used": 0,
            "saves": 0,
            "shares": 0,
            "is_favorite": False,
        })

    return results


def _infer_topic_tags(topic: str) -> List[str]:
    """Add related tags based on keywords in the topic."""
    tags: List[str] = []
    kw_map = {
        "tree": ["reforestation", "environment"],
        "forest": ["environment", "ecology"],
        "carbon": ["climate", "sustainability"],
        "reforest": ["trees", "environment"],
        "sustain": ["environment", "impact"],
        "climate": ["environment", "urgent"],
        "brand": ["marketing", "business"],
        "content": ["marketing", "social media"],
        "growth": ["business", "strategy"],
        "community": ["people", "impact"],
        "impact": ["results", "change"],
    }
    tl = topic.lower()
    for kw, related in kw_map.items():
        if kw in tl:
            tags.extend(related)
    return list(set(tags))[:3]
