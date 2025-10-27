import express from "express";
import { v4 as uuid } from "uuid";
import fetch from "node-fetch";
import { z } from "zod";
import pgPkg from "pg";
const { Client } = pgPkg;
import { dlBenchmarks } from "@agentrunner/common/datalayer";

const app = express();
app.use(express.json());

const pg = new Client({ connectionString: process.env.PG_URL });
pg.connect(); 

async function syncAgentsFromBlockchain() {
  try {
    console.log("Syncing agents from frontend...");
    
    // Fetch agents from frontend API
    const response = await fetch('http://localhost:3000/api/agents');
    if (!response.ok) {
      console.log("Could not fetch agents from frontend, skipping sync");
      return;
    }
    
    const data = await response.json() as any;
    if (!data.ok || !data.agents) {
      console.log("Invalid response from frontend, skipping sync");
      return;
    }
    
    const agents = data.agents;
    console.log(`Found ${agents.length} agents from frontend`);

    // Process each agent
    for (const agent of agents) {
      try {
        const capability = agent.capability || "generic";
        const chargeUsd = parseFloat(agent.charge) || 0.1;
        
        // Check if agent already exists
        const existingAgent = await pg.query(
          `SELECT id FROM agents WHERE agent_pda = $1`,
          [agent.agentPda]
        );

        if (existingAgent.rowCount === 0) {
          // Insert new agent
          await pg.query(`
            INSERT INTO agents(id, agent_id, agent_pda, name, capability, metadata_uri, charge_usd, rating)
            VALUES($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            `agent_${uuid()}`,
            agent.agentId,
            agent.agentPda,
            agent.name || "Unknown Agent",
            capability,
            agent.metadataUrl,
            chargeUsd,
            0.0 // Initial rating
          ]);
          
          console.log(`Added new agent: ${agent.name}`);
        } else {
          // Update existing agent's metadata
          await pg.query(`
            UPDATE agents 
            SET name = $1, capability = $2, metadata_uri = $3, charge_usd = $4, updated_at = now()
            WHERE agent_pda = $5
          `, [
            agent.name || "Unknown Agent",
            capability,
            agent.metadataUrl,
            chargeUsd,
            agent.agentPda
          ]);
          
          console.log(`Updated agent: ${agent.name}`);
        }
      } catch (error) {
        console.error(`Error processing agent ${agent.agentPda}:`, error);
      }
    }
    
    console.log("Agent sync completed");
  } catch (error) {
    console.error("Error syncing agents from frontend:", error);
  }
}

async function init() {
  await pg.query(`
    create table if not exists agents(
      id text primary key,
      agent_id text unique,
      agent_pda text unique,
      name text,
      capability text,
      metadata_uri text,
      charge_usd real,
      rating real default 0.0,
      successful_hires integer default 0,
      total_hires integer default 0,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );
    create table if not exists rfps(
      id text primary key,
      payload jsonb,
      created_at timestamptz default now()
    );
    create table if not exists offers(
      id text primary key,
      rfp_id text references rfps(id),
      agent_id text references agents(id),
      price_usd real,
      eta_ms integer,
      confidence real,
      terms jsonb,
      created_at timestamptz default now()
    );
  `);

  // Sync agents from blockchain
  await syncAgentsFromBlockchain();
}
init();

const RfpSchema = z.object({
  capability: z.string(),
  inputs: z.record(z.any()).optional(),
  constraints: z.record(z.any()).optional(),
  budget_usd: z.number().optional(),
  slo: z.record(z.any()).optional()
});

// POST /rfp
app.post("/rfp", async (req, res) => {
  try {
    const rfp = RfpSchema.parse(req.body || {});
    const id = `rfp_${uuid()}`;
    await pg.query(`insert into rfps(id,payload) values($1,$2)`, [id, rfp]);

    const vendors = await pg.query(`select * from agents where capability=$1`, [rfp.capability]);
    console.log(`Found ${vendors.rowCount} agents for capability: ${rfp.capability}`);
    
    for (const v of vendors.rows) {
      try {
        // Use metadata pricing instead of HTTP calls
        const offer = {
          id: `offer_${uuid()}`,
          rfp_id: id,
          agent_id: v.id,
          price_usd: Number(v.charge_usd || 0.1),
          eta_ms: 1500, // Default ETA
          confidence: v.rating,
          terms: { refund_if_latency_ms_over: (rfp.slo as any)?.p95_ms ?? 3000 }
        };

        await pg.query(
          `insert into offers(id,rfp_id,agent_id,price_usd,eta_ms,confidence,terms) values($1,$2,$3,$4,$5,$6,$7)`,
          [offer.id, offer.rfp_id, offer.agent_id, offer.price_usd, offer.eta_ms, offer.confidence, offer.terms]
        );
        
        console.log(`Created offer for agent ${v.name}: $${offer.price_usd}`);
      } catch (error) {
        console.error(`Error creating offer for agent ${v.name}:`, error);
      }
    }

    res.json({ ok: true, rfp_id: id });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// GET /rfp/:id/offers
app.get("/rfp/:id/offers", async (req, res) => {
  const id = req.params.id;
  const rows = await pg.query(`select * from offers where rfp_id=$1`, [id]);
  res.json({ ok: true, offers: rows.rows });
});

function mkScorer(bench?: any, req?: any) {
  const benchPrice = Number(bench?.median_price_usd ?? 0.20);
  const benchP95   = Number(bench?.p95_latency_ms ?? (req?.slo?.p95_ms ?? 3000));
  const benchSafety= Number(bench?.safety_score ?? 0.95);
  return (o: any) => {
    const cost = Math.max(0, 1 - (o.price_usd / benchPrice));
    const latency = Math.max(0, 1 - (o.eta_ms / benchP95));
    const reliability = Number(o.confidence || 0.9);
    const safety = Math.min(1, Number(o.safety_score ?? benchSafety));
    return 0.30 * reliability + 0.20 * safety + 0.30 * cost + 0.20 * latency;
  };
}

// POST /hire { rfp_id }
app.post("/hire", async (req, res) => {
  const { rfp_id } = req.body || {};
  if (!rfp_id) return res.status(400).json({ ok: false, error: "rfp_id required" });

  const rows = await pg.query(`select * from offers where rfp_id=$1`, [rfp_id]);
  if (rows.rowCount === 0) return res.status(404).json({ ok: false, error: "no offers" });

  const rfpRow = await pg.query(`select payload from rfps where id=$1`, [rfp_id]);
  const rfp = rfpRow.rows[0]?.payload || {};

  let bench: any = null;
  try { if (process.env.DATA_LAYER_URL) bench = await dlBenchmarks(rfp.capability || "swap"); } catch {}

  const score = mkScorer(bench, rfp);
  const ranked = rows.rows.map(o => ({ ...o, _score: score(o) }))
    .sort((a, b) => b._score - a._score);

  const eps = 0.05;
  if (ranked.length > 1 && Math.abs(ranked[0].price_usd - ranked[1].price_usd) / ranked[0].price_usd < eps) {
    ranked[0].price_usd = Math.min(ranked[0].price_usd, ranked[1].price_usd * (1 - 0.02));
  }

  const winner = ranked[0];
  
  // Update agent reputation (increase rating on successful hire)
  await pg.query(`
    UPDATE agents 
    SET total_hires = total_hires + 1, 
        successful_hires = successful_hires + 1,
        rating = CASE 
          WHEN total_hires = 0 THEN 1.0
          ELSE (successful_hires::real / total_hires::real)
        END,
        updated_at = now()
    WHERE id = $1
  `, [winner.agent_id]);
  
  console.log(`Hired agent ${winner.agent_id} and updated reputation`);
  
  res.json({
    ok: true,
    hired: {
      agent_id: winner.agent_id,
      price_usd: winner.price_usd,
      eta_ms: winner.eta_ms,
      score: winner._score,
      bench
    }
  });
});

// POST /sync-agents - Manually sync agents from blockchain
app.post("/sync-agents", async (req, res) => {
  try {
    await syncAgentsFromBlockchain();
    res.json({ ok: true, message: "Agents synced successfully" });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /agents - List all agents
app.get("/agents", async (req, res) => {
  try {
    const agents = await pg.query(`SELECT * FROM agents ORDER BY rating DESC`);
    res.json({ ok: true, agents: agents.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.listen(7004, () => console.log("Broker listening on :7004"));
