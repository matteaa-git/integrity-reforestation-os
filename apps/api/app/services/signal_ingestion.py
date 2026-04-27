"""
Signal Ingestion Service
Pulls environmental / wildfire / reforestation signals from RSS feeds,
Reddit JSON, NewsAPI, and Google News RSS. Falls back to seeded signals
when external sources are unavailable or unconfigured.
"""

import asyncio
import hashlib
import os
import re
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from urllib.parse import urlencode

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Source definitions — all public / no-auth-required by default
# ---------------------------------------------------------------------------

RSS_SOURCES = [
    # --- Google News (topic queries) ---
    {
        "url": "https://news.google.com/rss/search?q=wildfire+deforestation+reforestation&hl=en-US&gl=US&ceid=US:en",
        "source": "Google News",
        "default_category": "environmental",
    },
    {
        "url": "https://news.google.com/rss/search?q=forest+fire+climate+crisis&hl=en-US&gl=US&ceid=US:en",
        "source": "Google News",
        "default_category": "environmental",
    },
    {
        "url": "https://news.google.com/rss/search?q=amazon+deforestation+climate&hl=en-US&gl=US&ceid=US:en",
        "source": "Google News",
        "default_category": "environmental",
    },
    {
        "url": "https://news.google.com/rss/search?q=tree+planting+carbon+offset&hl=en-US&gl=US&ceid=US:en",
        "source": "Google News",
        "default_category": "environmental",
    },
    {
        "url": "https://news.google.com/rss/search?q=climate+change+biodiversity+forest&hl=en-US&gl=US&ceid=US:en",
        "source": "Google News",
        "default_category": "environmental",
    },
    {
        "url": "https://news.google.com/rss/search?q=greenwashing+carbon+credits&hl=en-US&gl=US&ceid=US:en",
        "source": "Google News",
        "default_category": "trend",
    },
    {
        "url": "https://news.google.com/rss/search?q=reforestation+conservation+ecosystem&hl=en-US&gl=US&ceid=US:en",
        "source": "Google News",
        "default_category": "environmental",
    },
    # --- Google Trends RSS (daily trending searches) ---
    {
        "url": "https://trends.google.com/trends/trendingsearches/daily/rss?geo=US",
        "source": "Google Trends",
        "default_category": "trend",
    },
    # --- BBC News: Science & Environment ---
    {
        "url": "http://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
        "source": "BBC News",
        "default_category": "environmental",
    },
    # --- The Guardian: Environment ---
    {
        "url": "https://www.theguardian.com/environment/rss",
        "source": "The Guardian",
        "default_category": "environmental",
    },
    # --- Reuters: Environment ---
    {
        "url": "https://feeds.reuters.com/reuters/environmentNews",
        "source": "Reuters",
        "default_category": "environmental",
    },
    # --- AP News: Climate ---
    {
        "url": "https://rsshub.app/apnews/topics/climate-and-environment",
        "source": "AP News",
        "default_category": "environmental",
    },
    # --- Reddit: Environmental communities ---
    {
        "url": "https://www.reddit.com/r/environment/new.json?limit=25",
        "source": "Reddit r/environment",
        "default_category": "social",
        "is_reddit": True,
    },
    {
        "url": "https://www.reddit.com/r/climate/new.json?limit=25",
        "source": "Reddit r/climate",
        "default_category": "social",
        "is_reddit": True,
    },
    {
        "url": "https://www.reddit.com/r/reforestation/new.json?limit=25",
        "source": "Reddit r/reforestation",
        "default_category": "social",
        "is_reddit": True,
    },
    {
        "url": "https://www.reddit.com/r/wildfires/new.json?limit=25",
        "source": "Reddit r/wildfires",
        "default_category": "environmental",
        "is_reddit": True,
    },
    {
        "url": "https://www.reddit.com/r/forestry/new.json?limit=25",
        "source": "Reddit r/forestry",
        "default_category": "environmental",
        "is_reddit": True,
    },
    {
        "url": "https://www.reddit.com/r/sustainability/new.json?limit=20",
        "source": "Reddit r/sustainability",
        "default_category": "social",
        "is_reddit": True,
    },
]

