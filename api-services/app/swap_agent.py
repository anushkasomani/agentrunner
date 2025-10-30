# swap_agent.py
# Usage:
#   python swap_agent.py --in SOL --out USDC --amount 0.1 --slippage-bps 30
# Optional:
#   --base-url https://lite-api.jup.ag         (default)
#   --in-decimals 9                            (only if you pass a custom mint not in registry)

from __future__ import annotations

import argparse
import json
import re
from typing import Any, Dict, Optional

import requests

# -------------------------------------------------------------------
# (Optional) Force IPv4 like your Node proxy did, to dodge IPv6/DNS flakiness
# -------------------------------------------------------------------
try:
    import socket
    import requests.packages.urllib3.util.connection as urllib3_cn  # type: ignore
    urllib3_cn.allowed_gai_family = lambda: socket.AF_INET  # force IPv4
except Exception:
    pass

# ------------------------------
# Minimal token registry (common mints on Solana mainnet)
# Add more as needed.
# ------------------------------
TOKEN_REGISTRY: Dict[str, str] = {
    "SOL": "So11111111111111111111111111111111111111112",
    "USDC": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "USDT": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    "mSOL": "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
    "BONK": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    "JitoSOL": "JitoXG7yww3G4pY1Jk1v5s3ZhG1Zo4PMVbyvT1a7UHe",
}

TOKEN_DECIMALS: Dict[str, int] = {
    "So11111111111111111111111111111111111111112": 9,  # SOL
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": 6,  # USDC
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": 6,  # USDT
    "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So": 9,   # mSOL
    "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": 5,  # BONK
    "JitoXG7yww3G4pY1Jk1v5s3ZhG1Zo4PMVbyvT1a7UHe": 9,   # JitoSOL
}

_B58_RE = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,48}$")


def to_mint(s: str) -> str:
    """Return mint address for a symbol or a mint-like string."""
    s = s.strip()
    if s in TOKEN_REGISTRY:
        return TOKEN_REGISTRY[s]
    if _B58_RE.match(s):
        return s
    raise ValueError(f"Unknown token '{s}'. Provide a known symbol or a mint address.")


def in_decimals(mint: str, fallback: Optional[int]) -> int:
    if mint in TOKEN_DECIMALS:
        return TOKEN_DECIMALS[mint]
    if fallback is not None:
        return int(fallback)
    # If unknown, default to 6 (stable-like) unless user overrides via --in-decimals
    return 6


def as_int(x: Any, default: int = 0) -> int:
    """Cast Jupiter string amounts to int safely."""
    try:
        if x is None:
            return default
        if isinstance(x, (int, float)):
            return int(x)
        if isinstance(x, str):
            return int(x.strip())
        return default
    except Exception:
        return default


