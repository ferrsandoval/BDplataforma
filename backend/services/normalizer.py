"""
Deduplicates and normalizes news mentions and public records.
Uses URL as primary dedup key, falls back to title similarity.
"""
from typing import List


def normalize(news_mentions: List[dict]) -> List[dict]:
    seen_urls: set = set()
    seen_titles: set = set()
    result = []

    for item in news_mentions:
        url = item.get("url") or ""
        title = (item.get("title") or "").lower().strip()[:80]

        if url and url in seen_urls:
            continue
        if title and title in seen_titles:
            continue

        if url:
            seen_urls.add(url)
        if title:
            seen_titles.add(title)

        result.append(item)

    return result
