from fastapi import FastAPI, Query, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone
import requests
import os

app = FastAPI(title="Crypto OHLCV API", version="1.2")

# ---------------------------------------------------------------------
# Authentication setup
# ---------------------------------------------------------------------
security = HTTPBearer()
API_KEY = os.getenv("API_KEY", "crypto-ohlcv-secret-key-2024")  # Default key for testing

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify the bearer token"""
    if credentials.credentials != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return credentials.credentials

# ---------------------------------------------------------------------
# CORS setup
# ---------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------
COINGECKO_BASE = "https://api.coingecko.com/api/v3"
TIMEOUT = 10

SYMBOL_MAP = {
    "btc": "bitcoin",
    "eth": "ethereum",
    "sol": "solana",
    "avax": "avalanche-2",
    "doge": "dogecoin",
    "matic": "matic-network",
    "ada": "cardano",
    "bnb": "binancecoin",
    "dot": "polkadot",
    "ltc": "litecoin",
    "xrp": "ripple",
}

TIMEFRAME_MAP = {
    "1d": 1,
    "7d": 7,
    "14d": 14,
    "30d": 30,
    "90d": 90,
    "180d": 180,
    "365d": 365,
    "max": "max",
}

# ---------------------------------------------------------------------
# Fetcher
# ---------------------------------------------------------------------
def fetch_ohlc(coin_id: str, vs_currency: str = "usd", days: str = "1"):
    """Fetch OHLC data from CoinGecko."""
    url = f"{COINGECKO_BASE}/coins/{coin_id}/ohlc"
    params = {"vs_currency": vs_currency, "days": days}
    r = requests.get(url, params=params, timeout=TIMEOUT)
    if r.status_code == 404:
        return None
    r.raise_for_status()
    return r.json()

# ---------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------
@app.get("/health")
def health_check():
    """Health check endpoint (no authentication required)"""
    return {
        "status": "healthy",
        "service": "Crypto OHLCV API",
        "version": "1.2",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.get("/ohlcv")
def get_ohlcv(
    symbol: str = Query(..., description="Symbol or CoinGecko ID (e.g. btc, eth, sol, bitcoin, ethereum)"),
    timeframe: str = Query("1d", description="1d, 7d, 14d, 30d, 90d, 180d, 365d, max"),
    vs_currency: str = Query("usd", description="Quote currency (usd, eur, etc.)"),
    token: str = Depends(verify_token)
):
    symbol_lower = symbol.lower()
    coin_id = SYMBOL_MAP.get(symbol_lower, symbol_lower)
    days = TIMEFRAME_MAP.get(timeframe.lower(), 1)

    data = fetch_ohlc(coin_id, vs_currency, days)
    if not data:
        # Suggest similar matches
        suggestions = [k for k in SYMBOL_MAP.keys() if k.startswith(symbol_lower[:2])]
        return {
            "error": f"Symbol '{symbol}' not found on CoinGecko.",
            "try_instead": suggestions or list(SYMBOL_MAP.keys())[:5],
            "hint": "Use CoinGecko coin IDs or known symbols like btc, eth, sol, etc.",
        }

    # CoinGecko returns: [timestamp, open, high, low, close]
    ohlcv = [
        {
            "timestamp": datetime.utcfromtimestamp(row[0] / 1000).isoformat(),
            "open": row[1],
            "high": row[2],
            "low": row[3],
            "close": row[4],
        }
        for row in data
    ]

    return {
        "symbol": symbol_lower,
        "coin_id": coin_id,
        "vs_currency": vs_currency.lower(),
        "timeframe": timeframe.lower(),
        "count": len(ohlcv),
        "ohlcv": ohlcv,
        "source": "CoinGecko",
        "fetched_at": datetime.now(timezone.utc).isoformat()
    }
