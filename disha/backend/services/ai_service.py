"""
Wraps calls to the Google Gemini API (free tier - get a key with no credit
card at https://aistudio.google.com/apikey). This is the "AI" layer:
1) reads news headlines and scores sentiment / extracts material events
2) turns the technical + sentiment picture into a plain-English buy/sell/hold
   call with a rationale.

Because this hits the public Gemini REST endpoint with your own API key,
you can reuse the exact same calls outside this app (curl, Postman, another
script) for your demo - nothing here is proprietary to this backend.
"""
import os
import json
import time
import requests

GEMINI_URL_TMPL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
_cache: dict[str, tuple[float, dict]] = {}
CACHE_TTL_SECONDS = 300


def _get_config():
    api_key = os.getenv("GEMINI_API_KEY", "")
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    return api_key, model


def _call_gemini(prompt: str) -> dict | None:
    api_key, model = _get_config()
    if not api_key or api_key == "your_gemini_api_key_here":
        return None

    cache_key = f"{model}:{hash(prompt)}"
    now = time.time()
    if cache_key in _cache:
        ts, value = _cache[cache_key]
        if now - ts < CACHE_TTL_SECONDS:
            return value

    url = GEMINI_URL_TMPL.format(model=model, key=api_key)
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.3,
        },
    }
    try:
        resp = requests.post(url, json=body, timeout=25)
        resp.raise_for_status()
        data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(text)
        _cache[cache_key] = (now, parsed)
        return parsed
    except Exception as e:
        print(f"[ai_service] Gemini call failed: {e}")
        return None


def analyze_news_sentiment(company_name: str, headlines: list[str]) -> dict:
    if not headlines:
        return {
            "overall_sentiment": "neutral",
            "sentiment_score": 0.0,
            "summary": "No recent news found for this company.",
            "key_events": [],
            "per_headline": [],
            "ai_available": False,
        }

    numbered = "\n".join(f"{i+1}. {h}" for i, h in enumerate(headlines))
    prompt = f"""You are a financial news analyst. Analyze these recent headlines about {company_name},
an Indian company listed on NSE/BSE. Headlines:
{numbered}

Return ONLY valid JSON with this exact shape, no markdown:
{{
  "overall_sentiment": "positive" | "negative" | "neutral" | "mixed",
  "sentiment_score": <number from -1.0 (very negative) to 1.0 (very positive)>,
  "summary": "<2-3 sentence plain-English summary of what's happening and why it matters to the share price>",
  "key_events": ["<short phrase for each major deal, result, regulatory action, or event that could move the price>"],
  "per_headline": [{{"headline": "<original headline text>", "sentiment": "positive"|"negative"|"neutral", "reason": "<one short clause>"}}]
}}
Be objective and base sentiment strictly on what the headlines say, not speculation."""

    result = _call_gemini(prompt)
    if result is None:
        return {
            "overall_sentiment": "unknown",
            "sentiment_score": 0.0,
            "summary": "AI sentiment analysis is unavailable right now (missing/invalid GEMINI_API_KEY or rate limited). Showing raw headlines only.",
            "key_events": [],
            "per_headline": [{"headline": h, "sentiment": "unknown", "reason": ""} for h in headlines],
            "ai_available": False,
        }
    result["ai_available"] = True
    return result


def generate_call(symbol: str, company_name: str, stats: dict, technical: dict,
                   timing: dict, sentiment: dict) -> dict:
    prompt = f"""You are an assistant that explains stock signals for retail investors learning technical analysis.
This is for an EDUCATIONAL demo app, not licensed financial advice.

Company: {company_name} ({symbol}, NSE)
30-day price stats: {json.dumps(stats)}
Technical indicators: {json.dumps(technical)}
Historical intraday timing pattern (statistical, not predictive): {json.dumps(timing)}
News sentiment: {json.dumps({k: v for k, v in sentiment.items() if k != "per_headline"})}

Based on ALL of the above, return ONLY valid JSON with this exact shape, no markdown:
{{
  "call": "BUY" | "SELL" | "HOLD",
  "confidence": <integer 0-100>,
  "rationale": "<3-4 sentences combining the technical picture and the news sentiment into plain English>",
  "key_risks": ["<short risk factor>", "<short risk factor>"],
  "disclaimer": "This is an automated, educational analysis based on historical data and public news only. It is not personalized financial advice. Markets are unpredictable - verify independently and consider consulting a licensed financial advisor before trading."
}}"""

    result = _call_gemini(prompt)
    if result is None:
        # Deterministic rule-based fallback so the app still works without an AI key.
        score = technical.get("score", 0) + sentiment.get("sentiment_score", 0)
        call = "BUY" if score > 0.5 else "SELL" if score < -0.5 else "HOLD"
        return {
            "call": call,
            "confidence": 40,
            "rationale": "AI narrative unavailable (set GEMINI_API_KEY to enable it). This is a basic rule-based fallback combining the technical score and news sentiment score only.",
            "key_risks": ["AI-generated rationale unavailable", "Based on limited rule-based logic only"],
            "disclaimer": "This is an automated, educational analysis based on historical data and public news only. It is not personalized financial advice. Markets are unpredictable - verify independently and consider consulting a licensed financial advisor before trading.",
            "ai_available": False,
        }
    result["ai_available"] = True
    return result
