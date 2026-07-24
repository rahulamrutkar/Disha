"""
Disha backend — single Vercel Python serverless function.
Uses Yahoo Finance's public JSON API directly (no yfinance/pandas/numpy needed).
Calls Gemini API for sentiment + buy/sell narrative.
All logic is inlined so there are no import path issues on Vercel.
"""
import os, json, time, math
from datetime import datetime
from urllib.parse import quote_plus
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
import feedparser
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Disha API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Cache ───────────────────────────────────────────────────────────────────────
_cache: dict = {}
CACHE_TTL = 120

def _cached(key, builder):
    now = time.time()
    if key in _cache and now - _cache[key][0] < CACHE_TTL:
        return _cache[key][1]
    val = builder()
    _cache[key] = (now, val)
    return val

# ── Stock Data via Yahoo Finance public JSON API ─────────────────────────────────
YF_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
}

def to_nse(symbol: str) -> str:
    symbol = symbol.strip().upper()
    if not symbol.endswith(".NS") and not symbol.endswith(".BO"):
        symbol = f"{symbol}.NS"
    return symbol

def fetch_chart(nse_symbol: str, interval: str = "1d", range_: str = "1mo") -> dict:
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{quote_plus(nse_symbol)}"
    params = {"interval": interval, "range": range_, "includePrePost": "false"}
    r = requests.get(url, params=params, headers=YF_HEADERS, timeout=15)
    r.raise_for_status()
    data = r.json()
    result = data.get("chart", {}).get("result")
    if not result:
        raise ValueError(f"No data returned for {nse_symbol}")
    return result[0]

def get_company_name(symbol: str) -> str:
    nse = to_nse(symbol)
    def build():
        try:
            chart = fetch_chart(nse, "1d", "5d")
            meta = chart.get("meta", {})
            return meta.get("longName") or meta.get("shortName") or symbol
        except Exception:
            return symbol
    return _cached(f"name:{nse}", build)

def get_daily_rows(symbol: str, days: int = 30) -> list[dict]:
    nse = to_nse(symbol)
    range_ = "3mo" if days <= 60 else "6mo"
    def build():
        chart = fetch_chart(nse, "1d", range_)
        timestamps = chart.get("timestamp", [])
        q = chart.get("indicators", {}).get("quote", [{}])[0]
        closes = q.get("close", [])
        highs  = q.get("high", [])
        lows   = q.get("low", [])
        rows = []
        for i, ts in enumerate(timestamps):
            c = closes[i] if i < len(closes) else None
            h = highs[i]  if i < len(highs)  else None
            l = lows[i]   if i < len(lows)   else None
            if c is not None:
                rows.append({
                    "date":  datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d"),
                    "close": round(float(c), 2),
                    "high":  round(float(h), 2) if h else None,
                    "low":   round(float(l), 2) if l else None,
                })
        return rows[-days:]
    return _cached(f"daily:{nse}:{days}", build)

def get_quote(symbol: str) -> dict:
    nse = to_nse(symbol)
    def build():
        chart = fetch_chart(nse, "1d", "5d")
        meta = chart.get("meta", {})
        last = meta.get("regularMarketPrice")
        prev = meta.get("previousClose") or meta.get("chartPreviousClose")
        change = round(float(last) - float(prev), 2) if last and prev else None
        change_pct = round((float(last) - float(prev)) / float(prev) * 100, 2) if last and prev else None
        return {
            "price":          round(float(last), 2) if last else None,
            "previous_close": round(float(prev), 2) if prev else None,
            "change":         change,
            "change_pct":     change_pct,
            "currency":       meta.get("currency", "INR"),
        }
    return _cached(f"quote:{nse}", build)

def get_intraday_rows(symbol: str, days: int = 30) -> list[dict]:
    nse = to_nse(symbol)
    range_ = f"{min(days, 59)}d"
    def build():
        chart = fetch_chart(nse, "60m", range_)
        timestamps = chart.get("timestamp", [])
        closes = chart.get("indicators", {}).get("quote", [{}])[0].get("close", [])
        rows = []
        for i, ts in enumerate(timestamps):
            c = closes[i] if i < len(closes) else None
            if c is not None:
                rows.append({"dt": datetime.utcfromtimestamp(ts), "close": float(c)})
        return rows
    return _cached(f"intraday:{nse}:{days}", build)

