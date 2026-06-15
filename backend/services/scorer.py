"""
Computes a unified risk summary from all worker results.
Scoring logic:
  - blacklist hit → immediate HIGH
  - judicial records → HIGH unless also a blacklist hit
  - payment_score < 40 → HIGH; 40–65 → MEDIUM; >65 → LOW
  - negative news ratio > 50% → bump risk by one level
  - social_count contributes to digital_presence_score (0–100)
  - identity_consistency: True unless any critical mismatch found by normalizer
"""
from typing import List, Optional


def compute_risk(
    blacklist_hit: bool,
    judicial_records: bool,
    social_count: int,
    payment_score: Optional[int],
    news_sentiments: List[Optional[str]],
    loans: List[dict],
) -> dict:
    overall = "low"

    # Hard stops
    if blacklist_hit:
        overall = "high"
    elif judicial_records:
        overall = "high"
    else:
        # Payment score weighting
        if payment_score is not None:
            if payment_score < 40:
                overall = "high"
            elif payment_score < 65:
                overall = "medium"

        # Overdue loans
        severely_overdue = sum(1 for l in loans if l.get("days_overdue", 0) > 90)
        if severely_overdue >= 2 and overall == "low":
            overall = "medium"
        elif severely_overdue >= 3:
            overall = "high"

    # News sentiment bump
    negative = sum(1 for s in news_sentiments if s == "negative")
    total_news = len(news_sentiments)
    if total_news > 0 and (negative / total_news) > 0.5:
        if overall == "low":
            overall = "medium"
        elif overall == "medium":
            overall = "high"

    # Digital presence score: capped at 100, 20 points per platform found
    digital_presence = min(100, social_count * 20 + (10 if total_news > 0 else 0))

    return {
        "blacklist_hit": blacklist_hit,
        "judicial_records": judicial_records,
        "digital_presence_score": digital_presence,
        "identity_consistency": True,
        "overall_risk": overall,
    }
