import "dotenv/config";
import express from "express";
import { v4 as uuid } from "uuid";
import { GuardConfigSchema, type Receipt } from "@agentrunner/common/types";
import { signReceipt } from "@agentrunner/common/receipts";
import { buildDailyMerkle } from "@agentrunner/common/merkle";
import { swap, rebalance } from "@agentrunner/skills";
import { dlPostReceipt } from "@agentrunner/common/datalayer";
import { owner } from "./raydium-config.js";

const RUNNER_PUBKEY="HNMhpZQuQ3aJ1ePix4Q8afwUxDFmGNC4ReknNgFmNbq3"
const app = express();
app.use(express.json({ limit: "1mb" }));

const RECEIPTS: string[] = []; // demo; prod -> DB

// POST /run/skill/swap
app.post("/run/skill/swap", async (req, res) => {
  try {
    const body = req.body;
    const guard = GuardConfigSchema.parse(body.guard || {});
    console.log("swapping")
    const out = await swap({
      inMint: body.inMint, outMint: body.outMint, amount: body.amount, slippageBps: body.slippageBps,
      pythPriceIds: body.pythPriceIds, guard
    });
    console.log("swapp successfull. output is : ", out)

    const receipt: Receipt = {
      runner_pubkey: RUNNER_PUBKEY || "HNMhpZQuQ3aJ1ePix4Q8afwUxDFmGNC4ReknNgFmNbq3",
      agent: "swap",
      task_id: uuid(),
      when_unix: Math.floor(Date.now()/1000),
      inputs: body,
      outputs: { txid: out.txid, outAmount: out.outAmount },
      protocols: ["raydium","pyth"],
      fees: { lamports: 5000 },
      cost_usd: "0.01",
      guards: {
        freshness_s: out.verdict.freshness_s,
        slippage_bps: body.slippageBps,
        notional_usd: out.verdict.notional_usd,
        price_deviation: out.verdict.price_deviation,
        tx_fee_sol: out.verdict.tx_fee_sol,
        verdict: out.verdict.verdict
      },
      refs: {
        pyth_ids: body.pythPriceIds,
        quote_response_hash: out.quoteHash,
        config_hash: "sha256:guardcfg"
      }
    };

    const priv = owner.secretKey.slice(0, 32); // Extract only the private key part (first 32 bytes)
    console.log('Secret key length:', priv.length);
    console.log('Secret key type:', typeof priv);
    console.log('Secret key constructor:', priv.constructor.name);
    const signed = await signReceipt(receipt, priv);
    RECEIPTS.push(JSON.stringify(signed));

    // Post to data layer (best-effort)
    try { if (process.env.DATA_LAYER_URL) await dlPostReceipt(signed); } catch {}

    return res.json({ ok: true, receipt: signed });
  } catch (e:any) {
    return res.status(400).json({ ok:false, error:e.message });
  }
});

// POST /run/skill/rebalance
app.post("/run/skill/rebalance", async (req, res) => {
  try {
    const body = req.body;
    const guard = GuardConfigSchema.parse(body.guard || {});
    const results = await rebalance({ legs: body.legs, guard });

    const receipt: Receipt = {
      runner_pubkey: RUNNER_PUBKEY,
      agent: "rebalance",
      task_id: uuid(),
      when_unix: Math.floor(Date.now()/1000),
      inputs: body,
      outputs: { legs: results },
      protocols: ["raydium","pyth"],
      fees: { lamports: 15000 },
      cost_usd: "0.03",
      guards: { freshness_s: 3, slippage_bps: 30, notional_usd: 0, price_deviation: 0.004, tx_fee_sol: 0.000015, verdict: "OK" },
      refs: { config_hash: "sha256:guardcfg" }
    };

    const priv = owner.secretKey.slice(0, 32); // Extract only the private key part (first 32 bytes)
    const signed = await signReceipt(receipt, priv);
    RECEIPTS.push(JSON.stringify(signed));
    try { if (process.env.DATA_LAYER_URL) await dlPostReceipt(signed); } catch {}
    res.json({ ok:true, receipt: signed });
  } catch (e:any) {
    res.status(400).json({ ok:false, error:e.message });
  }
});

// POST /anchor/daily  (build merkle root; chain submit wired later)
app.post("/anchor/daily", async (_req, res) => {
  const { root } = buildDailyMerkle(RECEIPTS);
  return res.json({ ok:true, root, count: RECEIPTS.length });
});

app.listen(7001, ()=> console.log("Runner listening on :7001"));

