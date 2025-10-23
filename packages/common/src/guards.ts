import crypto from "node:crypto";
import fetch from "node-fetch";
import { GuardConfig } from "./types.js";

const HERMES = process.env.PYTH_HERMES_BASE || "https://hermes.pyth.network";
const JUP = process.env.JUPITER_BASE || "https://lite-api.jup.ag";
// Raydium API URLs for devnet
const RAYDIUM_BASE_HOST = "https://api-v3-devnet.raydium.io";
const RAYDIUM_SWAP_HOST = "https://transaction-v1-devnet.raydium.io";
const RAYDIUM_PRIORITY_FEE = "/main/auto-fee";

export type GuardVerdict = {
  freshness_s: number;
  slippage_bps: number;
  notional_usd: number;
  price_deviation: number;
  tx_fee_sol: number;
  verdict: "OK" | "FAIL";
  refPrice?: number;
  publishTimeMax?: number;
  quote_response_hash?: string;
};

export async function evaluateSwapGuards(params: {
  inMint: string; outMint: string; amount: string; slippageBps: number;
  pythPriceIds: string[]; guard: GuardConfig;
}): Promise<GuardVerdict> {
  const { slippageBps, guard } = params;

  let refPrice = 1; // Default reference price
  let freshness = 0; // Default freshness
  let freshest = Math.floor(Date.now() / 1000);

  // 1) Pyth Hermes reference price + freshness (only if price IDs provided)
  if (params.pythPriceIds.length > 0) {
    try {
      const qs = params.pythPriceIds.map(id => `ids[]=${encodeURIComponent(id)}`).join("&");
      const hermesRes = await fetch(`${HERMES}/api/latest_price_feeds?${qs}`);
      
      if (!hermesRes.ok) {
        console.warn(`Pyth API error: ${hermesRes.status} ${hermesRes.statusText}`);
        throw new Error(`Pyth API returned ${hermesRes.status}`);
      }
      
      const prices = await hermesRes.json() as any[];
      const now = Math.floor(Date.now() / 1000);
      const publishTimes: number[] = prices.map((p: any)=> p.price?.publish_time ?? p.publish_time);
      freshest = Math.max(...publishTimes);
      freshness = now - freshest;
      
      if (freshness > guard.freshness_s) {
        return { freshness_s: freshness, slippage_bps: slippageBps, notional_usd: 0, price_deviation: 1, tx_fee_sol: 0, verdict: "FAIL" };
      }

      // crude refPrice as avg of first feed price
      refPrice = Number(prices[0]?.price?.price ?? prices[0]?.price) * Math.pow(10, Number(prices[0]?.price?.expo ?? 0));
    } catch (error) {
      console.warn('Pyth price fetch failed, using default values:', error);
      // Continue with default values
    }
  }

  // 2) Raydium quote (for devnet DUSDC support)
  let quote: any;
  let quoteHash = '';
  try {
    const quoteUrl = `${RAYDIUM_SWAP_HOST}/compute/swap-base-in?inputMint=${params.inMint}&outputMint=${params.outMint}&amount=${params.amount}&slippageBps=${slippageBps}&txVersion=V0`;
    const quoteRes = await fetch(quoteUrl);
    
    if (!quoteRes.ok) {
      console.error(`Raydium API error: ${quoteRes.status} ${quoteRes.statusText}`);
      const errorText = await quoteRes.text();
      console.error('Raydium API error response:', errorText);
      throw new Error(`Raydium API returned ${quoteRes.status}: ${errorText}`);
    }
    
    quote = await quoteRes.json() as any;
    quoteHash = crypto.createHash("sha256").update(JSON.stringify(quote)).digest("hex");
  } catch (error) {
    console.error('Raydium quote failed:', error);
    throw new Error(`Raydium quote failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // COMMENTED OUT: Jupiter quote (for mainnet tokens)
  // let quote: any;
  // let quoteHash = '';
  // try {
  //   const url = `${JUP}/swap/v1/quote?inputMint=${params.inMint}&outputMint=${params.outMint}&amount=${params.amount}&slippageBps=${slippageBps}`;
  //   const quoteRes = await fetch(url);
  //   
  //   if (!quoteRes.ok) {
  //     console.error(`Jupiter API error: ${quoteRes.status} ${quoteRes.statusText}`);
  //     const errorText = await quoteRes.text();
  //     console.error('Jupiter API error response:', errorText);
  //     throw new Error(`Jupiter API returned ${quoteRes.status}: ${errorText}`);
  //   }
  //   
  //   quote = await quoteRes.json() as any;
  //   quoteHash = crypto.createHash("sha256").update(JSON.stringify(quote)).digest("hex");
  // } catch (error) {
  //   console.error('Jupiter quote failed:', error);
  //   throw new Error(`Jupiter quote failed: ${error instanceof Error ? error.message : String(error)}`);
  // }

  // Effective execution price = in_amount / out_amount (approx)
  const inAmount = Number(params.amount);
  // Raydium response format: quote.data.default.vh (estimated output amount)
  const outAmount = Number(quote?.data?.default?.vh ?? quote?.outAmount ?? 0);
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
