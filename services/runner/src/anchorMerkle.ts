import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { Program } from "@coral-xyz/anchor";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "registry.json"), "utf8"));

const merkleRoot = new Uint8Array(32).fill(1);

const RPC =
  process.env.SOLANA_RPC_URL ||
  "https://wild-late-season.solana-devnet.quiknode.pro/b0ebcc50a76d22c777b9f18945f0d47e9f71ccaf";
const PROGRAM_ID = new PublicKey("HXGQvWagr4soQviA3Lr9LPzVw5G1EmstnaivhYE3BCHK");
const AGENT_IDENTITY = new PublicKey(
  process.env.AGENT_IDENTITY || "ABBtVWcRYZd64waP5HJtKH9CyZLMSP5SbRQ7csuepu6w"
);

// Remove these lines - they'll be created inside the function

// Validator key signs the daily validation/anchor tx
function loadValidator(): Keypair {
  const VALIDATOR_SECRET_KEY = [
    94, 21, 75, 106, 120, 153, 168, 235, 114, 39, 104, 0, 255, 148, 42, 122, 107, 26, 9, 2,
    228, 10, 81, 11, 232, 159, 190, 211, 236, 16, 59, 232, 243, 51, 153, 0, 152, 19, 129,
    196, 31, 240, 193, 61, 248, 14, 75, 207, 158, 187, 213, 67, 243, 131, 40, 248, 248,
    198, 180, 155, 152, 217, 219, 178,
  ];
  const bytes = Uint8Array.from(VALIDATOR_SECRET_KEY);
  return Keypair.fromSecretKey(bytes);
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

  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  const program = new anchor.Program(idl as any, PROGRAM_ID, provider);

  const dayStr = day || yyyymmdd();
  const dayU32 = parseInt(dayStr);
  const rootBytes = Buffer.from(hexRoot.replace(/^0x/, ""), "hex");

  // Derive agent PDA
  const [agentPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), AGENT_IDENTITY.toBuffer()],
    PROGRAM_ID
  );

  // Derive validation PDA
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

  return { txid: txSig, date: dayStr };
}
