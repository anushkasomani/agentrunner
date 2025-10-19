import express from "express";
import { v4 as uuid } from "uuid";
import fetch from "node-fetch";
import { Connection, PublicKey, Keypair, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, createTransferInstruction } from "@solana/spl-token";

const app = express();
app.use(express.json());

const CURRENCY = process.env.X402_CURRENCY || "USDC";
const PAYTO_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"); // USDC mint (devnet/mainnet)
const PAYTO_ADDRESS = new PublicKey("51j3b8cZkYwAeKA47rEGWs8vLm12RD82yAgHhYYhyimr"); // merchant USDC token account
const RPC = process.env.SOLANA_RPC_URL! || "https://wild-late-season.solana-devnet.quiknode.pro/b0ebcc50a76d22c777b9f18945f0d47e9f71ccaf";
const conn = new Connection(RPC, "confirmed");

// Load merchant signer for refunds
// const MERCHANT_PRIV = Uint8Array.from(JSON.parse(process.env.FEE_PAYER_SECRET_KEY!));
// const MERCHANT = Keypair.fromSecretKey(MERCHANT_PRIV);

type Invoice = { id: string; price_usd: number; currency: string; expires_at: number; paid?: boolean };
const INVOICES = new Map<string, Invoice>();

app.get("/price", (req, res) => {
const capability = String(req.query.capability || "generic");
const price = capability.includes("swap") ? 0.10 : 0.05;
res.set({
"X-402-Price": price.toFixed(2),
"X-402-Currency": CURRENCY,
"X-402-Description": `${capability} run (max 1 tx)`
});
res.json({ capability, price_usd: price, currency: CURRENCY });
});

app.post("/invoice", (req, res) => {
const { price_usd } = req.body || {};
const id = `inv_${uuid()}`;
const inv = { id, price_usd: Number(price_usd ?? 0.10), currency: CURRENCY, expires_at: Math.floor(Date.now()/1000)+600, paid:false };
INVOICES.set(id, inv);
res.status(402).set({
"X-402-Price": inv.price_usd.toFixed(2),
"X-402-Currency": inv.currency,
"X-402-Invoice": inv.id,
"X-402-PayTo": PAYTO_ADDRESS.toBase58()
}).json(inv);
});

app.post("/verify", async (req, res) => {
const { invoice, proof } = req.body || {};
const inv = INVOICES.get(String(invoice));
if (!inv) return res.status(400).json({ ok:false, error:"bad invoice" });
if (inv.paid) return res.json({ ok:true, invoice, status:"already_verified" });

try {
if (proof?.chain !== "solana") throw new Error("chain must be solana");
const tx = await conn.getTransaction(proof.txid, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
if (!tx?.meta) throw new Error("tx not found or no meta");


// naive check: ensure our token account received >= expected amount of the given mint
const post = tx.meta.postTokenBalances || [];
const pre = tx.meta.preTokenBalances || [];

let received = 0;
for (const pb of post) {
  const acc = tx.transaction.message.staticAccountKeys[pb.accountIndex].toBase58();
  if (acc === PAYTO_ADDRESS.toBase58() && pb.mint === proof.mint) {
    const preMatch = pre.find(x => x.accountIndex === pb.accountIndex);
    const delta = Number(pb.uiTokenAmount.uiAmount || 0) - Number(preMatch?.uiTokenAmount.uiAmount || 0);
    if (delta > 0) received += delta;
  }
}
if (received + 1e-9 < Number(proof.amount)) throw new Error(`payment shortfall: ${received} < ${proof.amount}`);

inv.paid = true;
return res.json({ ok:true, invoice, status:"verified" });

} catch (e:any) {
return res.status(400).json({ ok:false, error: e.message });
}
});

app.get("/get_invoices", async(req, res)=>{
  // Convert Map to object for JSON serialization
  const invoicesObject = Object.fromEntries(INVOICES);
  return res.json({ok:true, invoices: invoicesObject})
})

// app.post("/refund", async (req, res) => {
//   const { invoice, to, amount } = req.body || {};
//   const inv = INVOICES.get(String(invoice));
//   if (!inv) return res.status(400).json({ ok:false, error:"bad invoice" });
  
//   try {
//   const destOwner = new PublicKey(to);
//   const destAta = await getAssociatedTokenAddress(PAYTO_MINT, destOwner, false);
//   const ix = createTransferInstruction(PAYTO_ADDRESS, destAta, MERCHANT.publicKey, Number(amount) * 1_000_000); // 6 decimals
//   const tx = new Transaction().add(ix);
//   const sig = await sendAndConfirmTransaction(conn, tx, [MERCHANT], { skipPreflight: false });
//   res.json({ ok:true, txid: sig });
//   } catch (e:any) {
//   res.status(400).json({ ok:false, error: e.message });
//   }
//   });
  
app.listen(7003, ()=> console.log("x402 Merchant listening on :7003"));
  
