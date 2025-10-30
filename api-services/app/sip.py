# sip_agent.py
# Minimal "SIP decision" agent in Python.
# Input: OHLCV candles (list of dicts with keys: t,o,h,l,c,v), oldest→newest.
# Output: True (buy) or False (hold).

from __future__ import annotations
from typing import List, Dict, Optional


# -----------------------------
# Indicator utilities (no deps)
# -----------------------------
def ema(series: List[float], length: int) -> List[float]:
    out = [float("nan")] * len(series)
    if not series:
        return out
    k = 2.0 / (length + 1.0)
    prev = series[0]
    for i, v in enumerate(series):
        prev = v if i == 0 else (prev + k * (v - prev))
        out[i] = prev
    return out


def sma(series: List[float], length: int) -> List[float]:
    out = [float("nan")] * len(series)
    if length <= 0 or length > len(series):
        return out
    s = 0.0
    for i, v in enumerate(series):
        s += v
        if i >= length:
            s -= series[i - length]
        if i >= length - 1:
            out[i] = s / length
    return out


def rsi(series: List[float], length: int = 14) -> List[float]:
    n = len(series)
    out = [float("nan")] * n
    if n < 2:
        return out
    avg_gain = 0.0
    avg_loss = 0.0
    for i in range(1, n):
        diff = series[i] - series[i - 1]
        gain = max(diff, 0.0)
        loss = max(-diff, 0.0)
        if i <= length:
            avg_gain += gain
            avg_loss += loss
            if i == length:
                avg_gain /= length
                avg_loss /= length
                rs = float("inf") if avg_loss == 0 else (avg_gain / avg_loss)
                out[i] = 100.0 - 100.0 / (1.0 + rs)
        else:
            avg_gain = (avg_gain * (length - 1) + gain) / length
            avg_loss = (avg_loss * (length - 1) + loss) / length
            rs = float("inf") if avg_loss == 0 else (avg_gain / avg_loss)
            out[i] = 100.0 - 100.0 / (1.0 + rs)
    return out


def macd_hist(series: List[float], fast: int = 12, slow: int = 26, signal: int = 9) -> List[float]:
    fast_e = ema(series, fast)
    slow_e = ema(series, slow)
    macd_line = [ (fast_e[i] - slow_e[i]) if not any(map(_isnan, [fast_e[i], slow_e[i]])) else float("nan")
                  for i in range(len(series)) ]
    signal_line = ema([x if x == x else 0.0 for x in macd_line], signal)  # treat NaN as 0 early on
    hist = [ (macd_line[i] - signal_line[i]) if not any(map(_isnan, [macd_line[i], signal_line[i]])) else float("nan")
             for i in range(len(series)) ]
    return hist


def zscore(series: List[float], length: int = 20) -> List[float]:
    out = [float("nan")] * len(series)
    if length <= 1:
        return out
    s = 0.0
    s2 = 0.0
    for i, v in enumerate(series):
        s += v
        s2 += v * v
        if i >= length:
            s -= series[i - length]
            s2 -= series[i - length] * series[i - length]
        if i >= length - 1:
            n = float(length)
            mu = s / n
            var = max(0.0, s2 / n - mu * mu)
            sd = var ** 0.5
            out[i] = 0.0 if sd == 0 else (series[i] - mu) / sd
    return out


def _isnan(x: float) -> bool:
    return not (x == x)


# -----------------------------
# Decision Logic
# -----------------------------
DEFAULT_CFG = {
    "rsi_len": 14,
    "ema_short": 20,
    "ema_med": 50,
    "ema_long": 200,
    "macd": [12, 26, 9],
    "z_len": 20,

    # Triggers
    "rsi_buy_below": 44.0,
    "max_z_below_ema20": -0.5,
    "require_uptrend_ma": True,  # price > EMA50 and EMA50 > EMA200

    # Minimum candles required (safety)
    "min_candles": 220
}


def should_buy(ohlcv: List[Dict[str, float]], cfg: Optional[Dict] = None) -> bool:
    """
    Return True (buy) or False (hold) given OHLCV candles.
    Expects ohlcv sorted oldest→newest, each item: {'t','o','h','l','c','v'}.
    """
    C = dict(DEFAULT_CFG)
    if cfg:
        C.update(cfg)

    if not ohlcv or len(ohlcv) < C["min_candles"]:
        return False

    close = [float(x["c"]) for x in ohlcv]
    high  = [float(x["h"]) for x in ohlcv]
    low   = [float(x["l"]) for x in ohlcv]

    ema20  = ema(close, C["ema_short"])
    ema50  = ema(close, C["ema_med"])
    ema200 = ema(close, C["ema_long"])
    rsi_v  = rsi(close, C["rsi_len"])
    macdh  = macd_hist(close, *C["macd"])

    # z-score of (price - ema20) over last z_len
    dev = [ (close[i] - ema20[i]) if not _isnan(ema20[i]) else float("nan") for i in range(len(close)) ]
    z20 = zscore(dev, C["z_len"])

    i = len(close) - 1
    # sanity checks
    if any(_isnan(x) for x in [close[i], ema20[i], ema50[i], ema200[i], rsi_v[i], z20[i]]) or i < 1:
        return False

    price = close[i]
    uptrend_ok = (not C["require_uptrend_ma"]) or (price > ema50[i] and ema50[i] > ema200[i])

    green_dip = (rsi_v[i] <= C["rsi_buy_below"]) and (z20[i] <= C["max_z_below_ema20"]) and uptrend_ok

    # Turn-up confirmation: MACD hist crosses above 0 OR price reclaims EMA20
    turn_up = False
    if not _isnan(macdh[i]) and not _isnan(macdh[i - 1]):
        turn_up = (macdh[i - 1] < 0.0 and macdh[i] > 0.0)
    if not turn_up and not any(_isnan(x) for x in [close[i-1], ema20[i-1], close[i], ema20[i]]):
        turn_up = (close[i - 1] < ema20[i - 1] and close[i] > ema20[i])

    return bool(green_dip or (turn_up and uptrend_ok))


# -----------------------------
# Optional CLI (stdin JSON)
# -----------------------------
if __name__ == "__main__":
    """
    Example usage:
        python sip_agent.py < candles.json
    Where candles.json is a JSON array of {t,o,h,l,c,v} sorted oldest→newest.
    Prints only BUY or HOLD.
    """
    import sys, json
    try:
        raw = sys.stdin.read()
        arr = json.loads(raw)
        print("BUY" if should_buy(arr) else "HOLD")
    except Exception:
        # Fail-closed
        print("HOLD")