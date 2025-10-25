import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Registry } from "../target/types/registry";
import { expect } from "chai";

describe("registry", async () => {
  // Configure the client to use the local cluster.
  const provider=anchor.AnchorProvider.env();
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.registry as Program<Registry>;

  const identity= anchor.web3.Keypair.generate()
  const [agentPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), identity.publicKey.toBuffer()],
    program.programId
  );

  const metadataUri = "https://example.com/agent/123";
  const metadataUri2="dummy_metadata_uri"
  const day = 20251024;
  const merkleRoot = new Uint8Array(32).fill(1);
  const reviewer = anchor.web3.Keypair.generate();
  // await provider.connection.requestAirdrop(reviewer.publicKey,2* anchor.web3.LAMPORTS_PER_SOL)

  it("registers an agent and stores metadata", async () => {
    await program.methods
      .registerAgent(identity.publicKey, metadataUri)
      .accounts({
        owner: provider.wallet.publicKey,
        agent: agentPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    const agentAccount = await program.account.agent.fetch(agentPda);
    expect(agentAccount.identity.toBase58()).to.equal(identity.publicKey.toBase58());
    // expect(agentAccount.owner.toBase58()).to.equal(provider.wallet.publicKey.toBase58());
    expect(agentAccount.metadataUri).to.equal(metadataUri);
    // expect(agentAccount.bump).to.be.a("number");
    // expect(agentAccount.createdAt).to.be.a("number");
    // expect(agentAccount.createdAt).to.be.greaterThan(0);
    
  });

  it("update_agent - updates metadata URI", async () => {
    await program.methods
      .updateAgent(metadataUri2)
      .accounts({
        owner: provider.wallet.publicKey,
        agent: agentPda,
      })
      .rpc();

    const updated = await program.account.agent.fetch(agentPda);
    expect(updated.metadataUri).to.equal(metadataUri2);
  });

  it("post_validation - posts daily merkle root", async () => {
    const [validationPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("validation"),
        identity.publicKey.toBuffer(),
        new anchor.BN(day).toArrayLike(Buffer, "le", 4),
      ],
      program.programId
    );

    await program.methods
      .postValidation(day, Array.from(merkleRoot))
      .accounts({
        validator: provider.wallet.publicKey,
        agent: agentPda,
        validation: validationPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const v = await program.account.validation.fetch(validationPda);
    expect(v.dayYyyymmdd).to.equal(day);
    expect(Buffer.from(v.merkleRoot).toString("hex")).to.equal(Buffer.from(merkleRoot).toString("hex"));
  });
  

  it("post_feedback - posts rating and tag", async () => {

    const [feedbackPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("feedback"),
        identity.publicKey.toBuffer(),
        reviewer.publicKey.toBuffer(),
      ],
      program.programId
    );

    const rating = 90;
    const tag = 3;

    const tx = await program.methods
      .postFeedback(rating, tag)
      .accounts({
        reviewer: reviewer.publicKey,
        agent: agentPda,
        feedback: feedbackPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([reviewer])
      .rpc();

    const f = await program.account.feedback.fetch(feedbackPda);
    expect(f.rating).to.equal(rating);
    expect(f.tag).to.equal(tag);
    expect(f.reviewer.toBase58()).to.equal(reviewer.publicKey.toBase58());
  });
})