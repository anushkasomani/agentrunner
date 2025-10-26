import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const idlPath = path.join(__dirname, '../../../programs/registry/target/idl/registry.json');
const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));

const RPC =
  process.env.SOLANA_RPC_URL ||
  "https://api.devnet.solana.com";

const PROGRAM_ID = new PublicKey("HXGQvWagr4soQviA3Lr9LPzVw5G1EmstnaivhYE3BCHK");
const agentId = process.env.AGENT_ID || "agent_1761428435017_zgfv8g2bu";
const AGENT_IDENTITY = new PublicKey(
  Buffer.from(agentId.padEnd(32, '\0')).slice(0, 32)
);

function loadValidator(): Keypair {
  const SECRET = [94,21,75,106,120,153,168,235,114,39,104,0,255,148,42,122,107,26,9,2,228,10,81,11,232,159,190,211,236,16,59,232,243,51,153,0,152,19,129,196,31,240,193,61,248,14,75,207,158,187,213,67,243,131,40,248,248,198,180,155,152,217,219,178];
  return Keypair.fromSecretKey(Uint8Array.from(SECRET));
}

function yyyymmdd(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export async function anchorMerkleRoot(hexRoot: string, day?: string) {
  const connection = new Connection(RPC, "confirmed");
  const validator = loadValidator();

  const wallet = {
    publicKey: validator.publicKey,
    signTransaction: async (tx: any) => {
      tx.partialSign(validator);
      return tx;
    },
    signAllTransactions: async (txs: any[]) => {
      txs.forEach((tx) => tx.partialSign(validator));
      return txs;
    },
  } as anchor.Wallet;

  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  // ✅ Use the normalized IDL — works in both ESM and CJS
  const program = new anchor.Program(idl, PROGRAM_ID, provider);

  const dayStr = day || "0";
  const dayU32 = parseInt(dayStr);
  const rootBytes = Buffer.from(hexRoot.replace(/^0x/, ""), "hex");
  const [agentPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('agent'), AGENT_IDENTITY.toBuffer()],
    PROGRAM_ID
  );

  const dayBuffer = Buffer.alloc(4);
  dayBuffer.writeUInt32LE(dayU32, 0);
  
  const [validationPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("validation"),
      AGENT_IDENTITY.toBuffer(),
      dayBuffer,
    ],
    PROGRAM_ID
  );


  try {
    const instruction = await program.methods
      .postValidation(dayU32, Array.from(rootBytes))
      .accounts({
        validator: validator.publicKey,
        agent: agentPda,
        validation: validationPda,
        system_program: SystemProgram.programId,
      })
      .instruction();

    const transaction = new Transaction().add(instruction);
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = validator.publicKey;
    
    transaction.sign(validator);
    
    const txSig = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: true,
      preflightCommitment: 'confirmed'
    });
    await connection.confirmTransaction(txSig);
    
    console.log({ txSig, date: dayStr });
    return { txSig, date: dayStr };
  } catch (error) {
    console.error('Transaction failed:', error);
    throw error;
  }
}

// anchorMerkleRoot(
//   "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
// );
