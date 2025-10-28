#!/usr/bin/env python3
"""
SIP Agent (Python)
- Pays for priced token data via your existing x402 merchant (no changes needed)
- Computes simple triggers (RSI + zscore-on-EMA20 + MACD turn-up)
- Calls your Runner to perform the buy when triggers fire (or when NEAR_DEADLINE=1)

Assumptions (adjust URLs to your services):
- Data Agent exposes a priced endpoint:   GET {DATA_AGENT_URL}/token-data?symbol=SOL&tf=5m&limit=500
  • On first call it responds 402 with X-402-* headers (including X-402-Invoice and X-402-PayTo)
- Runner exposes:
  • POST {RUNNER_URL}/pay/usdc   -> { txid: "..." }           (used to pay merchant invoice)
  • POST {RUNNER_URL}/swap       -> { txSig: "...", price: ... } (used to buy token)
"""

import os
import time
import math
import json
from typing import Any, Dict, List, Optional, Tuple

import httpx

# ─────────────────────────────────────────────────────────────────────────────
# 1) ENV KNOBS (Edit here / set with container env)
# ─────────────────────────────────────────────────────────────────────────────
MERCHANT_URL     = os.getenv("X402_MERCHANT_URL", "http://localhost:7003")
DATA_AGENT_URL   = os.getenv("DATA_AGENT_URL",   "http://localhost:7200")
RUNNER_URL       = os.getenv("RUNNER_URL",       "http://localhost:7100")

USDC_MINT        = os.getenv("USDC_MINT", "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU")  # 6 decimals
HTTP_TIMEOUT     = float(os.getenv("HTTP_TIMEOUT", "15"))

SYMBOLS_CSV      = os.getenv("SYMBOLS", "BTC,ETH,SOL")
BUDGET_USDC      = float(os.getenv("BUDGET_USDC", "100"))
MAX_SLIPPAGE_BPS = int(os.getenv("MAX_SLIPPAGE_BPS", "30"))
# If you are running this on a schedule and it’s near the end of the weekly window, set NEAR_DEADLINE=1
NEAR_DEADLINE    = os.getenv("NEAR_DEADLINE", "0") == "1"

# Indicator params
RSI_LEN          = int(os.getenv("RSI_LEN", "14"))
EMA_SHORT        = int(os.getenv("EMA_SHORT", "20"))
EMA_MED          = int(os.getenv("EMA_MED", "50"))
EMA_LONG         = int(os.getenv("EMA_LONG", "200"))
MACD_FAST        = int(os.getenv("MACD_FAST", "12"))
MACD_SLOW        = int(os.getenv("MACD_SLOW", "26"))
MACD_SIG         = int(os.getenv("MACD_SIG",  "9"))
ZSCORE_LEN       = int(os.getenv("ZSCORE_LEN","20"))

# Rule triggers
RSI_BUY_BELOW            = float(os.getenv("RSI_BUY_BELOW", "44"))
MAX_ZSCORE_BELOW_EMA20   = float(os.getenv("MAX_ZSCORE_BELOW_EMA20", "-0.5"))
REQUIRE_UPTREND_MA       = os.getenv("REQUIRE_UPTREND_MA", "1") == "1"

# ─────────────────────────────────────────────────────────────────────────────
# 2) Small helpers: 402 handling, indicators, runner calls
# ─────────────────────────────────────────────────────────────────────────────

def _parse_402(headers: httpx.Headers) -> Optional[Dict[str, Any]]:
    g = headers.get
    price   = g("X-402-Price")
    curr    = g("X-402-Currency")
    payto   = g("X-402-PayTo")
    invoice = g("X-402-Invoice")
    # Nonce is optional in your merchant
    if price and curr and payto and invoice:
        try:
            return {
                "price_usd": float(price),
                "currency": curr,
                "payto": payto,
                "invoice": invoice,
            }
        except ValueError:
            return None
    return None

def _pay_usdc_via_runner(payto_owner: str, ui_amount: float) -> str:
    """Call your Runner to pay USDC to the merchant's token account owner.
       Expects Runner endpoint to return {"txid": "..."}.
    """
    raw = int(round(ui_amount * 1_000_000))  # 6 decimals
    with httpx.Client(timeout=HTTP_TIMEOUT) as c:
        r = c.post(
            f"{RUNNER_URL}/pay/usdc",
            json={"to_owner": payto_owner, "mint": USDC_MINT, "amount_raw": raw},
        )
        r.raise_for_status()
        txid = r.json().get("txid")
        if not txid:
            raise RuntimeError(f"Runner /pay/usdc returned no txid: {r.text}")
        return txid