# ------------------------------
# Jupiter client
# ------------------------------
class JupiterClient:
    def __init__(self, base_url: str = "https://lite-api.jup.ag", timeout: int = 15):
        self.base_url = base_url.rstrip("/")
        self.s = requests.Session()
        self.timeout = timeout
        self.s.headers.update({
            "Accept": "application/json",
            "User-Agent": "swap-agent/1.0 (+https://jup.ag)"
        })

    def _get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        r = self.s.get(f"{self.base_url}{path}", params=params, timeout=self.timeout)
        r.raise_for_status()
        return r.json()

    def _post(self, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        r = self.s.post(
            f"{self.base_url}{path}",
            data=json.dumps(payload),
            headers={"Content-Type": "application/json"},
            timeout=self.timeout,
        )
        r.raise_for_status()
        return r.json()

    # Public endpoints (Lite)
    def search(self, query: str) -> Dict[str, Any]:
        return self._get("/ultra/v1/search", params={"query": query})

    def holdings(self, address: str) -> Dict[str, Any]:
        return self._get("/ultra/v1/holdings", params={"address": address})

    def shield(self, mint: str) -> Dict[str, Any]:
        return self._get("/ultra/v1/shield", params={"mints": mint})

    def quote(self, input_mint: str, output_mint: str, amount: int, slippage_bps: int) -> Dict[str, Any]:
        # Lite/Legacy quote endpoint that returns data: [best, ...]
        return self._get(
            "/swap/v1/quote",
            params={
                "inputMint": input_mint,
                "outputMint": output_mint,
                "amount": amount,
                "slippageBps": slippage_bps,
            },
        )

    @staticmethod
    def best_route_from_quote(quote_json: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        data = quote_json.get("data")
        if isinstance(data, list) and data:
            return data[0]
        if isinstance(quote_json, dict) and "inAmount" in quote_json:
            return quote_json
        return None

    @staticmethod
    def prepare_quote_for_swap(best: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "inputMint": best["inputMint"],
            "inAmount": best["inAmount"],
            "outputMint": best["outputMint"],
            "outAmount": best["outAmount"],
            "otherAmountThreshold": best.get("otherAmountThreshold", best.get("outAmount")),
            "swapMode": best.get("swapMode", "ExactIn"),
            "slippageBps": best.get("slippageBps", 50),
            "platformFee": best.get("platformFee"),
            "priceImpactPct": best.get("priceImpactPct", "0"),
            "routePlan": best.get("routePlan", []),
        }

    def swap_instructions(self, user_pubkey: str, quote_response: Dict[str, Any]) -> Dict[str, Any]:
        return self._post(
            "/swap/v1/swap-instructions",
            payload={
                "userPublicKey": user_pubkey,
                "quoteResponse": quote_response,
                "prioritizationFeeLamports": {
                    "priorityLevelWithMaxLamports": {
                        "maxLamports": 10_000_000,
                        "priorityLevel": "veryHigh",
                    }
                },
                "dynamicComputeUnitLimit": True,
            },
        )


def summarize_route(best: Dict[str, Any]) -> Any:
    steps = []
    for leg in best.get("routePlan", []):
        info = leg.get("swapInfo", {}) or {}
        steps.append({
            "label": info.get("label"),
            "dex": info.get("label"),
            "inMint": info.get("inputMint"),
            "outMint": info.get("outputMint"),
            "inAmount": as_int(info.get("inAmount")),
            "outAmount": as_int(info.get("outAmount")),
            "ammKey": info.get("ammKey"),
            "percent": leg.get("percent"),
        })
    return steps


def main():
    ap = argparse.ArgumentParser(description="Return best swap route & price using Jupiter Lite Quote.")
    ap.add_argument("--in", dest="inp", required=True, help="Input token symbol or mint (e.g., SOL or So1111...)")
    ap.add_argument("--out", dest="out", required=True, help="Output token symbol or mint (e.g., USDC or EPjF...)")
    ap.add_argument("--amount", type=float, required=True, help="Amount in input token units (e.g., 0.1 for SOL)")
    ap.add_argument("--slippage-bps", type=int, default=50, help="Slippage in bps (default 50)")
    ap.add_argument("--base-url", type=str, default="https://lite-api.jup.ag", help="Base URL (use your proxy if needed)")
    ap.add_argument("--in-decimals", type=int, default=None, help="Override input token decimals if mint is unknown")
    args = ap.parse_args()

    try:
        input_mint = to_mint(args.inp)
        output_mint = to_mint(args.out)

        indec = in_decimals(input_mint, args.in_decimals)
        amount_int = int(round(args.amount * (10 ** indec)))

        client = JupiterClient(base_url=args.base_url)
        quote_json = client.quote(input_mint, output_mint, amount_int, args.slippage_bps)
        best = client.best_route_from_quote(quote_json)

        if not best:
            print(json.dumps({"ok": False, "error": "no_route_found", "details": quote_json}, separators=(",", ":")))
            return

        # Compute UI amounts and effective price; Jupiter returns string amounts
        outdec = TOKEN_DECIMALS.get(output_mint, 6)

        in_amount_atoms = as_int(best.get("inAmount"))
        out_amount_atoms = as_int(best.get("outAmount"))

        in_ui = in_amount_atoms / (10 ** indec) if indec >= 0 else None
        out_ui = out_amount_atoms / (10 ** outdec) if outdec >= 0 else None
        price = (out_ui / in_ui) if (in_ui and in_ui > 0) else None

        result = {
            "ok": True,
            "input": {
                "symbolOrMint": args.inp,
                "mint": input_mint,
                "decimals": indec,
                "amount_ui": in_ui,
                "amount_atoms": in_amount_atoms,
            },
            "output": {
                "symbolOrMint": args.out,
                "mint": output_mint,
                "decimals": outdec,
                "amount_ui": out_ui,
                "amount_atoms": out_amount_atoms,
            },
            "slippage_bps": args.slippage_bps,
            "price": price,  # output per 1 input
            "priceImpactPct": best.get("priceImpactPct"),
            "route": {
                "swapMode": best.get("swapMode", "ExactIn"),
                "steps": summarize_route(best),
            },
            "raw": best,  # include raw best route for downstream execution if needed
        }

        print(json.dumps(result, separators=(",", ":")))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}, separators=(",", ":")))


if __name__ == "__main__":
    main()
