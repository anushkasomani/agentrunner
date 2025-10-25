import crypto from "node:crypto";
import fetch from "node-fetch";
const HERMES = "https://hermes.pyth.network"
const JUP ="https://lite-api.jup.ag"
export async function evaluateSwapGuards(params) {
    const { slippageBps, guard } = params;
    // 1) Pyth Hermes reference price + freshness
    const qs = params.pythPriceIds.map(id => `ids[]=${encodeURIComponent(id)}`).join("&");
    const hermesRes = await fetch(`${HERMES}/api/latest_price_feeds?${qs}`);
    const prices = await hermesRes.json();
    const now = Math.floor(Date.now() / 1000);
    const publishTimes = prices.map((p) => p.price?.publish_time ?? p.publish_time);
    const freshest = Math.max(...publishTimes);
    const freshness = now - freshest;
    if (freshness > guard.freshness_s) {
        return { freshness_s: freshness, slippage_bps: slippageBps, notional_usd: 0, price_deviation: 1, tx_fee_sol: 0, verdict: "FAIL" };
    }
    // crude refPrice as avg of first feed price
    const refPrice = Number(prices[0]?.price?.price ?? prices[0]?.price) * Math.pow(10, Number(prices[0]?.price?.expo ?? 0));
    // 2) Jupiter quote
    const url = `${JUP}/swap/v1/quote?inputMint=${params.inMint}&outputMint=${params.outMint}&amount=${params.amount}&slippageBps=${slippageBps}`;
    const quote = await (await fetch(url)).json();
    const quoteHash = crypto.createHash("sha256").update(JSON.stringify(quote)).digest("hex");
    // Effective execution price = in_amount / out_amount (approx)
    const inAmount = Number(params.amount);
    const outAmount = Number(quote?.outAmount ?? 0);
    const execPrice = outAmount > 0 ? inAmount / outAmount : Number.POSITIVE_INFINITY;
    const priceDeviation = Math.abs(execPrice - refPrice) / (refPrice || 1);
    // 3) Notional + fee caps (naive USD from refPrice)
    const notionalUsd = outAmount * refPrice; // simplistic; replace with proper decimals
    const txFeeSol = 0.000005; // estimate; final fee returned after send
    const ok = slippageBps <= guard.slippage_bps_max
        && priceDeviation <= guard.price_dev_max
        && notionalUsd <= guard.notional_usd_max
        && txFeeSol <= guard.fee_sol_max;
    return {
        freshness_s: freshness,
        slippage_bps: slippageBps,
        notional_usd: Number.isFinite(notionalUsd) ? notionalUsd : 0,
        price_deviation: Number.isFinite(priceDeviation) ? priceDeviation : 1,
        tx_fee_sol: txFeeSol,
        refPrice, publishTimeMax: freshest,
        quote_response_hash: `sha256:${quoteHash}`,
        verdict: ok ? "OK" : "FAIL"
    };
}
