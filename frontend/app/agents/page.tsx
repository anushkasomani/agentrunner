'use client';

import React, { useState, useEffect } from 'react';
import { Bot, Code, User, Calendar, ExternalLink } from 'lucide-react';
import axios from 'axios';

interface Agent {
  agentId: string;
  agentPda: string;
  identity: string;
  metadataUrl: string;
  codeUrl: string;
  name: string;
  description: string;
  author: string;
  timestamp: number;
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
      // In a real implementation, you'd fetch from your API or IPFS
      // For now, we'll simulate with some mock data
      const mockAgents: Agent[] = [
        {
          agentId: 'agent_1234567890_abc123',
          agentPda: 'HXGQvWagr4soQviA3Lr9LPzVw5G1EmstnaivhYE3BCHK',
          identity: 'ABBtVWcRYZd64waP5HJtKH9CyZLMSP5SbRQ7csuepu6w',
          metadataUrl: 'https://gateway.pinata.cloud/ipfs/QmExample1',
          codeUrl: 'https://gateway.pinata.cloud/ipfs/QmExample2',
          name: 'Swap Agent',
          description: 'Automatically executes token swaps on Raydium with optimal pricing',
          author: 'ABBtVWcRYZd64waP5HJtKH9CyZLMSP5SbRQ7csuepu6w',
          timestamp: Date.now() - 86400000,
        },
        {
          agentId: 'agent_1234567891_def456',
          agentPda: 'HXGQvWagr4soQviA3Lr9LPzVw5G1EmstnaivhYE3BCHK',
          identity: 'ABBtVWcRYZd64waP5HJtKH9CyZLMSP5SbRQ7csuepu6w',
          metadataUrl: 'https://gateway.pinata.cloud/ipfs/QmExample3',
          codeUrl: 'https://gateway.pinata.cloud/ipfs/QmExample4',
          name: 'Rebalance Agent',
          description: 'Monitors portfolio and rebalances assets based on target allocations',
          author: 'ABBtVWcRYZd64waP5HJtKH9CyZLMSP5SbRQ7csuepu6w',
          timestamp: Date.now() - 172800000,
        },
      ];
      
      setAgents(mockAgents);
    } catch (err) {
      setError('Failed to fetch agents');
      console.error('Error fetching agents:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const truncateAddress = (address: string) => {
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
              Be the first to deploy an agent to our platform!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <div
                key={agent.agentId}
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
