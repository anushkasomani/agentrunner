import { NextResponse } from 'next/server';
import * as anchor from "@coral-xyz/anchor";
import { Connection } from '@solana/web3.js';
import { clusterApiUrl } from '@solana/web3.js';

export async function GET() {
  try {
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
    const wallet = {} as any; // Empty wallet for read-only access
    const provider = new anchor.AnchorProvider(connection, wallet, { preflightCommitment: "processed" });
    
    // Load IDL
    let idl;
    try {
      const idlModule = await import('../../services/registry-idl.json');
      idl = idlModule.default;
    } catch {
      const idlResponse = await fetch('http://localhost:3000/services/registry-idl.json');
      idl = await idlResponse.json();
    }
    
    const program = new anchor.Program(idl, provider);

    // Fetch agents from blockchain
    const agentsFromChain = await program.account.agent.all();
    console.log(`Found ${agentsFromChain.length} agents on chain`);

    // Filter agents with valid metadata URIs
    const validAgents = agentsFromChain.filter((agent: any) => 
      agent.account.metadataUri && typeof agent.account.metadataUri === 'string' && agent.account.metadataUri.startsWith('https')
    );

    console.log(`Found ${validAgents.length} agents with valid metadata URIs`);

    // Process each agent and fetch metadata
    const agentsWithMetadata = await Promise.all(
      validAgents.map(async (agentEntry: any) => {
        try {
          const onChainAccount = agentEntry.account;
          
          // Fetch the external JSON metadata
          const response = await fetch(onChainAccount.metadataUri);
          if (!response.ok) {
            throw new Error(`Failed to fetch metadata from ${onChainAccount.metadataUri}`);
          }
          const metadata = await response.json();

          return {
            // On-chain data
            agentPda: agentEntry.publicKey.toString(),
            agentId: onChainAccount.identity.toString(),
            author: onChainAccount.owner.toString(),
            timestamp: onChainAccount.createdAt.toNumber(),
            metadataUrl: onChainAccount.metadataUri,
            
            // Metadata JSON data
            name: metadata.name,
            description: metadata.description,
            capability: metadata.capability || "generic",
            charge: metadata.charge || "0.1",
            codeUrl: metadata.codeUrl || '#',
          };
        } catch (error) {
          console.error(`Failed to process agent ${agentEntry.publicKey.toString()}:`, error);
          return null;
        }
      })
    );

    // Filter out failed agents
    const successfulAgents = agentsWithMetadata.filter(agent => agent !== null);

    return NextResponse.json({
      ok: true,
      agents: successfulAgents,
      count: successfulAgents.length
    });

  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}