def _verify_with_merchant(invoice: str, txid: str, ui_amount: float) -> None:
    """Tell your merchant to verify the on-chain USDC payment for the invoice."""
    raw = int(round(ui_amount * 1_000_000))
    body = {
        "invoice": invoice,
        "proof": {
            "chain": "solana",
            "txid": txid,
            "mint": USDC_MINT,
            "amount": raw,
        },
    }
    with httpx.Client(timeout=HTTP_TIMEOUT) as c:
        v = c.post(f"{MERCHANT_URL}/verify", json=body)
        if v.status_code != 200 or not v.json().get("ok"):
            raise RuntimeError(f"verify failed: {v.text}")

def request_with_x402(method: str, url: str, **kwargs) -> httpx.Response:
    """Perform a priced request against the Data Agent:
       1) initial request → expect 402 + X-402-* headers
       2) pay via Runner
       3) verify with Merchant
       4) replay request with correlation headers (no receipt needed)
    """
    with httpx.Client(timeout=HTTP_TIMEOUT) as c:
        r1 = c.request(method, url, **kwargs)
        info = _parse_402(r1.headers) if r1.status_code == 402 else None
        if not info:
            return r1

        txid = _pay_usdc_via_runner(info["payto"], info["price_usd"])
        _verify_with_merchant(info["invoice"], txid, info["price_usd"])

        headers = kwargs.pop("headers", {}) or {}
        headers.update({
            "X-402-Invoice": info["invoice"],
            "X-402-Verified-Tx": txid,
            "X-402-Currency": info["currency"],
        })
        r2 = c.request(method, url, headers=headers, **kwargs)
        return r2

# ---- Indicators (pure-python; no numpy dep) ----
def ema(series: List[float], length: int) -> List[float]:
    out: List[float] = [float("nan")] * len(series)
    if not series:
        return out
    k = 2 / (length + 1)
    prev = series[0]
    for i, v in enumerate(series):
        prev = v if i == 0 else prev + k * (v - prev)
        out[i] = prev
    return out

def rsi(series: List[float], length: int = 14) -> List[float]:
    out: List[float] = [float("nan")] * len(series)
    if len(series) < 2:
        return out
    avg_gain = 0.0
    avg_loss = 0.0
    for i in range(1, len(series)):
        diff = series[i] - series[i - 1]
        gain = max(diff, 0.0)
        loss = max(-diff, 0.0)
        if i <= length:
            avg_gain += gain
            avg_loss += loss
            if i == length:
                avg_gain /= length
                avg_loss /= length
                rs = (avg_gain / avg_loss) if avg_loss != 0 else 100.0
                out[i] = 100 - 100 / (1 + rs)
        else:
            avg_gain = (avg_gain * (length - 1) + gain) / length
            avg_loss = (avg_loss * (length - 1) + loss) / length
            rs = (avg_gain / avg_loss) if avg_loss != 0 else 100.0
            out[i] = 100 - 100 / (1 + rs)
    return out

def macd(series: List[float], fast: int = 12, slow: int = 26, sig: int = 9) -> Tuple[List[float], List[float], List[float]]:
    e_fast = ema(series, fast)
    e_slow = ema(series, slow)
    macd_line = [(e_fast[i] - e_slow[i]) if not (math.isnan(e_fast[i]) or math.isnan(e_slow[i])) else float("nan") for i in range(len(series))]
    signal = ema([x if not math.isnan(x) else 0.0 for x in macd_line], sig)
    hist = [(macd_line[i] - signal[i]) if not (math.isnan(macd_line[i]) or math.isnan(signal[i])) else float("nan") for i in range(len(series))]
    return macd_line, signal, hist

def zscore_of_residual_to_ema(series: List[float], ema_len: int = 20, win: int = 20) -> List[float]:
    e = ema(series, ema_len)
    out: List[float] = [float("nan")] * len(series)
    for i in range(len(series)):
        if i < win - 1 or math.isnan(e[i]):
            continue
        window = []
        for k in range(i - win + 1, i + 1):
            if math.isnan(e[k]):
                window = []
                break
            window.append(series[k] - e[k])
        if len(window) != win:
            continue
        mu = sum(window) / win
        var = sum((x - mu) ** 2 for x in window) / win
        sd = math.sqrt(max(var, 1e-12))
        out[i] = (series[i] - e[i] - mu) / (sd if sd > 0 else 1.0)
    return out