# NewsAPI — optional, uses NEWSAPI_KEY env var
NEWSAPI_KEY = os.getenv("NEWSAPI_KEY", "")
NEWSAPI_QUERIES = [
    "wildfire deforestation",
    "reforestation climate",
    "forest conservation",
    "amazon fire",
    "climate crisis trees",
]


# ---------------------------------------------------------------------------
# Keyword banks for scoring + classification
# ---------------------------------------------------------------------------

RELEVANCE_KEYWORDS = {
    "core": ["reforestation", "tree planting", "forest restoration", "deforestation", "wildfire", "forest fire"],
    "supporting": ["climate", "ecosystem", "biodiversity", "habitat", "carbon", "soil", "watershed", "canopy"],
    "action": ["plant", "restore", "protect", "conserve", "regenerate", "rewild"],
    "geography": ["amazon", "borneo", "africa", "indonesia", "brazil", "colombia", "mexico", "sahel"],
}

URGENCY_KEYWORDS = [
    "breaking", "urgent", "emergency", "record", "unprecedented", "crisis", "devastating",
    "catastrophic", "alert", "warning", "now", "today", "hours", "immediate",
]

EMOTION_KEYWORDS = {
    "high": ["devastating", "catastrophic", "heartbreaking", "shocking", "incredible", "inspiring", "miraculous"],
    "medium": ["serious", "concerning", "significant", "important", "remarkable", "notable"],
    "low": ["report", "study", "data", "analysis", "update", "news"],
}

CATEGORY_KEYWORDS = {
    "environmental": ["wildfire", "forest", "deforestation", "reforestation", "climate", "ecosystem", "drought", "flood", "species", "biodiversity"],
    "cultural": ["movement", "campaign", "brand", "trend", "viral", "documentary", "film", "event", "day", "week"],
    "social": ["community", "people", "volunteers", "youth", "indigenous", "protest", "awareness", "petition"],
    "political": ["government", "policy", "law", "regulation", "summit", "agreement", "congress", "senate", "COP", "UN"],
    "trend": ["trending", "viral", "popular", "hashtag", "challenge", "meme", "social media"],
}

CONTROVERSY_KEYWORDS = [
    "debate", "controversial", "dispute", "conflict", "divide", "oppose", "against", "criticism",
    "failure", "broken", "wrong", "misleading", "greenwashing",
]


# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------

def _text_lower(title: str, text: str) -> str:
    return f"{title} {text}".lower()


def _compute_relevance(title: str, text: str) -> int:
    combined = _text_lower(title, text)
    score = 0
    for kw in RELEVANCE_KEYWORDS["core"]:
        if kw in combined:
            score += 15
    for kw in RELEVANCE_KEYWORDS["supporting"]:
        if kw in combined:
            score += 5
    for kw in RELEVANCE_KEYWORDS["action"]:
        if kw in combined:
            score += 4
    for kw in RELEVANCE_KEYWORDS["geography"]:
        if kw in combined:
            score += 3
    return min(score, 100)


def _compute_urgency(title: str, text: str, age_hours: float = 0) -> int:
    combined = _text_lower(title, text)
    score = 0
    for kw in URGENCY_KEYWORDS:
        if kw in combined:
            score += 8
    # Recency bonus
    if age_hours < 2:
        score += 30
    elif age_hours < 6:
        score += 20
    elif age_hours < 24:
        score += 10
    elif age_hours < 72:
        score += 5
    return min(score, 100)


def _compute_emotion(title: str, text: str) -> int:
    combined = _text_lower(title, text)
    score = 30  # base
    for kw in EMOTION_KEYWORDS["high"]:
        if kw in combined:
            score += 12
    for kw in EMOTION_KEYWORDS["medium"]:
        if kw in combined:
            score += 6
    return min(score, 100)


