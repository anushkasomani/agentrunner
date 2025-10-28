'use client';

import React, { useState, useEffect } from 'react';
import { Bot, Code, User, Calendar, ExternalLink } from 'lucide-react';
import * as anchor from "@coral-xyz/anchor";
import { Connection } from '@solana/web3.js';
import { clusterApiUrl } from '@solana/web3.js';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import ClientOnlyWalletButton from '../components/ClientOnlyWalletButton';
import { IPFSService } from '../services/ipfs';

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
  serviceType: 'agent' | 'api'; // New field for service type
  charge: string;       // Price per call
  capability: string;    // Service capability/category
  apiEndpoint?: string; // For API services
  apiMethod?: string;   // For API services
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { connection } = useConnection();
  const { wallet, publicKey, connected, signTransaction } = useWallet();

  useEffect(() => {
    if (connected && publicKey && signTransaction) {
      fetchAgents();
    } else {
      setLoading(false);
    }
  }, [connected, publicKey, signTransaction]);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!publicKey || !signTransaction) {
        throw new Error('Wallet not connected');
      }
      
      // Create a wallet object that Anchor expects
      const anchorWallet = {
        publicKey,
        signTransaction,
        signAllTransactions: async (txs: any[]) => {
          return txs.map(tx => signTransaction(tx));
        }
      } as anchor.Wallet;
      
      const provider = new anchor.AnchorProvider(connection, anchorWallet, { preflightCommitment: "processed" });
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
      const agentsFromChain = await (program.account as any).agent?.all() || [];
      console.log('Raw agents from chain:', agentsFromChain);

      // 2. Filter agents based on your criteria (metadataUri starts with 'https')
      const filteredAgents = agentsFromChain.filter((agent: any) => 
        agent.account.metadataUri && typeof agent.account.metadataUri === 'string' && agent.account.metadataUri.startsWith('https://moccasin-broad-kiwi-732.mypinata.cloud')
      );
      console.log(`Found ${filteredAgents.length} agents with valid metadata URIs`);

      // 3. Create promises to fetch metadata for each filtered agent
      const agentPromises = filteredAgents.map(async (agentEntry: any) => {
        try {
          const onChainAccount = agentEntry.account;
          
          // Fetch the external JSON metadata using IPFS service
          const ipfsService = new IPFSService();
          const metadata = await ipfsService.fetchAgentMetadata(onChainAccount.metadataUri);
          
          if (!metadata) {
            throw new Error(`Failed to fetch metadata from ${onChainAccount.metadataUri}`);
          }

          // Get API service configuration if it's an API service
          const apiConfig = ipfsService.getAPIServiceConfig(metadata);

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
            codeUrl: metadata.code || '#', // Use metadata.code as codeUrl
            serviceType: metadata.service_type || 'agent',
            charge: metadata.charge || '0',
            capability: metadata.capability || 'other',
            apiEndpoint: apiConfig?.endpoint,
            apiMethod: apiConfig?.method,
          } as Agent;

        } catch (e) {
          console.error(`Failed to process agent ${agentEntry.publicKey.toString()}:`, e);
          return null; // Return null if fetching or parsing fails
        }
      });

      // 5. Wait for all metadata fetches to complete
      const settledAgents = await Promise.all(agentPromises);
      
      // 6. Filter out any agents that failed to load (returned null)
      const successfulAgents = settledAgents.filter((agent: any) => agent !== null) as Agent[];
      
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

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <Bot className="w-16 h-16 text-blue-600 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Connect Your Wallet</h2>
          <p className="text-gray-600 mb-8">
            Please connect your Solana wallet to view and interact with DeFi agents.
          </p>
          <ClientOnlyWalletButton 
            className="!bg-gradient-to-r !from-blue-600 !to-purple-600 hover:!from-blue-700 hover:!to-purple-700 !rounded-xl !font-semibold !px-8 !py-3 !shadow-lg hover:!shadow-xl !transform hover:!scale-105 !transition-all !duration-200" 
          />
        </div>
      </div>
    );
  }

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
        <div className="text-center max-w-md mx-auto px-6">
          <Bot className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => fetchAgents()}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/20 text-white text-sm font-medium mb-8">
            <Bot className="w-4 h-4 mr-2" />
            Agent Marketplace
          </div>
          <h1 className="text-5xl font-bold text-white mb-6">
            Discover DeFi Agents
          </h1>
          <p className="text-xl text-blue-100 max-w-3xl mx-auto mb-8">
            Browse and discover intelligent agents created by developers in our ecosystem. 
            Each agent is verified and ready to execute complex DeFi strategies.
          </p>
          <div className="flex items-center justify-center space-x-8 text-white">
            <div className="text-center">
              <div className="text-3xl font-bold">{agents.length}</div>
              <div className="text-blue-100">Available Agents</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">24/7</div>
              <div className="text-blue-100">Active Monitoring</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">99.9%</div>
              <div className="text-blue-100">Uptime</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Available Agents
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Browse and discover agents created by developers in our ecosystem.
          </p>
        </div>

        {agents.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Bot className="w-12 h-12 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              No Agents Found
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-md mx-auto">
              No agents with valid metadata were found. Be the first to deploy one and start building the future of DeFi!
            </p>
            <a
              href="/"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <Bot className="w-5 h-5 mr-2" />
              Deploy Your First Agent
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {agents.map((agent, index) => (
              <div
                key={agent.agentPda}
                className="group bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Agent Header */}
                <div className="p-6 pb-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200 ${
                        agent.serviceType === 'api' 
                          ? 'bg-gradient-to-r from-purple-500 to-pink-600' 
                          : 'bg-gradient-to-r from-blue-500 to-purple-600'
                      }`}>
                        {agent.serviceType === 'api' ? (
                          <ExternalLink className="w-8 h-8 text-white" />
                        ) : (
                          <Bot className="w-8 h-8 text-white" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                          {agent.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                          {truncateAddress(agent.agentId)}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            agent.serviceType === 'api'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                          }`}>
                            {agent.serviceType === 'api' ? 'API Service' : 'DeFi Agent'}
                          </span>
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-full">
                            {agent.capability}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">Active</span>
                    </div>
                  </div>

                  <p className="text-gray-600 dark:text-gray-300 mb-6 line-clamp-3 leading-relaxed">
                    {agent.description}
                  </p>
                </div>

                {/* Agent Details */}
                <div className="px-6 pb-4">
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <User className="w-4 h-4 mr-3 text-gray-400" />
                      <span className="font-medium">Author:</span>
                      <span className="ml-2 font-mono text-xs">{truncateAddress(agent.author)}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <Calendar className="w-4 h-4 mr-3 text-gray-400" />
                      <span className="font-medium">Created:</span>
                      <span className="ml-2">{formatDate(agent.timestamp)}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-3">
                    <a
                      href={agent.metadataUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 text-sm"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Metadata
                    </a>
                    {agent.serviceType === 'api' ? (
                      <a
                        href={agent.apiEndpoint}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 text-sm"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        API Endpoint
                      </a>
                    ) : (
                      <a
                        href={agent.codeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 text-sm"
                      >
                        <Code className="w-4 h-4 mr-2" />
                        Code
                      </a>
                    )}
                  </div>
                  
                  {/* Pricing Information */}
                  <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        Price per call:
                      </span>
                      <span className="text-lg font-bold text-green-600 dark:text-green-400">
                        ${parseFloat(agent.charge).toFixed(3)}
                      </span>
                    </div>
                    {agent.serviceType === 'api' && agent.apiMethod && (
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Method: <span className="font-mono font-medium">{agent.apiMethod}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Agent Footer */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Agent ID: {agent.agentPda.slice(0, 8)}...</span>
                    <span className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      Online
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}