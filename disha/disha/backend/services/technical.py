"""
Pure-numeric technical analysis on price history.
No external calls here - everything is computed locally from the
OHLCV data fetched via stock_data.py.
"""
import numpy as np
import pandas as pd


def basic_stats(daily_df: pd.DataFrame) -> dict:
    closes = daily_df["Close"].dropna()
    if closes.empty:
        return {}
    first, last = closes.iloc[0], closes.iloc[-1]
    return {
        "min": round(float(closes.min()), 2),
        "max": round(float(closes.max()), 2),
        "average": round(float(closes.mean()), 2),
        "std_dev": round(float(closes.std()), 2),
        "period_start_price": round(float(first), 2),
        "period_end_price": round(float(last), 2),
        "period_change_pct": round(float((last - first) / first * 100), 2),
        "num_trading_days": int(len(closes)),
    }


def price_series(daily_df: pd.DataFrame) -> list[dict]:
    out = []
    for idx, row in daily_df.iterrows():
        out.append({
            "date": idx.strftime("%Y-%m-%d"),
            "close": round(float(row["Close"]), 2),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
        })
    return out


def _rsi(closes: pd.Series, period: int = 14) -> float | None:
    if len(closes) < period + 1:
        return None
    delta = closes.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.rolling(period).mean()
    avg_loss = loss.rolling(period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    val = rsi.iloc[-1]
    return round(float(val), 2) if pd.notna(val) else None


def technical_signal(daily_df: pd.DataFrame) -> dict:
    closes = daily_df["Close"].dropna()
    reasons = []
    score = 0  # -2..+2, negative = bearish, positive = bullish

    sma_short = closes.rolling(5).mean().iloc[-1] if len(closes) >= 5 else None
    sma_long = closes.rolling(20).mean().iloc[-1] if len(closes) >= 20 else None
    last = closes.iloc[-1]

    if sma_short is not None and sma_long is not None and pd.notna(sma_short) and pd.notna(sma_long):
        if sma_short > sma_long:
            score += 1
            reasons.append("5-day average is above the 20-day average (short-term uptrend).")
        else:
            score -= 1
            reasons.append("5-day average is below the 20-day average (short-term downtrend).")

    rsi = _rsi(closes)
    if rsi is not None:
        if rsi >= 70:
            score -= 1
            reasons.append(f"RSI is {rsi} - overbought territory, pullback risk.")
        elif rsi <= 30:
            score += 1
            reasons.append(f"RSI is {rsi} - oversold territory, bounce potential.")
        else:
            reasons.append(f"RSI is {rsi} - neutral momentum.")

    if sma_long is not None and pd.notna(sma_long):
        if last > sma_long:
            score += 0.5
        else:
            score -= 0.5

    if score >= 1:
        label = "bullish"
    elif score <= -1:
        label = "bearish"
    else:
        label = "neutral"

    return {
        "label": label,
        "score": round(float(score), 2),
        "rsi_14": rsi,
        "sma_5": round(float(sma_short), 2) if sma_short is not None and pd.notna(sma_short) else None,
        "sma_20": round(float(sma_long), 2) if sma_long is not None and pd.notna(sma_long) else None,
        "reasons": reasons,
    }


SESSION_BUCKETS = [
    ("Morning (9:15-11:00)", 9, 11),
    ("Midday (11:00-13:00)", 11, 13),
    ("Afternoon (13:00-15:30)", 13, 16),
]


def timing_pattern(intraday_df: pd.DataFrame) -> dict:
    """
    Looks at historical intraday prices over the lookback window and finds
    which weekday + session historically traded relatively lower (better buy
    window) and relatively higher (better sell window).

    IMPORTANT: this is a backward-looking statistical pattern over a short
    window, not a prediction. Patterns like this are noisy and can flip.
    """
    if intraday_df.empty or "Close" not in intraday_df:
        return {"available": False, "grid": [], "best_buy": None, "best_sell": None}

    df = intraday_df.copy()
    df = df.dropna(subset=["Close"])
    df["weekday"] = df.index.day_name()
    df["hour"] = df.index.hour

    # Normalize each day's prices around that day's own mean so we're comparing
    # *relative* intraday position, not absolute price drift over the month.
    df["day_key"] = df.index.date
    day_means = df.groupby("day_key")["Close"].transform("mean")
    df["rel"] = (df["Close"] - day_means) / day_means * 100  # % vs that day's mean

    def session_for_hour(h):
        for label, start, end in SESSION_BUCKETS:
            if start <= h < end:
                return label
        return None

    df["session"] = df["hour"].apply(session_for_hour)
    df = df.dropna(subset=["session"])

    weekday_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    grid = []
    for wd in weekday_order:
        for label, _, _ in SESSION_BUCKETS:
            subset = df[(df["weekday"] == wd) & (df["session"] == label)]
            if len(subset) >= 2:
                grid.append({
                    "weekday": wd,
                    "session": label,
                    "avg_rel_pct": round(float(subset["rel"].mean()), 3),
                    "sample_size": int(len(subset)),
                })

    if not grid:
        return {"available": False, "grid": [], "best_buy": None, "best_sell": None}

    best_buy = min(grid, key=lambda r: r["avg_rel_pct"])
    best_sell = max(grid, key=lambda r: r["avg_rel_pct"])

    return {
        "available": True,
        "grid": grid,
        "best_buy": best_buy,
        "best_sell": best_sell,
        "lookback_days": int(len(df["day_key"].unique())),
    }