# ---- Runner call to swap ----
def call_runner_swap(symbol: str, amount_usdc: float, max_slippage_bps: int) -> Dict[str, Any]:
    with httpx.Client(timeout=HTTP_TIMEOUT) as c:
        r = c.post(
            f"{RUNNER_URL}/swap",
            json={"asset": symbol, "amount_usdc": amount_usdc, "max_slippage_bps": max_slippage_bps},
        )
        r.raise_for_status()
        return r.json()

# ─────────────────────────────────────────────────────────────────────────────
# 3) Core logic
# ─────────────────────────────────────────────────────────────────────────────

def fetch_candles_priced(symbol: str, tf: str = "5m", limit: int = 500) -> List[Dict[str, Any]]:
    """Fetch candles from Data Agent (priced with x402). Expects list of {t,o,h,l,c,v} or {candles:[...]}."""
    url = f"{DATA_AGENT_URL}/token-data?symbol={symbol}&tf={tf}&limit={limit}"
    resp = request_with_x402("GET", url)
    resp.raise_for_status()
    data = resp.json()
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and "candles" in data:
        return data["candles"]
    raise RuntimeError("Unexpected token-data response shape; expected list or {candles:[...]}. Got: " + json.dumps(data)[:200])

def latest_triggers(candles: List[Dict[str, Any]]) -> Dict[str, Any]:
    close = [float(c["c"]) for c in candles]
    ema20 = ema(close, EMA_SHORT)
    ema50 = ema(close, EMA_MED)
    ema200 = ema(close, EMA_LONG)
    r = rsi(close, RSI_LEN)
    _, _, hist = macd(close, MACD_FAST, MACD_SLOW, MACD_SIG)
    z20 = zscore_of_residual_to_ema(close, EMA_SHORT, ZSCORE_LEN)

    i = len(close) - 1
    price = close[i]
    vals = {
        "price": price,
        "ema20": ema20[i],
        "ema50": ema50[i],
        "ema200": ema200[i],
        "rsi": r[i],
        "macdHist": hist[i],
        "z20": z20[i],
    }

    uptrend_ok = (not REQUIRE_UPTREND_MA) or (price > ema50[i] and ema50[i] > ema200[i])
    green_dip = (r[i] <= RSI_BUY_BELOW) and (z20[i] <= MAX_ZSCORE_BELOW_EMA20) and uptrend_ok
    turn_up = ((not math.isnan(hist[i-1]) and not math.isnan(hist[i]) and hist[i-1] < 0 <= hist[i]) or
               (close[i-1] < ema20[i-1] <= close[i]))

    return {
        "ind": vals,
        "flags": {
            "uptrend_ok": uptrend_ok,
            "green_dip": green_dip,
            "turn_up": turn_up
        }
    }

def decide_and_buy(symbol: str, per_asset_budget: float) -> Optional[Dict[str, Any]]:
    candles = fetch_candles_priced(symbol, "5m", 500)
    tri = latest_triggers(candles)
    flags = tri["flags"]

    do_buy = flags["green_dip"] or (flags["turn_up"] and flags["uptrend_ok"]) or NEAR_DEADLINE
    if not do_buy or per_asset_budget <= 0:
        return None

    # Execute buy via Runner
    res = call_runner_swap(symbol, per_asset_budget, MAX_SLIPPAGE_BPS)
    # Expected shape: { txSig: "...", price: ... } (adjust to your runner response)
    return {
        "asset": symbol,
        "amount_usdc": per_asset_budget,
        "txSig": res.get("txSig"),
        "price": res.get("price"),
        "indicators": tri["ind"],
        "reason": (
            "fallback_deadline" if NEAR_DEADLINE and not (flags["green_dip"] or flags["turn_up"])
            else "green_dip" if flags["green_dip"]
            else "turn_up"
        )
    }

def main() -> None:
    symbols = [s.strip().upper() for s in SYMBOLS_CSV.split(",") if s.strip()]
    if not symbols:
        raise SystemExit("No symbols configured in SYMBOLS env")
    per_asset = BUDGET_USDC / len(symbols)

    results = []
    for sym in symbols:
        try:
            out = decide_and_buy(sym, per_asset)
            if out:
                results.append(out)
        except Exception as e:
            # Log and continue to next asset
            results.append({"asset": sym, "error": str(e)})

    print(json.dumps({"ok": True, "results": results}, separators=(",", ":")))

if __name__ == "__main__":
    main()