def _compute_opportunity(relevance: int, urgency: int, emotion: int, trend_velocity: float) -> int:
    # Weighted composite
    score = (
        relevance * 0.35
        + urgency * 0.30
        + emotion * 0.15
        + min(trend_velocity * 25, 20)
    )
    return min(int(score), 100)


def _classify_category(title: str, text: str) -> str:
    combined = _text_lower(title, text)
    scores = {cat: 0 for cat in CATEGORY_KEYWORDS}
    for cat, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in combined:
                scores[cat] += 1
    best = max(scores, key=lambda c: scores[c])
    return best if scores[best] > 0 else "environmental"


def _classify_status(opportunity_score: int, age_hours: float) -> str:
    if age_hours > 72:
        return "fading"
    if opportunity_score >= 70:
        return "active"
    if opportunity_score >= 50:
        return "emerging"
    return "fading"


def _extract_tags(title: str, text: str) -> List[str]:
    combined = _text_lower(title, text)
    all_tags = list(RELEVANCE_KEYWORDS["core"]) + list(RELEVANCE_KEYWORDS["geography"])
    return [tag.replace(" ", "-") for tag in all_tags if tag in combined][:8]


def _estimate_lifespan(urgency: int, category: str) -> str:
    if urgency >= 80:
        return "24h"
    if urgency >= 60:
        return "48h"
    if category in ["cultural", "trend"]:
        return "1 week"
    return "3 days"


def _estimate_trend_velocity(age_hours: float, source_type: str) -> float:
    """Approximate trend velocity 0.0–3.0"""
    if age_hours < 2:
        base = 2.5
    elif age_hours < 6:
        base = 1.8
    elif age_hours < 24:
        base = 1.2
    else:
        base = 0.6
    if source_type in ["Reddit", "Twitter"]:
        base += 0.4
    return round(min(base, 3.0), 1)


def _signal_id(url: str, title: str) -> str:
    raw = f"{url or ''}{title}"
    return "sig-" + hashlib.md5(raw.encode()).hexdigest()[:12]


def _clean_html(text: str) -> str:
    return re.sub(r"<[^>]+>", " ", text or "").strip()


