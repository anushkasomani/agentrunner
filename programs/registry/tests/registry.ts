import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Registry } from "../target/types/registry";
import { expect } from "chai";

describe("registry", () => {
  // Configure the client to use the local cluster.
  const provider=anchor.AnchorProvider.env();
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.registry as Program<Registry>;

  it("registers an agent and stores metadata", async () => {
    //create identity
    const identity= anchor.web3.Keypair.generate()
    const [agentPda] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), identity.publicKey.toBuffer()],
      program.programId
    );
    const metadataUri = "https://example.com/agent/123";
    await program.methods
      .registerAgent(identity.publicKey, metadataUri)
      .accounts({
        owner: provider.wallet.publicKey,
        agent: agentPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    const agentAccount = await program.account.agent.fetch(agentPda);
    // expect(agentAccount.identity.toBase58()).to.equal(identity.publicKey.toBase58());
    // expect(agentAccount.owner.toBase58()).to.equal(provider.wallet.publicKey.toBase58());
    expect(agentAccount.metadataUri).to.equal(metadataUri);
    // expect(agentAccount.bump).to.be.a("number");
    // expect(agentAccount.createdAt).to.be.a("number");
    // expect(agentAccount.createdAt).to.be.greaterThan(0);
    
  });
})