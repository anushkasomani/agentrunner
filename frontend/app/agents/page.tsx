'use client';

import React, { useState, useEffect } from 'react';
import { Bot, Code, User, Calendar, ExternalLink } from 'lucide-react';
import * as anchor from "@coral-xyz/anchor";
import { Connection } from '@solana/web3.js';
import { clusterApiUrl } from '@solana/web3.js';

// This interface matches your UI's needs
interface Agent {
  agentId: string;      // Mapped from on-chain 'identity'
  agentPda: string;     // The account's public key
  metadataUrl: string;  // Mapped from on-chain 'metadataUri'
  codeUrl: string;      // Fetched from metadata JSON
  name: string;         // Fetched from metadata JSON
  description: string;  // Fetched from metadata JSON
  author: string;       // Mapped from on-chain 'owner'
  timestamp: number;    // Mapped from on-chain 'createdAt'
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
      const wallet = window.solana as any;
      if (!wallet) {
        throw new Error('Wallet not found');
      }
      const provider = new anchor.AnchorProvider(connection, wallet, { preflightCommitment: "processed" });
      let idl;
      try {
        const idlModule = await import('../services/registry-idl.json');
        idl = idlModule.default;
      } catch {
        // Fallback to fetch
        const idlResponse = await fetch('/services/registry-idl.json');
        idl = await idlResponse.json();
      }
      const program = new anchor.Program(idl, provider);

      // 1. Fetch the raw on-chain account data
      const agentsFromChain = await program.account.agent.all();
      console.log('Raw agents from chain:', agentsFromChain);

      // 2. Filter agents based on your criteria (metadataUri starts with 'https')
      const filteredAgents = agentsFromChain.filter(agent => 
        agent.account.metadataUri && agent.account.metadataUri.startsWith('https')
      );
      console.log(`Found ${filteredAgents.length} agents with valid metadata URIs`);

      // 3. Create promises to fetch metadata for each filtered agent
      const agentPromises = filteredAgents.map(async (agentEntry) => {
        try {
          const onChainAccount = agentEntry.account;
          
          // Fetch the external JSON metadata
          const response = await fetch(onChainAccount.metadataUri);
          if (!response.ok) {
            throw new Error(`Failed to fetch metadata from ${onChainAccount.metadataUri}`);
          }
          const metadata = await response.json();

          // 4. Combine on-chain data and metadata JSON data
          return {
            // --- From On-chain Account ---
            agentPda: agentEntry.publicKey.toString(),
            agentId: onChainAccount.identity.toString(), // Use 'identity'
            author: onChainAccount.owner.toString(),     // Use 'owner'
            timestamp: onChainAccount.createdAt.toNumber(), // Use 'createdAt'
            metadataUrl: onChainAccount.metadataUri,
            
            // --- From Fetched Metadata JSON ---
            name: metadata.name,
            description: metadata.description,
            codeUrl: metadata.codeUrl || '#', // Use '#' as fallback if codeUrl isn't in JSON
          } as Agent;

        } catch (e) {
          console.error(`Failed to process agent ${agentEntry.publicKey.toString()}:`, e);
          return null; // Return null if fetching or parsing fails
        }
      });

      // 5. Wait for all metadata fetches to complete
      const settledAgents = await Promise.all(agentPromises);
      
      // 6. Filter out any agents that failed to load (returned null)
      const successfulAgents = settledAgents.filter(agent => agent !== null) as Agent[];
      
      console.log('Final formatted & populated agents:', successfulAgents);
      setAgents(successfulAgents);

    } catch (err) {
      console.error('Error in fetchAgents:', err);
      setError('Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    // On-chain timestamps are often in seconds. Multiply by 1000 for JS Date (milliseconds).
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const truncateAddress = (address: string | null | undefined) => {
    if (!address || address.length < 8) {
      return address || '...';
    }
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Bot className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-pulse" />
          <h2 className="text-xl font-semibold text-gray-700">Loading Agents...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Bot className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Bot className="w-8 h-8 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">Agent Directory</h1>
            </div>
            <div className="text-sm text-gray-500">
              {agents.length} agents available
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Available Agents
          </h2>
          <p className="text-lg text-gray-600">
            Browse and discover agents created by developers in our ecosystem.
          </p>
        </div>

        {agents.length === 0 ? (
          <div className="text-center py-12">
            <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              No Agents Found
            </h3>
            <p className="text-gray-500">
              No agents with valid metadata were found. Be the first to deploy one!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <div
                key={agent.agentPda} // Use the unique PDA for the key
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Bot className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {agent.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        ID: {truncateAddress(agent.agentId)}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-gray-600 mb-4 line-clamp-3">
                  {agent.description}
                </p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-500">
                    <User className="w-4 h-4 mr-2" />
                    <span>Author: {truncateAddress(agent.author)}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-500">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>Created: {formatDate(agent.timestamp)}</span>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <a
                    href={agent.metadataUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Metadata
                  </a>
                  <a
                    href={agent.codeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                  >
                    <Code className="w-4 h-4 mr-1" />
                    Code
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}