def _parse_rss_date(date_str: str) -> Optional[datetime]:
    if not date_str:
        return None
    formats = [
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S GMT",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S%z",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------------
# Parsers
# ---------------------------------------------------------------------------

def _parse_rss_xml(xml_text: str, source_name: str, default_category: str) -> List[dict]:
    """Parse RSS XML without requiring feedparser."""
    items = []
    # Simple regex-based RSS extraction
    item_pattern = re.compile(r"<item>(.*?)</item>", re.DOTALL)
    title_pattern = re.compile(r"<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>", re.DOTALL)
    link_pattern = re.compile(r"<link>(.*?)</link>", re.DOTALL)
    desc_pattern = re.compile(r"<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</description>", re.DOTALL)
    pubdate_pattern = re.compile(r"<pubDate>(.*?)</pubDate>", re.DOTALL)

    now = datetime.now(timezone.utc)

    for item_match in item_pattern.finditer(xml_text):
        item_text = item_match.group(1)
        title_m = title_pattern.search(item_text)
        link_m = link_pattern.search(item_text)
        desc_m = desc_pattern.search(item_text)
        date_m = pubdate_pattern.search(item_text)

        if not title_m:
            continue

        title = _clean_html(title_m.group(1).strip())
        url = link_m.group(1).strip() if link_m else ""
        description = _clean_html(desc_m.group(1).strip()) if desc_m else ""
        raw_text = f"{title}. {description}"

        pub_dt = _parse_rss_date(date_m.group(1)) if date_m else now
        if pub_dt is None:
            pub_dt = now
        # Ensure timezone aware
        if pub_dt.tzinfo is None:
            pub_dt = pub_dt.replace(tzinfo=timezone.utc)
        age_hours = max((now - pub_dt).total_seconds() / 3600, 0)

        relevance = _compute_relevance(title, description)
        if relevance < 5:
            continue  # skip irrelevant

        urgency = _compute_urgency(title, description, age_hours)
        emotion = _compute_emotion(title, description)
        trend_velocity = _estimate_trend_velocity(age_hours, source_name)
        opportunity = _compute_opportunity(relevance, urgency, emotion, trend_velocity)
        category = _classify_category(title, description)
        status = _classify_status(opportunity, age_hours)
        tags = _extract_tags(title, description)
        lifespan = _estimate_lifespan(urgency, category)

        sig_id = _signal_id(url, title)

        items.append({
            "id": sig_id,
            "title": title[:200],
            "source": source_name,
            "source_type": "rss",
            "url": url,
            "timestamp": pub_dt.isoformat(),
            "raw_text": raw_text[:1000],
            "summary": description[:400] if description else title,
            "category": category,
            "urgency_score": urgency,
            "relevance_score": relevance,
            "emotion_score": emotion,
            "trend_velocity": trend_velocity,
            "lifespan_estimate": lifespan,
            "opportunity_score": opportunity,
            "status": status,
            "tags": tags,
            "engagement_estimate": 0,
            "is_saved": False,
            "narrative_id": None,
        })
    return items


def _parse_reddit_json(data: dict, source_name: str) -> List[dict]:
    items = []
    now = datetime.now(timezone.utc)
    posts = data.get("data", {}).get("children", [])

    for post in posts:
        p = post.get("data", {})
        title = p.get("title", "")
        url = p.get("url", "")
        selftext = p.get("selftext", "")
        score = p.get("score", 0)
        created_utc = p.get("created_utc", now.timestamp())

        if not title:
            continue

        raw_text = f"{title}. {selftext}"[:1000]
        pub_dt = datetime.fromtimestamp(created_utc, tz=timezone.utc)
        age_hours = max((now - pub_dt).total_seconds() / 3600, 0)

        relevance = _compute_relevance(title, selftext)
        if relevance < 5:
            continue

        # Reddit score boosts trend_velocity
        velocity_boost = min(score / 500, 1.5)
        urgency = _compute_urgency(title, selftext, age_hours)
        emotion = _compute_emotion(title, selftext)
        trend_velocity = round(min(_estimate_trend_velocity(age_hours, "Reddit") + velocity_boost, 3.0), 1)
        opportunity = _compute_opportunity(relevance, urgency, emotion, trend_velocity)
        category = _classify_category(title, selftext)
        status = _classify_status(opportunity, age_hours)
        tags = _extract_tags(title, selftext)
        lifespan = _estimate_lifespan(urgency, category)

        reddit_url = f"https://reddit.com{p.get('permalink', '')}"
        sig_id = _signal_id(reddit_url, title)

        items.append({
            "id": sig_id,
            "title": title[:200],
            "source": source_name,
            "source_type": "reddit",
            "url": reddit_url,
            "timestamp": pub_dt.isoformat(),
            "raw_text": raw_text,
            "summary": (selftext[:300] if selftext else title),
            "category": category,
            "urgency_score": urgency,
            "relevance_score": relevance,
            "emotion_score": emotion,
            "trend_velocity": trend_velocity,
            "lifespan_estimate": lifespan,
            "opportunity_score": opportunity,
            "status": status,
            "tags": tags,
            "engagement_estimate": score,
            "is_saved": False,
            "narrative_id": None,
        })
    return items


def _parse_newsapi_json(data: dict) -> List[dict]:
    items = []
    now = datetime.now(timezone.utc)
    articles = data.get("articles", [])

    for article in articles:
        title = article.get("title", "") or ""
        description = article.get("description", "") or ""
        url = article.get("url", "")
        source_name = article.get("source", {}).get("name", "NewsAPI")
        published_at = article.get("publishedAt", "")
        content = article.get("content", "") or ""

        if not title or title == "[Removed]":
            continue

        raw_text = f"{title}. {description}. {content}"[:1000]

        try:
            pub_dt = datetime.strptime(published_at, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        except (ValueError, TypeError):
            pub_dt = now

        age_hours = max((now - pub_dt).total_seconds() / 3600, 0)

        relevance = _compute_relevance(title, description + content)
        if relevance < 5:
            continue

        urgency = _compute_urgency(title, description, age_hours)
        emotion = _compute_emotion(title, description)
        trend_velocity = _estimate_trend_velocity(age_hours, source_name)
        opportunity = _compute_opportunity(relevance, urgency, emotion, trend_velocity)
        category = _classify_category(title, description)
        status = _classify_status(opportunity, age_hours)
        tags = _extract_tags(title, description)
        lifespan = _estimate_lifespan(urgency, category)

        sig_id = _signal_id(url, title)

        items.append({
            "id": sig_id,
            "title": title[:200],
            "source": source_name,
            "source_type": "newsapi",
            "url": url,
            "timestamp": pub_dt.isoformat(),
            "raw_text": raw_text,
            "summary": description[:400] if description else title,
            "category": category,
            "urgency_score": urgency,
            "relevance_score": relevance,
            "emotion_score": emotion,
            "trend_velocity": trend_velocity,
            "lifespan_estimate": lifespan,
            "opportunity_score": opportunity,
            "status": status,
            "tags": tags,
            "is_saved": False,
            "narrative_id": None,
        })
    return items


# ---------------------------------------------------------------------------
# Fetchers
# ---------------------------------------------------------------------------

async def _fetch_rss(client: httpx.AsyncClient, source: dict) -> List[dict]:
    try:
        resp = await client.get(
            source["url"],
            headers={"User-Agent": "IntegrityGrowthOS/1.0"},
            timeout=12,
            follow_redirects=True,
        )
        if resp.status_code != 200:
            return []
        return _parse_rss_xml(resp.text, source["source"], source["default_category"])
    except Exception as exc:
        logger.warning("RSS fetch failed for %s: %s", source["url"], exc)
        return []


async def _fetch_reddit(client: httpx.AsyncClient, source: dict) -> List[dict]:
    try:
        resp = await client.get(
            source["url"],
            headers={"User-Agent": "IntegrityGrowthOS/1.0"},
            timeout=12,
            follow_redirects=True,
        )
        if resp.status_code != 200:
            return []
        return _parse_reddit_json(resp.json(), source["source"])
    except Exception as exc:
        logger.warning("Reddit fetch failed for %s: %s", source["url"], exc)
        return []


async def _fetch_newsapi(client: httpx.AsyncClient, query: str) -> List[dict]:
    if not NEWSAPI_KEY:
        return []
    try:
        params = {
            "q": query,
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": 20,
            "apiKey": NEWSAPI_KEY,
        }
        resp = await client.get(
            "https://newsapi.org/v2/everything",
            params=params,
            timeout=12,
        )
        if resp.status_code != 200:
            return []
        return _parse_newsapi_json(resp.json())
    except Exception as exc:
        logger.warning("NewsAPI fetch failed: %s", exc)
        return []


# ---------------------------------------------------------------------------
# Main ingestion entry point
# ---------------------------------------------------------------------------

async def ingest_signals() -> List[dict]:
    """Fetch, parse, score, and return all signals from all sources."""
    signals: List[dict] = []
    seen_ids: set = set()

    async with httpx.AsyncClient() as client:
        tasks = []
        for source in RSS_SOURCES:
            if source.get("is_reddit"):
                tasks.append(_fetch_reddit(client, source))
            else:
                tasks.append(_fetch_rss(client, source))

        if NEWSAPI_KEY:
            for query in NEWSAPI_QUERIES:
                tasks.append(_fetch_newsapi(client, query))

        results = await asyncio.gather(*tasks, return_exceptions=True)

    for result in results:
        if isinstance(result, list):
            for sig in result:
                if sig["id"] not in seen_ids and sig.get("relevance_score", 0) >= 10:
                    seen_ids.add(sig["id"])
                    signals.append(sig)

    signals.sort(key=lambda s: s["opportunity_score"], reverse=True)
    logger.info("Signal ingestion complete: %d signals", len(signals))
    return signals
