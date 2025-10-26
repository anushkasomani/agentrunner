import "dotenv/config";
import express from "express";
import { v4 as uuid } from "uuid";
import { GuardConfigSchema, type Receipt } from "@agentrunner/common/types";
import { signReceipt } from "@agentrunner/common/receipts";
import { buildDailyMerkle } from "@agentrunner/common/merkle";
import { swap, rebalance } from "@agentrunner/skills";
import { dlPostReceipt } from "@agentrunner/common/datalayer";
import { owner } from "./raydium-config.ts";
import { anchorMerkleRoot } from "./anchorMerkle.ts";
import { AgentService } from "./agentService.ts";

const RUNNER_PUBKEY="HNMhpZQuQ3aJ1ePix4Q8afwUxDFmGNC4ReknNgFmNbq3"
const app = express();
app.use(express.json({ limit: "1mb" }));

const RECEIPTS: string[] = []; // demo; prod -> DB
const agentService = new AgentService();

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

// GET /receipts - Get all receipts
app.get("/receipts", (_req, res) => {
  const parsedReceipts = RECEIPTS.map(receipt => JSON.parse(receipt));
  return res.json({ ok: true, receipts: parsedReceipts, count: RECEIPTS.length });
});

// POST /anchor/daily  (build merkle root; chain submit wired later)
// app.post("/anchor/daily", async (_req, res) => {
//   const { root } = buildDailyMerkle(RECEIPTS);
//   return res.json({ ok:true, root, count: RECEIPTS.length });
// });

app.post("/anchor/daily", async (_req, res) => {
  try {
    const { root } = buildDailyMerkle(RECEIPTS);
    const { txSig, date } = await anchorMerkleRoot(root);
    return res.json({ ok:true, root, date, txSig, count: RECEIPTS.length });
  } catch (e:any) {
    return res.status(400).json({ ok:false, error: e.message });
  }
})

// POST /run/agent/:agentId - Execute agent by ID
app.post("/run/agent/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;
    const input = req.body;
    
    console.log(`Executing agent ${agentId} with input:`, input);
    
    const result = await agentService.executeAgent(agentId, input);
    
    if (!result.success) {
      return res.status(400).json({ 
        ok: false, 
        error: result.error,
        executionTime: result.executionTime 
      });
    }

    // Create receipt for agent execution
    const receipt: Receipt = {
      runner_pubkey: RUNNER_PUBKEY,
      agent: agentId,
      task_id: uuid(),
      when_unix: Math.floor(Date.now()/1000),
      inputs: input,
      outputs: result.output,
      protocols: ["custom-agent"],
      fees: { lamports: 10000 },
      cost_usd: "0.02",
      guards: {
        freshness_s: 5,
        slippage_bps: 0,
        notional_usd: 0,
        price_deviation: 0,
        tx_fee_sol: 0.00001,
        verdict: "OK"
      },
      refs: {
        agent_id: agentId,
        execution_time_ms: result.executionTime
      }
    };

    const priv = owner.secretKey.slice(0, 32);
    const signed = await signReceipt(receipt, priv);
    RECEIPTS.push(JSON.stringify(signed));

    // Post to data layer (best-effort)
    try { 
      if (process.env.DATA_LAYER_URL) await dlPostReceipt(signed); 
    } catch {}

    return res.json({ 
      ok: true, 
      result: result.output,
      receipt: signed,
      executionTime: result.executionTime
    });
  } catch (e: any) {
    console.error('Agent execution error:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /agents - List all available agents
app.get("/agents", async (_req, res) => {
  try {
    const agents = await agentService.getAllAgents();
    return res.json({ ok: true, agents });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /agents/:agentId - Get specific agent details
app.get("/agents/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;
    const agent = await agentService.fetchAgentById(agentId);
    
    if (!agent) {
      return res.status(404).json({ ok: false, error: 'Agent not found' });
    }
    
    return res.json({ ok: true, agent });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(7001, ()=> console.log("Runner listening on :7001"));

