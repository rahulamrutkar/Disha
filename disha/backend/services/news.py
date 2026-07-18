"""
Pulls recent headlines about a company from Google News' public RSS feed.
This needs no API key and no signup, which keeps the "free to also use
outside this app" requirement easy: anyone can hit this same RSS URL pattern
directly in a browser or curl.
"""
import feedparser
from urllib.parse import quote_plus

RSS_URL = "https://news.google.com/rss/search?q={query}&hl=en-IN&gl=IN&ceid=IN:en"


def fetch_news(company_name: str, max_items: int = 8) -> list[dict]:
    query = quote_plus(f'"{company_name}" stock OR shares OR NSE OR BSE')
    url = RSS_URL.format(query=query)
    feed = feedparser.parse(url)

    items = []
    for entry in feed.entries[:max_items]:
        source = None
        if "source" in entry and hasattr(entry.source, "title"):
            source = entry.source.title
        elif " - " in entry.title:
            source = entry.title.rsplit(" - ", 1)[-1]

        items.append({
            "title": entry.title,
            "link": entry.link,
            "source": source or "Google News",
            "published": getattr(entry, "published", None),
        })
    return items
