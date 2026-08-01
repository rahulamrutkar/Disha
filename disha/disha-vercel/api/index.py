"""
Disha backend — single Vercel Python serverless function.
Version: 3.0 — 219 stocks, 17 sectors, fixed filter logic.
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


# ══════════════════════════════════════════════════════════════════════════════
# STOCK SCREENER
# Uses the same v8/finance/chart endpoint as the working Analyze feature.
# Fetches in batches of 5 with 150ms pause to avoid Yahoo Finance rate limits.
# "All Sectors" → 50 blue-chip stocks.  Individual sector → that sector only.
# ══════════════════════════════════════════════════════════════════════════════

SECTORS: dict[str, list[str]] = {
    "Banking": [
        "HDFCBANK", "ICICIBANK", "SBIN", "KOTAKBANK", "AXISBANK",
        "INDUSINDBK", "FEDERALBNK", "IDFCFIRSTB", "BANDHANBNK", "KARURVSYA",
        "CANBK", "PNB", "BANKBARODA", "UNIONBANK", "YESBANK",
    ],
    "NBFC & Finance": [
        "BAJFINANCE", "BAJAJFINSV", "CHOLAFIN", "MUTHOOTFIN", "LICHSGFIN",
        "MANAPPURAM", "SHRIRAMFIN", "HDFCLIFE", "SBILIFE", "ICICIPRULI",
    ],
    "IT & Technology": [
        "TCS", "INFY", "HCLTECH", "WIPRO", "TECHM",
        "LTIM", "MPHASIS", "COFORGE", "PERSISTENT", "OFSS",
    ],
    "FMCG & Consumer Goods": [
        "HINDUNILVR", "ITC", "NESTLEIND", "BRITANNIA", "DABUR",
        "MARICO", "COLPAL", "GODREJCP", "TATACONSUM", "VBL",
    ],
    "Pharma & Healthcare": [
        "SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "LUPIN",
        "AUROPHARMA", "TORNTPHARM", "ALKEM", "ABBOTINDIA", "NATCOPHARM",
    ],
    "Auto & Mobility": [
        "MARUTI", "TATAMOTORS", "HEROMOTOCO", "EICHERMOT", "TVSMOTOR",
        "ASHOKLEY", "MOTHERSON", "BOSCHLTD", "MRF", "APOLLOTYRE",
    ],
    "Energy & Oil & Gas": [
        "RELIANCE", "ONGC", "BPCL", "IOC", "HINDPETRO",
        "GAIL", "PETRONET", "MRPL",
    ],
    "Power & Utilities": [
        "NTPC", "POWERGRID", "TATAPOWER", "ADANIGREEN", "TORNTPOWER",
        "NHPC", "SJVN", "JSWENERGY",
    ],
    "Metals & Mining": [
        "TATASTEEL", "JSWSTEEL", "HINDALCO", "VEDL", "SAIL",
        "NMDC", "COALINDIA", "NATIONALUM",
    ],
    "Infrastructure & Real Estate": [
        "LT", "IRFC", "ADANIPORTS", "DLF", "GODREJPROP",
        "OBEROIRLTY", "PRESTIGE", "BRIGADE",
    ],
    "Cement": [
        "ULTRACEMCO", "GRASIM", "AMBUJACEMENT", "ACC", "SHREECEM", "JKCEMENT",
    ],
    "Chemicals & Fertilisers": [
        "PIDILITIND", "DEEPAKNTR", "GNFC", "CHAMBLFERT", "COROMANDEL", "UPL",
    ],
    "Capital Goods & Defence": [
        "SIEMENS", "ABB", "BHEL", "HAL", "BEL", "THERMAX", "CUMMINSIND",
    ],
    "Consumer Durables": [
        "ASIANPAINT", "TITAN", "HAVELLS", "VOLTAS", "CROMPTON", "VGUARD",
    ],
    "Retail & New Age": [
        "DMART", "TRENT", "NYKAA", "ZOMATO", "PAYTM", "IRCTC",
    ],
}

# Top 50 blue-chip stocks for "All Sectors" — manageable fetch time
ALL_SECTORS_STOCKS = [
    "RELIANCE", "TCS", "HDFCBANK", "ICICIBANK", "SBIN",
    "INFY", "BHARTIARTL", "HINDUNILVR", "ITC", "KOTAKBANK",
    "LT", "HCLTECH", "MARUTI", "BAJFINANCE", "ASIANPAINT",
    "AXISBANK", "TITAN", "WIPRO", "TATAMOTORS", "SUNPHARMA",
    "ONGC", "COALINDIA", "NTPC", "POWERGRID", "TATASTEEL",
    "JSWSTEEL", "HINDALCO", "NESTLEIND", "BRITANNIA", "CIPLA",
    "DRREDDY", "DIVISLAB", "EICHERMOT", "HEROMOTOCO", "BAJAJFINSV",
    "ULTRACEMCO", "ADANIENT", "TATACONSUM", "TECHM", "INDUSINDBK",
    "GRASIM", "PIDILITIND", "DMART", "HAVELLS", "SIEMENS",
    "CANBK", "FEDERALBNK", "BPCL", "IRFC", "TVSMOTOR",
]

SECTOR_MAP = {sym: sec for sec, syms in SECTORS.items() for sym in syms}
ALL_SECTOR_NAMES = sorted(SECTORS.keys())


# Approximate shares outstanding (in Crores) for blue-chip stocks.
# Shares change slowly; multiplied by live price → accurate live Market Cap.
SHARES_CR: dict[str, float] = {
    "RELIANCE": 678.0,  "TCS": 361.0,   "HDFCBANK": 756.0,  "ICICIBANK": 702.0,
    "SBIN": 892.0,      "INFY": 414.0,  "BHARTIARTL": 547.0,"HINDUNILVR": 235.0,
    "ITC": 1253.0,      "KOTAKBANK": 200.0,"LT": 140.0,      "HCLTECH": 271.0,
    "MARUTI": 30.2,     "BAJFINANCE": 60.0,"ASIANPAINT": 95.9,"AXISBANK": 308.0,
    "TITAN": 88.9,      "WIPRO": 521.0, "TATAMOTORS": 369.0,"SUNPHARMA": 240.0,
    "ONGC": 1258.0,     "COALINDIA": 615.0,"NTPC": 967.0,    "POWERGRID": 929.0,
    "TATASTEEL": 1246.0,"JSWSTEEL": 241.0, "HINDALCO": 449.0,"NESTLEIND": 9.6,
    "BRITANNIA": 24.1,  "CIPLA": 80.7,  "DRREDDY": 16.6,    "DIVISLAB": 26.6,
    "EICHERMOT": 27.4,  "HEROMOTOCO": 19.98,"BAJAJFINSV": 159.0,"ULTRACEMCO": 28.8,
    "ADANIENT": 114.0,  "TATACONSUM": 92.7,"TECHM": 97.5,    "INDUSINDBK": 77.8,
    "GRASIM": 65.5,     "PIDILITIND": 50.9,"DMART": 41.8,    "HAVELLS": 62.7,
    "SIEMENS": 35.6,    "CANBK": 912.0, "FEDERALBNK": 201.0,"BPCL": 433.0,
    "IRFC": 1310.0,     "TVSMOTOR": 47.5,
    # Sector stocks
    "IDFCFIRSTB": 710.0,"BANDHANBNK": 161.0,"KARURVSYA": 80.0,"PNB": 1113.0,
    "BANKBARODA": 517.0,"UNIONBANK": 753.0, "YESBANK": 2550.0,"MUTHOOTFIN": 40.1,
    "LICHSGFIN": 50.5,  "MANAPPURAM": 168.6,"SHRIRAMFIN": 37.6,"HDFCLIFE": 203.0,
    "SBILIFE": 100.2,   "ICICIPRULI": 143.8,"LTIM": 29.3,     "MPHASIS": 18.7,
    "COFORGE": 6.2,     "PERSISTENT": 7.7,  "OFSS": 4.2,      "MARICO": 129.3,
    "COLPAL": 27.2,     "GODREJCP": 102.2,  "VBL": 35.8,      "AUROPHARMA": 58.5,
    "TORNTPHARM": 16.9, "ALKEM": 11.9,      "ABBOTINDIA": 2.1,"NATCOPHARM": 18.6,
    "ASHOKLEY": 293.0,  "MOTHERSON": 439.0, "MRF": 0.42,      "APOLLOTYRE": 63.7,
    "IOC": 1415.0,      "HINDPETRO": 212.0, "GAIL": 654.0,    "PETRONET": 150.0,
    "TATAPOWER": 319.0, "ADANIGREEN": 158.4,"TORNTPOWER": 47.6,"NHPC": 1000.0,
    "SJVN": 393.0,      "JSWENERGY": 164.0, "SAIL": 413.0,    "NMDC": 294.0,
    "NATIONALUM": 188.0,"ADANIPORTS": 215.0,"DLF": 247.0,     "GODREJPROP": 27.5,
    "OBEROIRLTY": 36.3, "PRESTIGE": 80.1,   "BRIGADE": 23.8,  "AMBUJACEMENT": 510.0,
    "ACC": 18.8,        "SHREECEM": 3.6,    "JKCEMENT": 7.7,  "GNFC": 15.9,
    "CHAMBLFERT": 41.1, "COROMANDEL": 29.3, "UPL": 76.3,      "ABB": 21.2,
    "BHEL": 349.0,      "HAL": 33.4,        "BEL": 730.0,     "THERMAX": 11.9,
    "CUMMINSIND": 27.7, "VOLTAS": 33.1,     "CROMPTON": 66.4, "VGUARD": 43.4,
    "TRENT": 35.7,      "NYKAA": 194.0,     "ZOMATO": 889.0,  "PAYTM": 63.6,
    "IRCTC": 80.1,      "DEEPAKNTR": 28.0,  "PIDILITIND": 50.9,"VEDL": 371.4,
}


def fetch_one_screener_stock(symbol: str) -> dict | None:
    """
    Fetch price + trend for ONE stock.
    Uses IDENTICAL endpoint to the working Analyze feature (v8/finance/chart).
    Market Cap computed from live price × hardcoded shares (accurate since price is live).
    Cached 10 minutes so repeated screener runs are instant.
    """
    nse = to_nse(symbol)
    ck  = f"scr2:{nse}"
    now = time.time()
    if ck in _cache and now - _cache[ck][0] < 600:
        return _cache[ck][1]
    try:
        # range=1mo gives 20 trading days — enough for 20-day SMA, lighter than 3mo
        chart  = fetch_chart(nse, "1d", "1mo")
        meta   = chart.get("meta", {})
        price  = meta.get("regularMarketPrice")
        if not price:
            return None

        prev    = meta.get("previousClose") or meta.get("chartPreviousClose")
        chg_pct = (
            round((float(price) - float(prev)) / float(prev) * 100, 2)
            if prev and float(prev) > 0 else None
        )
        closes  = [c for c in
                   chart.get("indicators", {}).get("quote", [{}])[0].get("close", [])
                   if c is not None]
        n       = len(closes)
        sma20   = sum(closes[-20:]) / min(n, 20) if n >= 5 else None
        trend   = ("bullish" if float(price) > sma20 else "bearish") if sma20 else "unknown"
        name    = meta.get("longName") or meta.get("shortName") or symbol

        # Live market cap = price × shares_outstanding (shares change slowly)
        shares = SHARES_CR.get(symbol)
        market_cap_cr = round(float(price) * shares / 100) if shares else None
        # Note: dividing by 100 because price is in ₹ and shares in Cr
        # → price(₹) × shares(Cr) / 100 = market_cap in Cr  [1 Cr = ₹1Cr = price×shares×FV/100]
        # Actually: market_cap(Cr) = price(₹) × shares_outstanding(Cr shares) × face_value / 100
        # Simpler: market_cap_cr = price × shares_cr (where shares_cr = shares outstanding in crores)
        # ₹1278 × 678 Cr shares = ₹8,67,084 Cr ← this is correct for Reliance
        market_cap_cr = round(float(price) * shares) if shares else None

        result = {
            "symbol":         symbol,
            "name":           name,
            "sector":         SECTOR_MAP.get(symbol, "—"),
            "price":          round(float(price), 2),
            "change_pct":     chg_pct,
            "market_cap_cr":  market_cap_cr,
            "pe":             None,          # fetched separately for filtered stocks
            "revenue_growth": None,
            "trend":          trend,
        }
        _cache[ck] = (now, result)
        return result
    except Exception as e:
        print(f"[scr] {symbol}: {e}")
        return None


def fetch_screener_universe(symbols: list[str]) -> list[dict]:
    """
    Fetch all stocks in BATCHES OF 5 with 150ms pause between batches.
    Proven to avoid Yahoo Finance rate-limiting that kills large parallel fetches.
    50 stocks → 10 batches × 450ms = ~4.5 seconds total.
    """
    results = []
    batch_size = 5
    for i in range(0, len(symbols), batch_size):
        batch = symbols[i : i + batch_size]
        with ThreadPoolExecutor(max_workers=batch_size) as ex:
            futs = [ex.submit(fetch_one_screener_stock, sym) for sym in batch]
            for fut in futs:
                try:
                    r = fut.result(timeout=10)
                    if r:
                        results.append(r)
                except Exception:
                    pass
        if i + batch_size < len(symbols):
            time.sleep(0.15)   # brief rate-limit pause between batches
    return results


@app.get("/api/sectors")
def get_sectors():
    return {
        "sectors":       ALL_SECTOR_NAMES,
        "total_stocks":  len(ALL_SECTORS_STOCKS),
    }


@app.get("/api/screener")
def screener(
    sector:             str   = "all",
    min_price:          float = 0,
    max_price:          float = 999999,
    min_market_cap_cr:  float = 0,
    min_pe:             float = 0,
    max_pe:             float = 9999,
    min_revenue_growth: float = -9999,
    trend:              str   = "any",
):
    try:
        universe = (
            ALL_SECTORS_STOCKS if sector == "all"
            else SECTORS.get(sector, [])
        )
        if not universe:
            return {"total": 0, "stocks": [], "universe": 0, "sectors": ALL_SECTOR_NAMES}

        all_stocks = fetch_screener_universe(universe)

        # ── Phase 1: filter by price, trend, market cap ─────────────────────
        candidates = []
        for s in all_stocks:
            price = s.get("price")
            if price is None or not (min_price <= price <= max_price):
                continue
            if trend != "any" and s.get("trend") not in (trend, "unknown"):
                continue
            cap = s.get("market_cap_cr")
            if min_market_cap_cr > 0 and cap is not None and cap < min_market_cap_cr:
                continue
            candidates.append(s)

        # ── Phase 2: batch fetch PE + revenue growth for ALL candidates ──────
        # Single request for all symbols — far more reliable than individual calls.
        syms_for_pe = [s["symbol"] for s in candidates]
        pe_ck = f"pe_batch:{'_'.join(syms_for_pe[:5])}"
        now2  = time.time()
        pe_data: dict[str, dict] = {}

        if pe_ck in _cache and now2 - _cache[pe_ck][0] < 900:
            pe_data = _cache[pe_ck]
        else:
            ns_syms = ",".join(f"{s}.NS" for s in syms_for_pe)
            for attempt_url in [
                "https://query1.finance.yahoo.com/v7/finance/quote",
                "https://query2.finance.yahoo.com/v7/finance/quote",
            ]:
                try:
                    r = requests.get(attempt_url,
                        params={"symbols": ns_syms,
                                "fields": "trailingPE,epsTrailingTwelveMonths,revenueGrowth"},
                        headers=YF_HEADERS, timeout=15)
                    if r.status_code == 200:
                        for item in r.json().get("quoteResponse", {}).get("result", []):
                            sym = item.get("symbol","").replace(".NS","")
                            pe  = item.get("trailingPE")
                            eps = item.get("epsTrailingTwelveMonths")
                            rg  = item.get("revenueGrowth")
                            pe_data[sym] = {
                                "pe": round(float(pe), 2) if pe else None,
                                "eps": float(eps) if eps else None,
                                "revenue_growth": round(float(rg)*100,1) if rg is not None else None,
                            }
                        if pe_data:
                            _cache[pe_ck] = pe_data
                            break
                except Exception as e:
                    print(f"[pe_batch] {attempt_url}: {e}")

        # Merge PE + revenue growth into candidates
        for s in candidates:
            sym  = s["symbol"]
            d    = pe_data.get(sym, {})
            pe   = d.get("pe")
            eps  = d.get("eps")
            rg   = d.get("revenue_growth")
            # Compute PE from EPS if direct PE is missing
            if pe is None and eps and eps > 0:
                price_now = s.get("price")
                if price_now:
                    pe = round(float(price_now) / float(eps), 2)
            s["pe"] = pe
            s["revenue_growth"] = rg

        # ── Final PE filter + collect results ─────────────────────────────────
        results = []
        for s in candidates:
            pe = s.get("pe")
            if pe is not None and max_pe < 9999 and (pe < min_pe or pe > max_pe):
                continue
            results.append(s)

        results.sort(key=lambda x: x.get("market_cap_cr") or x.get("price") or 0, reverse=True)
        return {
            "total":   len(results),
            "stocks":  results,
            "universe": len(universe),
            "sectors": ALL_SECTOR_NAMES,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Screener error: {e}")


@app.get("/api/screener/debug")
def screener_debug():
    """Test fetch for 3 stocks using the same method as the screener."""
    samples = fetch_screener_universe(["RELIANCE", "TCS", "CANBK"])
    return {
        "method":        "v8/finance/chart (same as Analyze)",
        "universe_size": len(ALL_SECTORS_STOCKS),
        "samples":       samples,
        "note":          "If samples show price/trend → screener will work",
    }


handler = app

# ── Stock Screener ──────────────────────────────────────────────────────────────
# 170+ stocks across 15 sectors. Fetched in parallel (15 workers).
# vercel.json sets maxDuration:30. Stocks cached 15 min so re-runs are instant.

SECTORS: dict[str, list[str]] = {
    "Banking": [
        "HDFCBANK", "ICICIBANK", "SBIN", "KOTAKBANK", "AXISBANK",
        "INDUSINDBK", "FEDERALBNK", "IDFCFIRSTB", "RBLBANK", "BANDHANBNK",
        "AUBANK", "CSBBANK", "DCBBANK", "KARURVSYA",
        # PSU Banks
        "CANBK", "PNB", "BANKBARODA", "UNIONBANK", "INDIANB",
        "MAHABANK", "UCOBANK", "CENTRALBK", "IOB", "BANKINDIA",
        "YESBANK",
    ],
    "NBFC & Finance": [
        "BAJFINANCE", "BAJAJFINSV", "CHOLAFIN", "MUTHOOTFIN", "LICHSGFIN",
        "MANAPPURAM", "SHRIRAMFIN", "SBICARD", "PNBHOUSING", "AAVAS",
        "CREDITACC", "CAPRIGLOBAL",
    ],
    "Insurance": [
        "SBILIFE", "HDFCLIFE", "ICICIPRULI", "GICRE", "NIACL",
        "LICI", "STARHEALTH", "ABCAPITAL",
    ],
    "IT & Technology": [
        "TCS", "INFY", "HCLTECH", "WIPRO", "TECHM",
        "LTIM", "MPHASIS", "COFORGE", "PERSISTENT", "OFSS",
        "KPIT", "TATAELXSI", "BSOFT", "NIIT", "MASTEK",
        "HEXAWARE", "RATEGAIN", "HAPPSTMNDS",
    ],
    "FMCG & Consumer Goods": [
        "HINDUNILVR", "ITC", "NESTLEIND", "BRITANNIA", "DABUR",
        "MARICO", "COLPAL", "GODREJCP", "EMAMILTD", "TATACONSUM",
        "VBL", "RADICO", "BIKAJI", "PGHH", "JYOTHYLAB",
    ],
    "Pharma & Healthcare": [
        "SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "LUPIN",
        "AUROPHARMA", "TORNTPHARM", "ALKEM", "IPCALAB", "ABBOTINDIA",
        "PFIZER", "GLAXO", "NATCOPHARM", "GRANULES", "SANOFI",
        "LAURUSLABS", "GLAND", "ERIS", "AJANTPHARM",
    ],
    "Auto & Mobility": [
        "MARUTI", "TATAMOTORS", "HEROMOTOCO", "EICHERMOT", "TVSMOTOR",
        "ASHOKLEY", "MOTHERSON", "BOSCHLTD", "MRF", "APOLLOTYRE",
        "TIINDIA", "EXIDEIND", "AMARAJABAT", "SUPRAJIT",
    ],
    "Energy & Oil & Gas": [
        "RELIANCE", "ONGC", "BPCL", "IOC", "HINDPETRO",
        "GAIL", "PETRONET", "MRPL", "CASTROLIND", "AEGISCHEM",
        "GULFOILLUB",
    ],
    "Power & Utilities": [
        "NTPC", "POWERGRID", "TATAPOWER", "ADANIGREEN", "ADANIENT",
        "TORNTPOWER", "CESC", "NHPC", "SJVN", "JSWENERGY",
        "RPOWER", "INDIGRID",
    ],
    "Metals & Mining": [
        "TATASTEEL", "JSWSTEEL", "HINDALCO", "VEDL", "SAIL",
        "NMDC", "COALINDIA", "MOIL", "NATIONALUM", "HINDCOPPER",
        "WELCORP", "RATNAMANI",
    ],
    "Infrastructure & Real Estate": [
        "LT", "IRFC", "ADANIPORTS", "IRB", "RVNL",
        "DLF", "GODREJPROP", "OBEROIRLTY", "PRESTIGE", "PHOENIXLTD",
        "BRIGADE", "SOBHA", "MACROTECH", "NXTDIGITAL",
    ],
    "Cement": [
        "ULTRACEMCO", "GRASIM", "AMBUJACEMENT", "ACC", "SHREECEM",
        "JKCEMENT", "RAMCOCEMENT", "DALMIA", "HEIDELBERG",
    ],
    "Telecom & Media": [
        "BHARTIARTL", "INDUSTOWER", "TTML", "HFCL",
    ],
    "Chemicals & Fertilisers": [
        "PIDILITIND", "DEEPAKNTR", "GNFC", "CHAMBLFERT", "COROMANDEL",
        "UPL", "ATUL", "VINATIORG", "NAVINFLUOR", "AARTIIND",
        "FINEORG", "CLEAN", "JUBLINGREA",
    ],
    "Capital Goods & Defence": [
        "SIEMENS", "ABB", "BHEL", "HAL", "BEL",
        "THERMAX", "CUMMINSIND", "KEC", "KALPATPOWR", "APAR",
        "COCHINSHIP", "GRINDWELL", "TIMKEN",
    ],
    "Retail & New Age": [
        "DMART", "TRENT", "ABFRL", "NYKAA", "ZOMATO",
        "PAYTM", "IRCTC", "JUBLFOOD", "DEVYANI", "SAPPHIRE",
    ],
    "Consumer Durables": [
        "ASIANPAINT", "TITAN", "HAVELLS", "VOLTAS", "GODREJIND",
        "BLUESTAR", "CROMPTON", "ORIENT", "VGUARD", "BAJAJELEC",
    ],
}

# Flat list and reverse lookup
SCREENER_UNIVERSE = [sym for syms in SECTORS.values() for sym in syms]
SECTOR_MAP        = {sym: sec for sec, syms in SECTORS.items() for sym in syms}
ALL_SECTORS       = sorted(SECTORS.keys())

def _raw(d: dict, key: str):
    v = d.get(key, {})
    return v.get("raw") if isinstance(v, dict) else v



def fetch_all_prices_batch(symbols: list[str]) -> list[dict]:
    """
    Fetch price + trend for ALL symbols using Yahoo Finance v7/spark endpoint.
    Batches 40 symbols per request — ~6 HTTP calls for 219 stocks vs 219 individual calls.
    Much more reliable: fewer connections = no rate-limiting, faster overall.
    """
    results = []
    batch_size = 40
    for i in range(0, len(symbols), batch_size):
        batch  = symbols[i : i + batch_size]
        ns_syms = ",".join(f"{s}.NS" for s in batch)
        ck = f"spark:{ns_syms[:60]}"
        now = time.time()
        if ck in _cache and now - _cache[ck][0] < 600:
            results.extend(_cache[ck][1])
            continue
        try:
            r = requests.get(
                "https://query1.finance.yahoo.com/v7/finance/spark",
                params={"symbols": ns_syms, "range": "1mo", "interval": "1d"},
                headers=YF_HEADERS, timeout=15,
            )
            r.raise_for_status()
            batch_results = []
            for item in r.json().get("spark", {}).get("result", []):
                sym_ns = item.get("symbol", "")
                sym    = sym_ns.replace(".NS", "").replace(".BO", "")
                resps  = item.get("response", [])
                if not resps:
                    continue
                resp   = resps[0]
                meta   = resp.get("meta", {})
                price  = meta.get("regularMarketPrice")
                if not price:
                    continue
                prev = meta.get("previousClose") or meta.get("chartPreviousClose")
                chg_pct = (
                    round((float(price) - float(prev)) / float(prev) * 100, 2)
                    if prev and float(prev) > 0 else None
                )
                closes = [
                    c for c in
                    resp.get("indicators", {}).get("quote", [{}])[0].get("close", [])
                    if c is not None
                ]
                sma20 = sum(closes[-20:]) / 20 if len(closes) >= 20 else None
                trend = (
                    ("bullish" if float(price) > sma20 else "bearish")
                    if sma20 else "unknown"
                )
                batch_results.append({
                    "symbol":         sym,
                    "name":           meta.get("longName") or meta.get("shortName") or sym,
                    "sector":         SECTOR_MAP.get(sym, "Other"),
                    "price":          round(float(price), 2),
                    "change_pct":     chg_pct,
                    "market_cap_cr":  None,
                    "pe":             None,
                    "revenue_growth": None,
                    "trend":          trend,
                })
            _cache[ck] = (now, batch_results)
            results.extend(batch_results)
        except Exception as e:
            print(f"[spark batch {i//batch_size + 1}] {e}")
    return results


def fetch_fundamentals_crumb(symbol: str) -> dict:
    """
    Fetch P/E + market cap using crumb-authenticated quoteSummary.
    Called only for stocks that pass Phase 1 — much smaller set.
    """
    nse = to_nse(symbol)
    ck  = f"fund4:{nse}"
    now = time.time()
    if ck in _cache and now - _cache[ck][0] < 900:
        return _cache[ck][1]
    empty = {"market_cap_cr": None, "pe": None}

    # Approach 1: v1/finance/quote (lighter)
    try:
        r = requests.get(
            "https://query1.finance.yahoo.com/v1/finance/quote",
            params={"symbols": nse, "fields": "marketCap,trailingPE"},
            headers=YF_HEADERS, timeout=8,
        )
        if r.status_code == 200:
            items = r.json().get("quoteResponse", {}).get("result", [])
            if items:
                q   = items[0]
                mkt = q.get("marketCap")
                pe  = q.get("trailingPE")
                res = {
                    "market_cap_cr": round(float(mkt) / 1e7) if mkt else None,
                    "pe":            round(float(pe), 2)      if pe  else None,
                }
                if res["market_cap_cr"] or res["pe"]:
                    _cache[ck] = (now, res)
                    return res
    except Exception as e:
        print(f"[fund-v1] {symbol}: {e}")

    # Approach 2: quoteSummary with crumb
    _ensure_yf_session()
    crumb   = _yf_session.get("crumb") or ""
    cookies = _yf_session.get("cookies", {})
    for host in ("query1", "query2"):
        try:
            url    = f"https://{host}.finance.yahoo.com/v10/finance/quoteSummary/{quote_plus(nse)}"
            params = {"modules": "summaryDetail,defaultKeyStatistics"}
            if crumb:
                params["crumb"] = crumb
            r = requests.get(url, params=params, cookies=cookies,
                             headers=YF_HEADERS, timeout=8)
            if r.status_code == 200:
                data = r.json().get("quoteSummary", {}).get("result", [{}])[0]
                sd   = data.get("summaryDetail", {})
                ks   = data.get("defaultKeyStatistics", {})
                mkt  = _raw(sd, "marketCap")
                pe   = _raw(sd, "trailingPE") or _raw(ks, "trailingPE")
                res  = {
                    "market_cap_cr": round(float(mkt) / 1e7) if mkt else None,
                    "pe":            round(float(pe), 2)      if pe  else None,
                }
                if res["market_cap_cr"] or res["pe"]:
                    _cache[ck] = (now, res)
                    return res
        except Exception as e:
            print(f"[fund-{host}] {symbol}: {e}")

    _cache[ck] = (now, empty)
    return empty



@app.get("/api/sectors")
def get_sectors():
    return {"sectors": ALL_SECTORS, "total_stocks": len(SCREENER_UNIVERSE)}


@app.get("/api/screener")
def screener(
    sector:              str   = "all",
    min_price:           float = 0,
    max_price:           float = 999999,
    min_market_cap_cr:   float = 0,
    min_pe:              float = 0,
    max_pe:              float = 9999,
    min_revenue_growth:  float = -9999,
    trend:               str   = "any",
):
    try:
        return _screener_impl(sector, min_price, max_price, min_market_cap_cr,
                              min_pe, max_pe, min_revenue_growth, trend)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Screener error: {e}")



def _screener_impl(
    sector, min_price, max_price, min_market_cap_cr,
    min_pe, max_pe, min_revenue_growth, trend,
):
    universe = SCREENER_UNIVERSE if sector == "all" else SECTORS.get(sector, [])

    # ── Batch fetch prices for the universe (6 requests for 219 stocks) ───────
    all_stocks = fetch_all_prices_batch(universe)

    # ── Phase 1 filters: price + trend ───────────────────────────────────────
    candidates = []
    for s in all_stocks:
        price = s.get("price")
        if price is None or not (float(min_price) <= price <= float(max_price)):
            continue
        if trend != "any" and s.get("trend") not in (trend, "unknown"):
            continue
        candidates.append(s)

    # ── Phase 2: fundamentals (PE + market cap) — only if filters active ─────
    need_fundamentals = min_market_cap_cr > 0 or max_pe < 9999
    if need_fundamentals and candidates:
        try:
            with ThreadPoolExecutor(max_workers=4) as ex:
                fund_map = {ex.submit(fetch_fundamentals_crumb, s["symbol"]): s
                            for s in candidates}
                for future in as_completed(fund_map, timeout=18):
                    stock = fund_map[future]
                    try:
                        fund = future.result()
                        if fund:
                            stock.update(fund)
                    except Exception:
                        pass
        except Exception as e:
            print(f"[screener] fundamentals failed: {e} — continuing without")

    # ── Apply fundamental filters (null data = include, never exclude) ────────
    results = []
    for s in candidates:
        cap = s.get("market_cap_cr")
        if min_market_cap_cr > 0 and cap is not None and cap < min_market_cap_cr:
            continue
        pe = s.get("pe")
        if pe is not None and max_pe < 9999:
            if pe < min_pe or pe > max_pe:
                continue
        rg = s.get("revenue_growth")
        if min_revenue_growth > -9999 and rg is not None and rg < min_revenue_growth:
            continue
        results.append(s)

    results.sort(key=lambda x: x.get("market_cap_cr") or x.get("price") or 0, reverse=True)
    return {
        "total":    len(results),
        "stocks":   results,
        "universe": len(universe),
        "sectors":  ALL_SECTORS,
    }



@app.get("/api/screener/debug")
def screener_debug():
    """Tests the batch spark endpoint with 4 sample stocks."""
    samples = fetch_all_prices_batch(["RELIANCE", "SBIN", "TCS", "CANBK"])
    return {
        "universe_size": len(SCREENER_UNIVERSE),
        "sector_count":  len(ALL_SECTORS),
        "batch_method":  "spark",
        "samples":       samples,
        "note": "If samples have price/change_pct/trend — screener will work!",
    }


handler = app

# ── Stock Screener ──────────────────────────────────────────────────────────────
# 170+ stocks across 15 sectors. Fetched in parallel (15 workers).
# vercel.json sets maxDuration:30. Stocks cached 15 min so re-runs are instant.

SECTORS: dict[str, list[str]] = {
    "Banking": [
        "HDFCBANK", "ICICIBANK", "SBIN", "KOTAKBANK", "AXISBANK",
        "INDUSINDBK", "FEDERALBNK", "IDFCFIRSTB", "RBLBANK", "BANDHANBNK",
        "AUBANK", "CSBBANK", "DCBBANK", "KARURVSYA",
        # PSU Banks
        "CANBK", "PNB", "BANKBARODA", "UNIONBANK", "INDIANB",
        "MAHABANK", "UCOBANK", "CENTRALBK", "IOB", "BANKINDIA",
        "YESBANK",
    ],
    "NBFC & Finance": [
        "BAJFINANCE", "BAJAJFINSV", "CHOLAFIN", "MUTHOOTFIN", "LICHSGFIN",
        "MANAPPURAM", "SHRIRAMFIN", "SBICARD", "PNBHOUSING", "AAVAS",
        "CREDITACC", "CAPRIGLOBAL",
    ],
    "Insurance": [
        "SBILIFE", "HDFCLIFE", "ICICIPRULI", "GICRE", "NIACL",
        "LICI", "STARHEALTH", "ABCAPITAL",
    ],
    "IT & Technology": [
        "TCS", "INFY", "HCLTECH", "WIPRO", "TECHM",
        "LTIM", "MPHASIS", "COFORGE", "PERSISTENT", "OFSS",
        "KPIT", "TATAELXSI", "BSOFT", "NIIT", "MASTEK",
        "HEXAWARE", "RATEGAIN", "HAPPSTMNDS",
    ],
    "FMCG & Consumer Goods": [
        "HINDUNILVR", "ITC", "NESTLEIND", "BRITANNIA", "DABUR",
        "MARICO", "COLPAL", "GODREJCP", "EMAMILTD", "TATACONSUM",
        "VBL", "RADICO", "BIKAJI", "PGHH", "JYOTHYLAB",
    ],
    "Pharma & Healthcare": [
        "SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "LUPIN",
        "AUROPHARMA", "TORNTPHARM", "ALKEM", "IPCALAB", "ABBOTINDIA",
        "PFIZER", "GLAXO", "NATCOPHARM", "GRANULES", "SANOFI",
        "LAURUSLABS", "GLAND", "ERIS", "AJANTPHARM",
    ],
    "Auto & Mobility": [
        "MARUTI", "TATAMOTORS", "HEROMOTOCO", "EICHERMOT", "TVSMOTOR",
        "ASHOKLEY", "MOTHERSON", "BOSCHLTD", "MRF", "APOLLOTYRE",
        "TIINDIA", "EXIDEIND", "AMARAJABAT", "SUPRAJIT",
    ],
    "Energy & Oil & Gas": [
        "RELIANCE", "ONGC", "BPCL", "IOC", "HINDPETRO",
        "GAIL", "PETRONET", "MRPL", "CASTROLIND", "AEGISCHEM",
        "GULFOILLUB",
    ],
    "Power & Utilities": [
        "NTPC", "POWERGRID", "TATAPOWER", "ADANIGREEN", "ADANIENT",
        "TORNTPOWER", "CESC", "NHPC", "SJVN", "JSWENERGY",
        "RPOWER", "INDIGRID",
    ],
    "Metals & Mining": [
        "TATASTEEL", "JSWSTEEL", "HINDALCO", "VEDL", "SAIL",
        "NMDC", "COALINDIA", "MOIL", "NATIONALUM", "HINDCOPPER",
        "WELCORP", "RATNAMANI",
    ],
    "Infrastructure & Real Estate": [
        "LT", "IRFC", "ADANIPORTS", "IRB", "RVNL",
        "DLF", "GODREJPROP", "OBEROIRLTY", "PRESTIGE", "PHOENIXLTD",
        "BRIGADE", "SOBHA", "MACROTECH", "NXTDIGITAL",
    ],
    "Cement": [
        "ULTRACEMCO", "GRASIM", "AMBUJACEMENT", "ACC", "SHREECEM",
        "JKCEMENT", "RAMCOCEMENT", "DALMIA", "HEIDELBERG",
    ],
    "Telecom & Media": [
        "BHARTIARTL", "INDUSTOWER", "TTML", "HFCL",
    ],
    "Chemicals & Fertilisers": [
        "PIDILITIND", "DEEPAKNTR", "GNFC", "CHAMBLFERT", "COROMANDEL",
        "UPL", "ATUL", "VINATIORG", "NAVINFLUOR", "AARTIIND",
        "FINEORG", "CLEAN", "JUBLINGREA",
    ],
    "Capital Goods & Defence": [
        "SIEMENS", "ABB", "BHEL", "HAL", "BEL",
        "THERMAX", "CUMMINSIND", "KEC", "KALPATPOWR", "APAR",
        "COCHINSHIP", "GRINDWELL", "TIMKEN",
    ],
    "Retail & New Age": [
        "DMART", "TRENT", "ABFRL", "NYKAA", "ZOMATO",
        "PAYTM", "IRCTC", "JUBLFOOD", "DEVYANI", "SAPPHIRE",
    ],
    "Consumer Durables": [
        "ASIANPAINT", "TITAN", "HAVELLS", "VOLTAS", "GODREJIND",
        "BLUESTAR", "CROMPTON", "ORIENT", "VGUARD", "BAJAJELEC",
    ],
}

# Flat list and reverse lookup
SCREENER_UNIVERSE = [sym for syms in SECTORS.values() for sym in syms]
SECTOR_MAP        = {sym: sec for sec, syms in SECTORS.items() for sym in syms}
ALL_SECTORS       = sorted(SECTORS.keys())

def _raw(d: dict, key: str):
    v = d.get(key, {})
    return v.get("raw") if isinstance(v, dict) else v

def fetch_stock_metrics(symbol: str) -> dict | None:
    """
    Fetch screening metrics for ONE stock using v10/quoteSummary.
    Cached 15 minutes — repeated screener calls with different filters are instant.
    """
    nse = to_nse(symbol)
    ck  = f"m4:{nse}"
    now = time.time()
    if ck in _cache and now - _cache[ck][0] < 900:  # 15-min cache   # 15-min cache
        return _cache[ck][1]
    try:
        url = f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{quote_plus(nse)}"
        r   = requests.get(url,
                params={"modules": "price,defaultKeyStatistics,financialData"},
                headers=YF_HEADERS, timeout=8)
        r.raise_for_status()
        res     = r.json().get("quoteSummary", {}).get("result", [{}])[0]
        pd_     = res.get("price", {})
        ks      = res.get("defaultKeyStatistics", {})
        fd      = res.get("financialData", {})

        price   = _raw(pd_, "regularMarketPrice")
        if price is None:
            return None

        mkt_cap = _raw(pd_, "marketCap")
        chg_pct = _raw(pd_, "regularMarketChangePercent")
        sma50   = _raw(pd_, "fiftyDayAverage")
        pe      = _raw(pd_, "trailingPE") or _raw(ks, "trailingPE")
        rev_g   = _raw(fd, "revenueGrowth")
        name    = pd_.get("longName") or pd_.get("shortName") or symbol

        metrics = {
            "symbol":         symbol,
            "name":           name,
            "sector":         SECTOR_MAP.get(symbol, "Other"),
            "price":          round(float(price), 2),
            "change_pct":     round(float(chg_pct), 2) if chg_pct is not None else None,
            "market_cap_cr":  round(float(mkt_cap) / 1e7) if mkt_cap else None,
            "pe":             round(float(pe), 2) if pe else None,
            "revenue_growth": round(float(rev_g) * 100, 1) if rev_g is not None else None,
            "trend":          ("bullish" if float(price) > float(sma50)
                               else "bearish") if sma50 else "unknown",
        }
        _cache[ck] = (now, metrics)
        return metrics
    except Exception as e:
        print(f"[screener] {symbol}: {e}")
        return None


@app.get("/api/sectors")
def get_sectors():
    return {"sectors": ALL_SECTORS, "total_stocks": len(SCREENER_UNIVERSE)}


@app.get("/api/screener")
def screener(
    sector:              str   = "all",
    min_price:           float = 0,
    max_price:           float = 999999,
    min_market_cap_cr:   float = 0,
    min_pe:              float = 0,
    max_pe:              float = 9999,
    min_revenue_growth:  float = -9999,
    trend:               str   = "any",
):
    try:
        return _screener_impl(sector, min_price, max_price, min_market_cap_cr,
                              min_pe, max_pe, min_revenue_growth, trend)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Screener error: {e}")


def _screener_impl(
    sector, min_price, max_price, min_market_cap_cr,
    min_pe, max_pe, min_revenue_growth, trend,
):
    # When a sector is picked fetch only that sector (fast).
    # When "all" fetch entire universe in parallel (15 workers, 25s timeout).
    universe = (
        SCREENER_UNIVERSE if sector == "all"
        else SECTORS.get(sector, [])
    )

    all_metrics: list[dict] = []
    workers = 15 if len(universe) > 30 else 8
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {ex.submit(fetch_stock_metrics, sym): sym for sym in universe}
        for future in as_completed(futures, timeout=25):
            try:
                m = future.result()
                if m:
                    all_metrics.append(m)
            except Exception:
                pass

    # ── Filters ───────────────────────────────────────────────────────────────
    # Key rule: if a stock is MISSING a data field (P/E, revenue growth),
    # we INCLUDE it rather than exclude — Yahoo Finance doesn't always return
    # every field for every stock (common for PSU banks, newer listings, etc.)
    # The user sees "—" in that column and can decide themselves.
    results = []
    for s in all_metrics:
        price = s.get("price")
        if price is None or not (min_price <= price <= max_price):
            continue

        # Market cap — only exclude if we HAVE the data and it fails
        cap = s.get("market_cap_cr")
        if min_market_cap_cr > 0 and cap is not None and cap < min_market_cap_cr:
            continue

        # P/E — only filter if BOTH: user set a real max AND we have P/E data
        pe = s.get("pe")
        if pe is not None and max_pe < 9999:
            if pe < min_pe or pe > max_pe:
                continue

        # Revenue growth — only exclude if we HAVE the data and it fails
        # Stocks with missing revenue data are included (shown as "—")
        rg = s.get("revenue_growth")
        if min_revenue_growth > -9999 and rg is not None and rg < min_revenue_growth:
            continue

        # Trend — exclude only if we have SMA data and it clearly fails
        if trend != "any" and s.get("trend") not in (trend, "unknown"):
            continue

        results.append(s)

    results.sort(key=lambda x: x.get("market_cap_cr") or 0, reverse=True)
    return {
        "total":    len(results),
        "stocks":   results,
        "universe": len(universe),
        "sectors":  ALL_SECTORS,
    }


@app.get("/api/screener/debug")
def screener_debug():
    """Quick debug — returns universe size and a sample fetch for RELIANCE."""
    sample = fetch_stock_metrics("RELIANCE")
    return {
        "universe_size": len(SCREENER_UNIVERSE),
        "sector_count":  len(ALL_SECTORS),
        "sectors":       ALL_SECTORS,
        "sample_stock":  sample,
    }
