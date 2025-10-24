import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const idl = JSON.parse(readFileSync(join(__dirname, 'registry.json'), 'utf8'));

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const RUNNER = "http://localhost:7001";
const PLANNER = "http://localhost:7002";
const X402 =  "http://localhost:7003";
const BROKER =  "http://localhost:7004";
const CERT =  "http://localhost:7005";

// --- On-chain (read) client setup
const RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const connection = new Connection(RPC, "confirmed");
const PROGRAM_ID = process.env.AGENT_PROGRAM_ID ? new PublicKey(process.env.AGENT_PROGRAM_ID) : null;
const AGENT_IDENTITY = process.env.AGENT_IDENTITY ? new PublicKey(process.env.AGENT_IDENTITY) : null;

// Anchor Program instance (read-only provider)
let program: anchor.Program | null = null;
if (PROGRAM_ID) {
  // Use a dummy read-only provider
  const provider = new anchor.AnchorProvider(connection, {} as any, { commitment: "confirmed" });
  program = new anchor.Program(idl as any, PROGRAM_ID, provider);
}

/** Health */
app.get("/health", (_req,res)=> res.json({ ok:true, name:"api-gateway" }));

/** Planner */
app.post("/plan", async (req, res) => {
  const r = await fetch(`${PLANNER}/plan`, { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify(req.body || {}) });
  res.status(r.status).set(Object.fromEntries(r.headers)).send(await r.text());
});

/** x402 proxy */
app.get("/price", async (req, res) => {
  const url = new URL(`${X402}/price`);
  if (req.query.capability) url.searchParams.set("capability", String(req.query.capability));
  const r = await fetch(url.toString());
  res.status(r.status).set(Object.fromEntries(r.headers)).send(await r.text());
});

app.post("/invoice", async (req,res)=>{
  const r = await fetch(`${X402}/invoice`, { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify(req.body || {}) });
  res.status(r.status).set(Object.fromEntries(r.headers)).send(await r.text());
});

app.post("/verify", async (req,res)=>{
  const r = await fetch(`${X402}/verify`, { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify(req.body || {}) });
  res.status(r.status).set(Object.fromEntries(r.headers)).send(await r.text());
});

app.post("/refund", async (req,res)=>{
  const r = await fetch(`${X402}/refund`, { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify(req.body || {}) });
  res.status(r.status).set(Object.fromEntries(r.headers)).send(await r.text());
});

/** Broker: RFP + Offers + Hire */
app.post("/rfp", async (req,res)=>{
  const r = await fetch(`${BROKER}/rfp`, { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify(req.body || {}) });
  res.status(r.status).set(Object.fromEntries(r.headers)).send(await r.text());
});
app.get("/rfp/:id/offers", async (req,res)=>{
  const r = await fetch(`${BROKER}/rfp/${req.params.id}/offers`);
  res.status(r.status).set(Object.fromEntries(r.headers)).send(await r.text());
});
app.post("/hire", async (req,res)=>{
  const r = await fetch(`${BROKER}/hire`, { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify(req.body || {}) });
  res.status(r.status).set(Object.fromEntries(r.headers)).send(await r.text());
});

/** Certifier */
app.post("/submit", async (req,res)=>{
  const r = await fetch(`${CERT}/submit`, { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify(req.body || {}) });
  res.status(r.status).set(Object.fromEntries(r.headers)).send(await r.text());
});
app.get("/cert/:id", async (req,res)=>{
  const r = await fetch(`${CERT}/cert/${req.params.id}`);
  res.status(r.status).set(Object.fromEntries(r.headers)).send(await r.text());
});

/** Runner: paid run (requires invoice+proof or a prior verify) */
app.post("/run/swap", async (req,res)=>{
  const { invoice, proof, ...rest } = req.body || {};
  if (invoice && proof) {
    const v = await fetch(`${X402}/verify`, { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ invoice, proof }) });
    if (!v.ok) {
      const bodyText = await v.text();
      return res.status(402).set({ "X-402-Invoice": invoice }).send(bodyText);
    }
  } else {
    const price = await fetch(`${X402}/invoice`, { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ price_usd: 0.10 }) });
    const headers:any = Object.fromEntries(price.headers);
    const bodyText = await price.text();
    return res.status(402).set(headers).send(bodyText);
  }
  const r = await fetch(`${RUNNER}/run/skill/swap`, { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify(rest) });
  res.status(r.status).set(Object.fromEntries(r.headers)).send(await r.text());
});

/** Receipts + Anchor passthroughs */
app.get("/receipts", async (_req,res)=>{
  const r = await fetch(`${RUNNER}/receipts`);
  res.status(r.status).set(Object.fromEntries(r.headers)).send(await r.text());
});
app.post("/anchor/daily", async (_req,res)=>{
  const r = await fetch(`${RUNNER}/anchor/daily`, { method:"POST" });
  res.status(r.status).set(Object.fromEntries(r.headers)).send(await r.text());
});

/** Catalog (demo) */
app.get("/catalog", async (_req,res)=>{
  res.json({ ok:true, agents:[{ id:"local-swap-vendor", name:"Local Swap Vendor", capability:"swap.spl", price_endpoint:"/price?capability=swap.spl" }]});
});

/** NEW: On-chain endpoints (3) */
// 1) Program/identity info for the UI
app.get("/onchain/info", (_req, res) => {
  res.json({
    ok: true,
    program_id: PROGRAM_ID?.toBase58() || null,
    agent_identity: AGENT_IDENTITY?.toBase58() || null,
    rpc: RPC,
    has_anchor: !!program
  });
});

// 2) Relay daily anchor (calls runner, which builds root and posts on-chain)
app.post("/onchain/anchor/daily", async (_req, res) => {
  const r = await fetch(`${RUNNER}/anchor/daily`, { method: "POST" });
  res.status(r.status).set(Object.fromEntries(r.headers)).send(await r.text());
});

// 3) Fetch a transaction by signature (debug/readout)
app.get("/onchain/tx/:sig", async (req, res) => {
  try {
    const tx = await connection.getTransaction(req.params.sig, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
    if (!tx) return res.status(404).json({ ok:false, error:"not found" });
    res.json({ ok:true, tx });
  } catch (e:any) {
    res.status(400).json({ ok:false, error: e.message });
  }
});

app.listen(8080, ()=> console.log("API Gateway listening on :8080"));


