import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction } from "@solana/spl-token";


const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const RUNNER =  "http://localhost:7001";
const PLANNER = "http://localhost:7002";
const X402 = "http://localhost:7003";
const BROKER = "http://localhost:7004";
const CERT = "http://localhost:7005";

// Solana setup
const RPC = process.env.SOLANA_RPC_URL || "https://wild-late-season.solana-devnet.quiknode.pro/b0ebcc50a76d22c777b9f18945f0d47e9f71ccaf";
const conn = new Connection(RPC, "confirmed");
const PAYTO_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"); // USDC mint
const PAYTO_ADDRESS = new PublicKey("HNMhpZQuQ3aJ1ePix4Q8afwUxDFmGNC4ReknNgFmNbq3"); // merchant USDC token account (from x402-merchant)
export const PAYER_SECRET_KEY=[94,21,75,106,120,153,168,235,114,39,104,0,255,148,42,122,107,26,9,2,228,10,81,11,232,159,190,211,236,16,59,232,243,51,153,0,152,19,129,196,31,240,193,61,248,14,75,207,158,187,213,67,243,131,40,248,248,198,180,155,152,217,219,178]
const PAYER_PRIV = Uint8Array.from(PAYER_SECRET_KEY);
const PAYER = PAYER_PRIV ? Keypair.fromSecretKey(PAYER_PRIV) : null;

export async function makePayment(invoice: string): Promise<any> {
    if (!PAYER) {
        throw new Error("PAYER_SECRET_KEY not set");
    }
    
    
    const invoiceData = JSON.parse(invoice);
    const amount = 0.001; 
    
    try {
        // Get payer's USDC token account
        const payerAta = await getAssociatedTokenAddress(PAYTO_MINT, PAYER.publicKey, false);
        
        // Get merchant's USDC token account (derive ATA)
        const merchantPubkey = new PublicKey("51j3b8cZkYwAeKA47rEGWs8vLm12RD82yAgHhYYhyimr");
        const receiverAta = await getAssociatedTokenAddress(PAYTO_MINT, merchantPubkey, false);
        
        // Check if payer has USDC token account, create if not
        const payerAccountInfo = await conn.getAccountInfo(payerAta);
        if (!payerAccountInfo) {
            console.log("Creating payer USDC token account...");
            const createPayerAccountIx = createAssociatedTokenAccountInstruction(
                PAYER.publicKey, // payer
                payerAta, // ata
                PAYER.publicKey, // owner
                PAYTO_MINT // mint
            );
            const createTx = new Transaction().add(createPayerAccountIx);
            await sendAndConfirmTransaction(conn, createTx, [PAYER], { commitment: "confirmed" });
        }
        
        // Check if merchant has USDC token account, create if not
        const receiverAccountInfo = await conn.getAccountInfo(receiverAta);
        if (!receiverAccountInfo) {
            console.log("Creating merchant USDC token account...");
            const createReceiverAccountIx = createAssociatedTokenAccountInstruction(
                PAYER.publicKey, // payer (payer pays for creation)
                receiverAta, // ata
                merchantPubkey, // owner (merchant's public key)
                PAYTO_MINT // mint
            );
            const createTx = new Transaction().add(createReceiverAccountIx);
            await sendAndConfirmTransaction(conn, createTx, [PAYER], { commitment: "confirmed" });
        }
        
        // Create transfer instruction
        const transferIx = createTransferInstruction(
            payerAta,
            receiverAta,
            PAYER.publicKey,
            1000 // Exactly 1000 (0.001 USDC in 6 decimals)
        );
        
        // Create and send transaction
        const tx = new Transaction().add(transferIx);
        const signature = await sendAndConfirmTransaction(conn, tx, [PAYER], { 
            skipPreflight: false,
            commitment: "confirmed"
        });
        
        return {
            chain: "solana",
            txid: signature,
            mint: PAYTO_MINT.toBase58(),
            amount: amount * 1_000_000
        };
    } catch (error: any) {
        throw new Error(`Payment failed: ${error.message}`);
    }
}

app.post('/run', async(req,res)=>{
    // 1. Get invoice
    const invoiceResp = await fetch(`${X402}/invoice`, { 
        method:"POST", 
        headers:{ "content-type":"application/json" }, 
        body: JSON.stringify(req.body || {}) 
    });
    
    if (invoiceResp.status !== 402) {
        return res.status(invoiceResp.status).set(Object.fromEntries(invoiceResp.headers)).send(await invoiceResp.text());
    }
    
    const invoiceData = await invoiceResp.json();
    const invoiceId = invoiceData.id; // Extract the invoice ID
    
    // 2. Make payment (implement your payment logic here)
    const proof = await makePayment(JSON.stringify(invoiceData)); // Pass full invoice data
    
    // 3. Verify payment
    const verifyResp = await fetch(`${X402}/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invoice: invoiceId, proof }) // Send invoice ID, not full data
    });
    
    if (!verifyResp.ok) {
        return res.status(verifyResp.status).send(await verifyResp.text());
    }
    
    // 4. Now call runner
    const runnerResp = await fetch(`${RUNNER}/run/skill/swap`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req.body)
    });
    
    if (!runnerResp.ok) {
        return res.status(runnerResp.status).send(await runnerResp.text());
    }
    
    // 5. Call anchor/daily after successful runner execution
    try {
        const anchorResp = await fetch(`${RUNNER}/anchor/daily`, {
            method: "POST",
            headers: { "content-type": "application/json" }
        });
        
        const anchorData = await anchorResp.json();
        console.log("Anchor daily result:", anchorData);
    } catch (anchorError) {
        console.error("Anchor daily call failed:", anchorError);
        // Continue execution even if anchor fails
    }
    
    res.status(runnerResp.status).set(Object.fromEntries(runnerResp.headers)).send(await runnerResp.text());
});

app.listen(8090, () => console.log("Run service listening on :8090"));