# ── Technical Analysis (pure Python) ────────────────────────────────────────────

def basic_stats(rows: list[dict]) -> dict:
    closes = [r["close"] for r in rows if r.get("close")]
    if not closes:
        return {}
    n = len(closes)
    mean = sum(closes) / n
    std = math.sqrt(sum((c - mean) ** 2 for c in closes) / n)
    return {
        "min":                  round(min(closes), 2),
        "max":                  round(max(closes), 2),
        "average":              round(mean, 2),
        "std_dev":              round(std, 2),
        "period_start_price":   closes[0],
        "period_end_price":     closes[-1],
        "period_change_pct":    round((closes[-1] - closes[0]) / closes[0] * 100, 2),
        "num_trading_days":     n,
    }

def compute_sma(closes: list, period: int):
    if len(closes) < period:
        return None
    return round(sum(closes[-period:]) / period, 2)

def compute_rsi(closes: list, period: int = 14):
    if len(closes) < period + 1:
        return None
    gains, losses = [], []
    for i in range(1, len(closes)):
        d = closes[i] - closes[i - 1]
        gains.append(max(d, 0))
        losses.append(max(-d, 0))
    ag = sum(gains[-period:]) / period
    al = sum(losses[-period:]) / period
    if al == 0:
        return 100.0
    return round(100 - 100 / (1 + ag / al), 2)

def technical_signal(rows: list[dict]) -> dict:
    closes = [r["close"] for r in rows if r.get("close")]
    score, reasons = 0, []
    sma5  = compute_sma(closes, 5)
    sma20 = compute_sma(closes, 20)
    rsi   = compute_rsi(closes)
    if sma5 and sma20:
        if sma5 > sma20:
            score += 1; reasons.append("5-day average is above the 20-day average (short-term uptrend).")
        else:
            score -= 1; reasons.append("5-day average is below the 20-day average (short-term downtrend).")
    if rsi:
        if rsi >= 70:
            score -= 1; reasons.append(f"RSI is {rsi} — overbought territory, pullback risk.")
        elif rsi <= 30:
            score += 1; reasons.append(f"RSI is {rsi} — oversold territory, bounce potential.")
        else:
            reasons.append(f"RSI is {rsi} — neutral momentum.")
    label = "bullish" if score >= 1 else "bearish" if score <= -1 else "neutral"
    return {"label": label, "score": score, "rsi_14": rsi, "sma_5": sma5, "sma_20": sma20, "reasons": reasons}

SESSIONS = [
    ("Morning (9:15-11:00)", 9, 11),
    ("Midday (11:00-13:00)", 11, 13),
    ("Afternoon (13:00-15:30)", 13, 16),
]
WEEKDAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday"]

def timing_pattern(intraday: list[dict]) -> dict:
    if not intraday:
        return {"available": False, "grid": [], "best_buy": None, "best_sell": None}
    by_date: dict = {}
    for r in intraday:
        d = r["dt"].date()
        by_date.setdefault(d, []).append(r["close"])
    day_means = {d: sum(v) / len(v) for d, v in by_date.items()}
    buckets: dict = {}
    for r in intraday:
        dt = r["dt"]
        wd = dt.strftime("%A")
        if wd not in WEEKDAYS:
            continue
        sess = next((n for n, s, e in SESSIONS if s <= dt.hour < e), None)
        if not sess:
            continue
        dm = day_means.get(dt.date(), 0)
        if dm > 0:
            buckets.setdefault(f"{wd}|{sess}", []).append((r["close"] - dm) / dm * 100)
    grid = []
    for wd in WEEKDAYS:
        for name, _, _ in SESSIONS:
            vals = buckets.get(f"{wd}|{name}", [])
            if len(vals) >= 2:
                grid.append({"weekday": wd, "session": name,
                             "avg_rel_pct": round(sum(vals) / len(vals), 3),
                             "sample_size": len(vals)})
    if not grid:
        return {"available": False, "grid": [], "best_buy": None, "best_sell": None}
    return {
        "available":    True,
        "grid":         grid,
        "best_buy":     min(grid, key=lambda r: r["avg_rel_pct"]),
        "best_sell":    max(grid, key=lambda r: r["avg_rel_pct"]),
        "lookback_days": len(by_date),
    }

