import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from services import stock_data, technical, news, ai_service

app = FastAPI(title="Disha - AI Stock Decision API", version="1.0.0")

frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

POPULAR_SYMBOLS = [
    {"symbol": "RELIANCE", "name": "Reliance Industries"},
    {"symbol": "TCS", "name": "Tata Consultancy Services"},
    {"symbol": "INFY", "name": "Infosys"},
    {"symbol": "HDFCBANK", "name": "HDFC Bank"},
    {"symbol": "ICICIBANK", "name": "ICICI Bank"},
    {"symbol": "SBIN", "name": "State Bank of India"},
    {"symbol": "TATAMOTORS", "name": "Tata Motors"},
    {"symbol": "ITC", "name": "ITC Limited"},
    {"symbol": "WIPRO", "name": "Wipro"},
    {"symbol": "ADANIENT", "name": "Adani Enterprises"},
    {"symbol": "BAJFINANCE", "name": "Bajaj Finance"},
    {"symbol": "MARUTI", "name": "Maruti Suzuki"},
    {"symbol": "HINDUNILVR", "name": "Hindustan Unilever"},
    {"symbol": "KOTAKBANK", "name": "Kotak Mahindra Bank"},
    {"symbol": "LT", "name": "Larsen & Toubro"},
]


@app.get("/api/health")
def health():
    has_key = bool(os.getenv("GEMINI_API_KEY")) and os.getenv("GEMINI_API_KEY") != "your_gemini_api_key_here"
    return {"status": "ok", "ai_enabled": has_key}


@app.get("/api/symbols")
def symbols():
    return POPULAR_SYMBOLS


@app.get("/api/analyze/{symbol}")
def analyze(symbol: str, days: int = 30):
    symbol = symbol.strip().upper().replace(".NS", "").replace(".BO", "")
    try:
        daily_df = stock_data.get_daily_history(symbol, days=days)
        if daily_df.empty:
            raise HTTPException(status_code=404, detail=f"No data found for symbol '{symbol}'. Check the NSE symbol and try again.")

        company_name = stock_data.get_company_name(symbol)
        quote = stock_data.get_quote(symbol)
        stats = technical.basic_stats(daily_df)
        series = technical.price_series(daily_df)
        tech_signal = technical.technical_signal(daily_df)

        try:
            intraday_df = stock_data.get_intraday_history(symbol, days=days)
            timing = technical.timing_pattern(intraday_df)
        except Exception as e:
            print(f"[main] intraday fetch failed for {symbol}: {e}")
            timing = {"available": False, "grid": [], "best_buy": None, "best_sell": None}

        try:
            news_items = news.fetch_news(company_name)
        except Exception as e:
            print(f"[main] news fetch failed for {symbol}: {e}")
            news_items = []

        sentiment = ai_service.analyze_news_sentiment(company_name, [n["title"] for n in news_items])
        call = ai_service.generate_call(symbol, company_name, stats, tech_signal, timing, sentiment)

        # Merge sentiment per-headline back with links/sources for the frontend
        merged_news = []
        per_headline = {ph["headline"]: ph for ph in sentiment.get("per_headline", [])}
        for item in news_items:
            ph = per_headline.get(item["title"], {})
            merged_news.append({
                **item,
                "sentiment": ph.get("sentiment", "unknown"),
                "reason": ph.get("reason", ""),
            })

        return {
            "symbol": symbol,
            "nse_symbol": f"{symbol}.NS",
            "company_name": company_name,
            "quote": quote,
            "stats": stats,
            "price_series": series,
            "technical": tech_signal,
            "timing": timing,
            "news": merged_news,
            "sentiment": {k: v for k, v in sentiment.items() if k != "per_headline"},
            "call": call,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze '{symbol}': {e}")
