import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
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
const AGENT_IDENTITY = new PublicKey(
  process.env.AGENT_IDENTITY || "ABBtVWcRYZd64waP5HJtKH9CyZLMSP5SbRQ7csuepu6w"
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

  const dayStr = day || yyyymmdd();
  const dayU32 = parseInt(dayStr);
  const rootBytes = Buffer.from(hexRoot.replace(/^0x/, ""), "hex");

  const [agentPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), AGENT_IDENTITY.toBuffer()],
    PROGRAM_ID
  );

  const [validationPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("validation"),
      AGENT_IDENTITY.toBuffer(),
      new anchor.BN(dayU32).toArrayLike(Buffer, "le", 4),
    ],
    PROGRAM_ID
  );

  const txSig = await program.methods
    .postValidation(dayU32, Array.from(rootBytes))
    .accounts({
      validator: validator.publicKey,
      agent: agentPda,
      validation: validationPda,
      systemProgram: SystemProgram.programId,
    })
    .signers([validator])
    .rpc();

  console.log({ txSig, date: dayStr });
  return { txSig, date: dayStr };
}

anchorMerkleRoot(
  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
);