# ── News ────────────────────────────────────────────────────────────────────────

def fetch_news(company_name: str, max_items: int = 8) -> list[dict]:
    q = quote_plus(f'"{company_name}" stock OR shares OR NSE OR BSE')
    url = f"https://news.google.com/rss/search?q={q}&hl=en-IN&gl=IN&ceid=IN:en"
    feed = feedparser.parse(url)
    items = []
    for entry in feed.entries[:max_items]:
        src = None
        if hasattr(getattr(entry, "source", None), "title"):
            src = entry.source.title
        elif " - " in entry.title:
            src = entry.title.rsplit(" - ", 1)[-1]
        items.append({"title": entry.title, "link": entry.link,
                      "source": src or "Google News",
                      "published": getattr(entry, "published", None)})
    return items

# ── Gemini AI ───────────────────────────────────────────────────────────────────

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
_ai_cache: dict = {}

def call_gemini(prompt: str):
    key   = os.getenv("GEMINI_API_KEY", "")
    model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
    if not key or key == "your_gemini_api_key_here":
        return None
    ck = hash(prompt)
    now = time.time()
    if ck in _ai_cache and now - _ai_cache[ck][0] < 300:
        return _ai_cache[ck][1]
    try:
        r = requests.post(
            GEMINI_URL.format(model=model, key=key),
            json={"contents": [{"parts": [{"text": prompt}]}],
                  "generationConfig": {"response_mime_type": "application/json", "temperature": 0.3}},
            timeout=25,
        )
        r.raise_for_status()
        text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(text)
        _ai_cache[ck] = (now, parsed)
        return parsed
    except Exception as e:
        print(f"Gemini error: {e}")
        return None

def analyze_sentiment(company: str, headlines: list[str]) -> dict:
    if not headlines:
        return {"overall_sentiment": "neutral", "sentiment_score": 0,
                "summary": "No recent news found.", "key_events": [],
                "per_headline": [], "ai_available": False}
    numbered = "\n".join(f"{i+1}. {h}" for i, h in enumerate(headlines))
    prompt = f"""Analyze these headlines about {company} (Indian NSE/BSE stock):
{numbered}
Return ONLY valid JSON with NO markdown fences:
{{"overall_sentiment":"positive|negative|neutral|mixed","sentiment_score":<-1.0 to 1.0>,"summary":"<2-3 sentences>","key_events":["<event>"],"per_headline":[{{"headline":"<text>","sentiment":"positive|negative|neutral","reason":"<short>"}}]}}"""
    result = call_gemini(prompt)
    if not result:
        return {"overall_sentiment": "unknown", "sentiment_score": 0,
                "summary": "AI unavailable — set GEMINI_API_KEY in Vercel environment variables.",
                "key_events": [], "ai_available": False,
                "per_headline": [{"headline": h, "sentiment": "unknown", "reason": ""} for h in headlines]}
    result["ai_available"] = True
    return result

def generate_call(symbol: str, company: str, stats: dict, tech: dict, timing: dict, sentiment: dict) -> dict:
    prompt = f"""Educational stock analysis for {company} ({symbol}, NSE India).
Stats (30 days): {json.dumps(stats)}
Technical: {json.dumps(tech)}
Timing: {json.dumps(timing)}
Sentiment: {json.dumps({k:v for k,v in sentiment.items() if k!="per_headline"})}
Return ONLY valid JSON with NO markdown fences:
{{"call":"BUY|SELL|HOLD","confidence":<0-100>,"rationale":"<3-4 sentences combining technical + sentiment>","key_risks":["<risk>","<risk>"],"disclaimer":"Educational demo only. Not financial advice. Verify independently before trading."}}"""
    result = call_gemini(prompt)
    if not result:
        score = tech.get("score", 0) + sentiment.get("sentiment_score", 0)
        return {"call": "BUY" if score > 0.5 else "SELL" if score < -0.5 else "HOLD",
                "confidence": 40, "rationale": "AI narrative unavailable — add GEMINI_API_KEY to Vercel env vars.",
                "key_risks": ["AI unavailable"],
                "disclaimer": "Educational demo only. Not financial advice.", "ai_available": False}
    result["ai_available"] = True
    return result

