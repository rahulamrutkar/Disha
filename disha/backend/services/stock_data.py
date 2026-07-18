"""
Fetches price data for NSE (India) listed stocks using yfinance.
yfinance is a free wrapper around Yahoo Finance's public endpoints - no API key needed.
For NSE stocks we append ".NS" to the symbol (e.g. RELIANCE -> RELIANCE.NS).
"""
import yfinance as yf
import pandas as pd
from functools import lru_cache
import time

# Simple in-memory cache so repeated demo requests don't hammer Yahoo Finance.
_cache: dict[str, tuple[float, object]] = {}
CACHE_TTL_SECONDS = 120


def _cached(key: str, builder):
    now = time.time()
    if key in _cache:
        ts, value = _cache[key]
        if now - ts < CACHE_TTL_SECONDS:
            return value
    value = builder()
    _cache[key] = (now, value)
    return value


def to_nse_symbol(symbol: str) -> str:
    symbol = symbol.strip().upper()
    if not symbol.endswith(".NS") and not symbol.endswith(".BO"):
        symbol = f"{symbol}.NS"
    return symbol


def get_company_name(symbol: str) -> str:
    nse_symbol = to_nse_symbol(symbol)

    def build():
        try:
            info = yf.Ticker(nse_symbol).get_info()
            return info.get("longName") or info.get("shortName") or symbol.replace(".NS", "")
        except Exception:
            return symbol.replace(".NS", "")

    return _cached(f"name:{nse_symbol}", build)


def get_daily_history(symbol: str, days: int = 30) -> pd.DataFrame:
    """Daily OHLCV for the last ~`days` calendar days."""
    nse_symbol = to_nse_symbol(symbol)

    def build():
        period = "3mo" if days <= 60 else "6mo"
        df = yf.download(nse_symbol, period=period, interval="1d", auto_adjust=True, progress=False)
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        return df.tail(days)

    return _cached(f"daily:{nse_symbol}:{days}", build)


def get_intraday_history(symbol: str, days: int = 30) -> pd.DataFrame:
    """
    Hourly OHLCV for the last ~`days` days, used to figure out which
    day-of-week / time-of-day historically saw lower or higher prices.
    Yahoo allows 60m interval data for up to ~2 years, so 30 days is safe.
    """
    nse_symbol = to_nse_symbol(symbol)

    def build():
        period = f"{min(days, 59)}d"
        df = yf.download(nse_symbol, period=period, interval="60m", auto_adjust=True, progress=False)
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        return df

    return _cached(f"intraday:{nse_symbol}:{days}", build)


def get_quote(symbol: str) -> dict:
    nse_symbol = to_nse_symbol(symbol)

    def build():
        t = yf.Ticker(nse_symbol)
        fi = t.fast_info
        last = fi.get("lastPrice")
        prev_close = fi.get("previousClose")
        change = None
        change_pct = None
        if last is not None and prev_close:
            change = last - prev_close
            change_pct = (change / prev_close) * 100
        return {
            "price": round(float(last), 2) if last is not None else None,
            "previous_close": round(float(prev_close), 2) if prev_close else None,
            "change": round(float(change), 2) if change is not None else None,
            "change_pct": round(float(change_pct), 2) if change_pct is not None else None,
            "currency": fi.get("currency", "INR"),
        }

    return _cached(f"quote:{nse_symbol}", build)
