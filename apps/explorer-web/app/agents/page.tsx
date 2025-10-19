'use client'

import { useState, useEffect } from 'react'

interface Agent {
  id: string
  name: string
  description: string
  version: string
  owner: string
  skills: string[]
  status: string
  createdAt: string
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAgents()
  }, [])

  const fetchAgents = async () => {
    try {
      setLoading(true)
      // Mock data for now - in production, fetch from API
      const mockAgents: Agent[] = [
        {
          id: 'agent_1',
          name: 'DeFi Portfolio Manager',
          description: 'Automated portfolio rebalancing and optimization',
          version: '1.0.0',
          owner: '0x123...abc',
          skills: ['rebalance', 'swap'],
          status: 'active',
          createdAt: '2024-01-15T10:00:00Z'
        },
        {
          id: 'agent_2',
          name: 'Arbitrage Bot',
          description: 'Cross-DEX arbitrage opportunity detection and execution',
          version: '2.1.0',
          owner: '0x456...def',
          skills: ['swap'],
          status: 'active',
          createdAt: '2024-01-10T14:30:00Z'
        },
        {
          id: 'agent_3',
          name: 'Yield Farming Optimizer',
          description: 'Automated yield farming strategy optimization',
          version: '1.5.0',
          owner: '0x789...ghi',
          skills: ['swap', 'rebalance'],
          status: 'certifying',
          createdAt: '2024-01-20T09:15:00Z'
        }
      ]
      
      setAgents(mockAgents)
    } catch (err) {
      setError('Failed to fetch agents')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'certifying':
        return 'bg-yellow-100 text-yellow-800'
      case 'inactive':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Loading agents...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg">{error}</div>
          <button 
            onClick={fetchAgents}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Agent Catalog</h1>
          <p className="mt-2 text-lg text-gray-600">
            Discover and manage autonomous agents on Solana
          </p>
        </div>

        <div className="mb-6 flex justify-between items-center">
          <div className="flex space-x-4">
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
              All Agents
            </button>
            <button className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
              Active
            </button>
            <button className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
              Certifying
            </button>
          </div>
          <button className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
            Create New Agent
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <div key={agent.id} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    {agent.name}
                  </h3>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(agent.status)}`}>
                    {agent.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  {agent.description}
                </p>
                <div className="mt-4">
                  <div className="text-sm text-gray-500">
                    <span className="font-medium">Version:</span> {agent.version}
                  </div>
                  <div className="text-sm text-gray-500">
                    <span className="font-medium">Owner:</span> {agent.owner}
                  </div>
                  <div className="text-sm text-gray-500">
                    <span className="font-medium">Skills:</span> {agent.skills.join(', ')}
                  </div>
                </div>
                <div className="mt-6 flex space-x-3">
                  <button className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                    View Details
                  </button>
                  <button className="flex-1 bg-white text-indigo-600 border border-indigo-600 px-4 py-2 rounded-md hover:bg-indigo-50">
                    Execute
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {agents.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg">No agents found</div>
            <button className="mt-4 px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
              Create Your First Agent
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