# ── Routes ──────────────────────────────────────────────────────────────────────

POPULAR_SYMBOLS = [
    {"symbol": "RELIANCE",   "name": "Reliance Industries"},
    {"symbol": "TCS",        "name": "Tata Consultancy Services"},
    {"symbol": "INFY",       "name": "Infosys"},
    {"symbol": "HDFCBANK",   "name": "HDFC Bank"},
    {"symbol": "ICICIBANK",  "name": "ICICI Bank"},
    {"symbol": "SBIN",       "name": "State Bank of India"},
    {"symbol": "TATAMOTORS", "name": "Tata Motors"},
    {"symbol": "ITC",        "name": "ITC Limited"},
    {"symbol": "WIPRO",      "name": "Wipro"},
    {"symbol": "ADANIENT",   "name": "Adani Enterprises"},
    {"symbol": "BAJFINANCE", "name": "Bajaj Finance"},
    {"symbol": "MARUTI",     "name": "Maruti Suzuki"},
    {"symbol": "HINDUNILVR", "name": "Hindustan Unilever"},
    {"symbol": "KOTAKBANK",  "name": "Kotak Mahindra Bank"},
    {"symbol": "LT",         "name": "Larsen & Toubro"},
]

@app.get("/api/health")
def health():
    has_key = bool(os.getenv("GEMINI_API_KEY")) and os.getenv("GEMINI_API_KEY") != "your_gemini_api_key_here"
    return {"status": "ok", "ai_enabled": has_key, "model": os.getenv("GEMINI_MODEL", "gemini-3.5-flash")}

@app.get("/api/symbols")
def symbols():
    return POPULAR_SYMBOLS

