from fastapi import FastAPI, Request, Response, HTTPException, Query
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
from uuid import uuid4
import requests
import os


app = FastAPI(title="x402 Paywalled Link Shortener", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Config
TIMEOUT = 10
DEFAULT_PRICE_USD = float(os.getenv("LINK_PRICE_USD", "0.01"))
MERCHANT_URL = os.getenv("X402_URL", "http://localhost:7003")


def create_invoice(price_usd: float):
    try:
        r = requests.post(f"{MERCHANT_URL}/invoice", json={"price_usd": price_usd}, timeout=TIMEOUT)
        if r.status_code == 402:
            return {
                "invoice": r.headers.get("X-402-Invoice"),
                "price": r.headers.get("X-402-Price"),
                "currency": r.headers.get("X-402-Currency"),
                "payto": r.headers.get("X-402-PayTo"),
                "body": r.json(),
            }
        raise Exception(f"merchant returned {r.status_code}")
    except Exception as e:
        raise Exception(f"create_invoice failed: {e}")


def verify_payment(invoice_id: str, proof: dict):
    try:
        r = requests.post(f"{MERCHANT_URL}/verify", json={"invoice": invoice_id, "proof": proof}, timeout=TIMEOUT)
        data = r.json()
        return bool(data.get("ok")), data
    except Exception as e:
        return False, {"error": f"verify failed: {e}"}


# In-memory store (swap to DB later)
SHORTS: dict[str, dict] = {}


@app.get("/health")
def health():
    return {"ok": True, "service": "link-shortener", "time": datetime.now(timezone.utc).isoformat()}


@app.post("/shorten")
def shorten(payload: dict):
    url = (payload or {}).get("url")
    if not url or not isinstance(url, str) or not url.startswith("http"):
        raise HTTPException(status_code=400, detail="url required (http/https)")
    price = float((payload or {}).get("price_usd") or DEFAULT_PRICE_USD)
    sid = f"lnk_{uuid4().hex[:8]}"
    SHORTS[sid] = {"url": url, "price_usd": price, "created_at": datetime.now(timezone.utc).isoformat()}
    return {"ok": True, "id": sid, "short": f"/s/{sid}", "price_usd": price}


@app.get("/s/{sid}")
def resolve(request: Request, response: Response, sid: str):
    entry = SHORTS.get(sid)
    if not entry:
        raise HTTPException(status_code=404, detail="not found")

    inv = request.headers.get("X-402-Invoice")
    ptx = request.headers.get("X-402-Proof-Tx")
    pmint = request.headers.get("X-402-Proof-Mint")
    pchain = request.headers.get("X-402-Chain")
    pamt = request.headers.get("X-402-Amount")

    if inv and ptx and pmint and pchain:
        ok, _ = verify_payment(inv, {"txid": ptx, "mint": pmint, "chain": pchain, "amount": pamt})
        if ok:
            return RedirectResponse(url=entry["url"], status_code=302)

    try:
        invoice = create_invoice(entry["price_usd"])
        response.status_code = 402
        response.headers["X-402-Price"] = invoice["price"]
        response.headers["X-402-Currency"] = invoice["currency"]
        response.headers["X-402-Invoice"] = invoice["invoice"]
        response.headers["X-402-PayTo"] = invoice["payto"]
        response.headers["X-402-Description"] = f"Pay to access {sid}"
        return invoice["body"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"payment error: {e}")


# To run standalone: uvicorn api-services.app.link_shortner:app --reload --port 8010

