import express from "express";
import { v4 as uuid } from "uuid";
import fetch from "node-fetch";
import { z } from "zod";
import { Client } from "pg";
import { dlBenchmarks } from "@agentrunner/common/datalayer";

const app = express();
app.use(express.json());

const pg = new Client({ connectionString: process.env.PG_URL });
pg.connect();

async function init() {
  await pg.query(`
    create table if not exists agents(
      id text primary key,
      name text,
      capability text,
      offer_url text,
      rating real default 0.9
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

  const exists = await pg.query(`select id from agents where id='local-swap-vendor'`);
  if (exists.rowCount === 0) {
    await pg.query(
      `insert into agents(id,name,capability,offer_url,rating) values($1,$2,$3,$4,$5)`,
      ["local-swap-vendor", "Local Swap Vendor", "swap.spl", "http://x402:7003/price", 0.92]
    );
  }
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
    for (const v of vendors.rows) {
      try {
        const url = new URL(v.offer_url);
        url.searchParams.set("capability", rfp.capability);
        const priceRes = await fetch(url.toString());
        const priceJson: any = await priceRes.json();

        const offer = {
          id: `offer_${uuid()}`,
          rfp_id: id,
          agent_id: v.id,
          price_usd: Number(priceJson.price_usd || 0.1),
          eta_ms: 1500,
          confidence: v.rating,
          terms: { refund_if_latency_ms_over: (rfp.slo as any)?.p95_ms ?? 3000 }
        };

        await pg.query(
          `insert into offers(id,rfp_id,agent_id,price_usd,eta_ms,confidence,terms) values($1,$2,$3,$4,$5,$6,$7)`,
          [offer.id, offer.rfp_id, offer.agent_id, offer.price_usd, offer.eta_ms, offer.confidence, offer.terms]
        );
      } catch {
        // ignore vendor fetch/insert errors; continue trying others
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
  try { if (process.env.DATA_LAYER_URL) bench = await dlBenchmarks(rfp.capability || "swap.spl"); } catch {}

  const score = mkScorer(bench, rfp);
  const ranked = rows.rows.map(o => ({ ...o, _score: score(o) }))
    .sort((a, b) => b._score - a._score);

  const eps = 0.05;
  if (ranked.length > 1 && Math.abs(ranked[0].price_usd - ranked[1].price_usd) / ranked[0].price_usd < eps) {
    ranked[0].price_usd = Math.min(ranked[0].price_usd, ranked[1].price_usd * (1 - 0.02));
  }

  const winner = ranked[0];
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

app.listen(7004, () => console.log("Broker listening on :7004"));
