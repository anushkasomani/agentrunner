import fetch from "node-fetch";
import { evaluateSwapGuards } from "@agentrunner/common/guards";
import type { GuardVerdict } from "@agentrunner/common/guards";
import type { GuardConfig } from "@agentrunner/common/types";
/**
 * Trusted swap skill using Jupiter legacy Swap API
 * 1) Evaluate guards (freshness, slippage, price deviation, notional, fee caps)
 * 2) Build base64 txn via POST /swap and send using Solana RPC
 * 3) Return txid, out_amount, and guard verdict
 */
const JUP = process.env.JUPITER_BASE || "https://lite-api.jup.ag";
const USER_PUBKEY = process.env.RUNNER_PUBKEY || "HNMhpZQuQ3aJ1ePix4Q8afwUxDFmGNC4ReknNgFmNbq3";
const RPC_URL = process.env.SOLANA_RPC_URL || "https://wild-late-season.solana-devnet.quiknode.pro/b0ebcc50a76d22c777b9f18945f0d47e9f71ccaf";

export async function swap(params: {
  inMint: string; outMint: string; amount: string; slippageBps: number;
  pythPriceIds: string[]; guard: GuardConfig;
}): Promise<{ txid?: string; outAmount?: string; verdict: GuardVerdict; quoteHash?: string; }> {
  const verdict = await evaluateSwapGuards(params);
  if (verdict.verdict !== "OK") return { verdict };

  // 1) Quote (again for build)
  const quoteUrl = `${JUP}/swap/v1/quote?inputMint=${params.inMint}&outputMint=${params.outMint}&amount=${params.amount}&slippageBps=${params.slippageBps}`;
  const quoteResponse = await (await fetch(quoteUrl)).json() as any;

  // 2) Build unsigned swap txn
  const swapRes = await fetch(`${JUP}/swap/v1/swap`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userPublicKey: USER_PUBKEY,
      quoteResponse,
      dynamicComputeUnitLimit: true
    })
  });
  const swapJson = await swapRes.json() as any;
  if (!swapJson?.swapTransaction) throw new Error(`Jupiter swap build failed: ${JSON.stringify(swapJson)}`);

  // 3) Send base64 txn through RPC
  const sendRes = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "sendTransaction",
      params: [swapJson.swapTransaction, { skipPreflight: false }]
    })
  });
  const sendJson = await sendRes.json() as any;
  if (sendJson.error) throw new Error(`sendTransaction error: ${JSON.stringify(sendJson.error)}`);

  return { txid: sendJson.result, outAmount: quoteResponse?.outAmount, verdict, quoteHash: verdict.quote_response_hash };
}