@app.get("/api/analyze/{symbol}")
def analyze(symbol: str):
    symbol = symbol.strip().upper().replace(".NS", "").replace(".BO", "")
    try:
        rows = get_daily_rows(symbol, days=30)
        if not rows:
            raise HTTPException(404, f"No data for '{symbol}'. Check the NSE symbol.")
        company  = get_company_name(symbol)
        quote    = get_quote(symbol)
        stats    = basic_stats(rows)
        tech     = technical_signal(rows)
        try:
            intraday = get_intraday_rows(symbol, days=30)
            timing   = timing_pattern(intraday)
        except Exception as e:
            print(f"Intraday err: {e}")
            timing = {"available": False, "grid": [], "best_buy": None, "best_sell": None}
        try:
            news_items = fetch_news(company)
        except Exception as e:
            print(f"News err: {e}")
            news_items = []
        sentiment  = analyze_sentiment(company, [n["title"] for n in news_items])
        call_data  = generate_call(symbol, company, stats, tech, timing, sentiment)
        per_hl     = {ph["headline"]: ph for ph in sentiment.get("per_headline", [])}
        merged_news = [
            {**item,
             "sentiment": per_hl.get(item["title"], {}).get("sentiment", "unknown"),
             "reason":    per_hl.get(item["title"], {}).get("reason", "")}
            for item in news_items
        ]
        return {
            "symbol": symbol, "nse_symbol": f"{symbol}.NS", "company_name": company,
            "quote": quote, "stats": stats, "price_series": rows,
            "technical": tech, "timing": timing, "news": merged_news,
            "sentiment": {k: v for k, v in sentiment.items() if k != "per_headline"},
            "call": call_data,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to analyze '{symbol}': {e}")

# Vercel needs this export
handler = app

# ── Stock Screener ──────────────────────────────────────────────────────────────
# Uses the same v10/quoteSummary endpoint as the analyze feature (known to work).
# Fetches 25 stocks in parallel (5 workers) to finish within Vercel's 10s timeout.

SCREENER_UNIVERSE = [
    "RELIANCE", "TCS", "HDFCBANK", "BHARTIARTL", "ICICIBANK",
    "INFY", "SBIN", "HINDUNILVR", "ITC", "KOTAKBANK",
    "LT", "HCLTECH", "MARUTI", "BAJFINANCE", "ASIANPAINT",
    "AXISBANK", "TITAN", "WIPRO", "TATAMOTORS", "SUNPHARMA",
    "ONGC", "ADANIENT", "DIVISLAB", "DRREDDY", "TATASTEEL",
]

def _raw(d: dict, key: str):
    """Safely extract .raw from a Yahoo Finance value dict."""
    v = d.get(key, {})
    return v.get("raw") if isinstance(v, dict) else v

def fetch_stock_metrics(symbol: str) -> dict | None:
    """
    Fetch all screening metrics for ONE stock using v10/quoteSummary.
    Results cached for 10 minutes so repeated screener runs are fast.
    """
    nse = to_nse(symbol)
    ck  = f"metrics:{nse}"
    now = time.time()
    if ck in _cache and now - _cache[ck][0] < 600:
        return _cache[ck][1]
    try:
        url = f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{quote_plus(nse)}"
        r = requests.get(url,
                         params={"modules": "price,defaultKeyStatistics,financialData"},
                         headers=YF_HEADERS, timeout=8)
        r.raise_for_status()
        res   = r.json().get("quoteSummary", {}).get("result", [{}])[0]
        pd_   = res.get("price", {})
        ks    = res.get("defaultKeyStatistics", {})
        fd    = res.get("financialData", {})

        price    = _raw(pd_, "regularMarketPrice")
        mkt_cap  = _raw(pd_, "marketCap")
        chg_pct  = _raw(pd_, "regularMarketChangePercent")
        sma50    = _raw(pd_, "fiftyDayAverage")
        pe       = _raw(pd_, "trailingPE") or _raw(ks, "trailingPE")
        rev_g    = _raw(fd, "revenueGrowth")
        name     = pd_.get("longName") or pd_.get("shortName") or symbol

        if price is None:
            return None

        metrics = {
            "symbol":         symbol,
            "name":           name,
            "price":          round(float(price), 2),
            "change_pct":     round(float(chg_pct), 2) if chg_pct is not None else None,
            "market_cap_cr":  round(float(mkt_cap) / 1e7) if mkt_cap else None,
            "pe":             round(float(pe), 2) if pe else None,
            "revenue_growth": round(float(rev_g) * 100, 1) if rev_g is not None else None,
            "trend":          ("bullish" if float(price) > float(sma50) else "bearish") if sma50 else "unknown",
        }
        _cache[ck] = (now, metrics)
        return metrics
    except Exception as e:
        print(f"[screener] {symbol}: {e}")
        return None


@app.get("/api/screener")
def screener(
    min_price: float = 0,
    max_price: float = 999999,
    min_market_cap_cr: float = 0,
    min_pe: float = 0,
    max_pe: float = 9999,
    min_revenue_growth: float = -9999,
    trend: str = "any",
):
    # ── Parallel fetch for all 25 stocks (5 workers) ──────────────────────────
    all_metrics: list[dict] = []
    with ThreadPoolExecutor(max_workers=5) as ex:
        futures = {ex.submit(fetch_stock_metrics, sym): sym for sym in SCREENER_UNIVERSE}
        for future in as_completed(futures, timeout=18):
            try:
                m = future.result()
                if m:
                    all_metrics.append(m)
            except Exception:
                pass

    # ── Apply filters ─────────────────────────────────────────────────────────
    results = []
    for s in all_metrics:
        price = s.get("price")
        if price is None or not (min_price <= price <= max_price):
            continue

        cap = s.get("market_cap_cr")
        if min_market_cap_cr > 0 and (cap is None or cap < min_market_cap_cr):
            continue

        pe = s.get("pe")
        if pe is not None:
            if pe < min_pe or pe > max_pe:
                continue
        elif max_pe < 9999:
            continue

        rg = s.get("revenue_growth")
        if min_revenue_growth > -9999 and (rg is None or rg < min_revenue_growth):
            continue

        if trend != "any" and s.get("trend") != trend:
            continue

        results.append(s)

    results.sort(key=lambda x: x.get("market_cap_cr") or 0, reverse=True)
    return {"total": len(results), "stocks": results}
