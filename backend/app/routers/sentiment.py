# backend/app/routers/sentiment.py

from fastapi import APIRouter, HTTPException
import feedparser
import numpy as np

router = APIRouter(prefix="/sentiment", tags=["Sentiment"])


def _vader():
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
    return SentimentIntensityAnalyzer()


@router.get("/{ticker}")
async def compute_sentiment(ticker: str, count: int = 10):
    try:
        rss_url = (
            f"https://news.google.com/rss/search"
            f"?q={ticker}+stock&hl=en-IN&gl=IN&ceid=IN:en"
        )
        feed = feedparser.parse(rss_url)
        entries = feed.entries[:count]

        analyzer = _vader()
        headlines = []
        scores = []
        for entry in entries:
            title = entry.get("title", "")
            score = analyzer.polarity_scores(title)["compound"]
            scores.append(score)
            headlines.append({"title": title, "score": round(score, 3)})

        avg_score = round(float(np.mean(scores)), 3) if scores else 0.0
        label = "Positive" if avg_score > 0.05 else "Negative" if avg_score < -0.05 else "Neutral"

        return {
            "ticker": ticker.upper(),
            "sentiment_score": avg_score,
            "sentiment_label": label,
            "headlines": headlines,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
