# Disha — AI-assisted stock direction for NSE shares

A full-stack demo app for Indian (NSE) stocks. Type a symbol and get:

1. **30-day price stats** — min, max, average, volatility, period change, plus a chart.
2. **Ticker Rhythm** — a heatmap of which weekday + time-of-day session has historically traded
   relatively cheaper or pricier over the last ~30 trading days (statistical pattern, not a prediction).
3. **News + AI sentiment** — recent headlines about the company, with an AI read on overall sentiment
   and any major deals/events that could move the price.
4. **A BUY / SELL / HOLD call** — an AI-generated narrative that combines the technical signal (moving
   averages + RSI) with the news sentiment into a plain-English rationale and confidence score.

Every data source below is **free** and usable on its own outside this app — handy if you want the same
calls for a separate demo, notebook, or script.

| Need | Service | Cost | Key required? |
|---|---|---|---|
| NSE price history (daily + hourly) | Yahoo Finance via [`yfinance`](https://pypi.org/project/yfinance/) | Free | No |
| Company news | Google News RSS (`news.google.com/rss/search`) | Free | No |
| Sentiment analysis + buy/sell narrative | [Google Gemini API](https://aistudio.google.com/apikey) (`gemini-2.5-flash`) | Free tier | Yes (free, no card) |

> The app still runs end-to-end without a Gemini key — it falls back to a simple rule-based
> call and shows raw headlines without AI sentiment. Add the key to unlock the AI layer.

## Architecture

```
frontend/  React + Vite + Tailwind — UI, charts, the Ticker Rhythm heatmap
backend/   FastAPI — fetches price/news data, calls Gemini, returns one combined JSON payload
```

```
Browser ──> React app ──> FastAPI (/api/analyze/{symbol}) ──┬──> yfinance (Yahoo Finance)
                                                              ├──> Google News RSS
                                                              └──> Gemini API (sentiment + call)
```

## 1. Get a free Gemini API key

1. Go to **https://aistudio.google.com/apikey**.
2. Sign in with a Google account, click **Create API key**. No credit card needed.
3. Copy the key — you'll paste it into `backend/.env` below.

Free tier covers `gemini-2.5-flash` / `gemini-2.5-flash-lite` with a modest requests-per-minute limit —
plenty for a demo, but if you hammer it quickly you may see occasional 429s (the app retries gracefully
and falls back to the rule-based call if Gemini is unavailable).

You can reuse this same key outside the app, e.g.:

```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Say hello in one sentence."}]}]}'
```

## 2. Run the backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# edit .env and paste your GEMINI_API_KEY
uvicorn main:app --reload --port 8000
```

Check it's alive: `curl http://localhost:8000/api/health` → `{"status":"ok","ai_enabled":true}`

Try it directly (this is the same free yfinance + Google News + Gemini pipeline, callable on its own):

```bash
curl http://localhost:8000/api/analyze/RELIANCE
```

## 3. Run the frontend

```bash
cd frontend
npm install
cp .env.example .env   # default already points at http://localhost:8000
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`).

## 4. Deploy for real

**Backend (FastAPI)** — any container/Python host works; free-tier-friendly options:
- [Render](https://render.com) — New → Web Service → point at `backend/`, build `pip install -r requirements.txt`, start `uvicorn main:app --host 0.0.0.0 --port $PORT`. Add `GEMINI_API_KEY` and `FRONTEND_ORIGIN` (your deployed frontend URL) as environment variables.
- [Railway](https://railway.app) — similar flow, auto-detects Python.

**Frontend (React/Vite)**
- [Vercel](https://vercel.com) or [Netlify](https://netlify.com) — import the repo, set root to `frontend/`, build command `npm run build`, output `dist`. Add `VITE_API_BASE_URL` pointing at your deployed backend URL.

Once both are deployed, update `FRONTEND_ORIGIN` on the backend to your live frontend URL so CORS allows it.

## Notes, limits, and honesty about what this is

- **This is an educational tool, not financial advice.** The BUY/SELL/HOLD call and the Ticker Rhythm
  pattern are both derived from public historical data over a short window — they describe the past, not
  guarantee the future. Treat them as one input, not an instruction. The app says this on-screen too.
- `yfinance` is a free, widely-used wrapper around Yahoo Finance's public endpoints. It's reliable for
  demos but isn't an official, SLA-backed data feed — don't wire real money through it unmonitored.
- Hourly intraday data from Yahoo only goes back so far, so the Ticker Rhythm pattern is based on roughly
  the last 30–59 trading days, not years of data — small sample sizes mean it can be noisy.
- Google News RSS has no key and no hard rate limit, but it's also not an official news API — if you
  outgrow it, [NewsAPI.org](https://newsapi.org) or [GNews](https://gnews.io) both have free tiers.

## Ideas to extend

- Swap the symbol search box for a real autocomplete against NSE's full symbol list.
- Add a watchlist (the storage pattern in `frontend/src/api.js` is easy to extend with a small DB).
- Add candlestick charts and a longer lookback toggle (90d/180d).
- Backtest the Ticker Rhythm pattern over a longer window before trusting it more.
