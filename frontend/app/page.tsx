'use client';

import { WalletMultiButton, WalletDisconnectButton } from './components/WalletProvider';
import AgentRegistrationForm from './components/AgentRegistrationForm';
import { useWallet } from '@solana/wallet-adapter-react';
import { Bot, Wallet } from 'lucide-react';

export default function Home() {
  const { connected } = useWallet();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Bot className="w-8 h-8 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">AgentRunner</h1>
            </div>
            <div className="flex items-center space-x-4">
              <a
                href="/agents"
                className="px-4 py-2 text-gray-700 hover:text-blue-600 transition-colors font-medium"
              >
                Browse Agents
              </a>
              <WalletMultiButton 
                className="!bg-blue-600 hover:!bg-blue-700 !rounded-lg !px-6 !py-2 !text-white !font-semibold"
                style={{ 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontWeight: '600'
                }}
              />
              {connected && <WalletDisconnectButton />}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Deploy Your Solana Agent
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Connect your Solana wallet and deploy your agent code to IPFS. 
            Your agent will be registered on-chain and ready to execute tasks.
          </p>
        </div>

        <div className="flex justify-center">
          {connected ? (
            <AgentRegistrationForm />
          ) : (
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <Wallet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Connect Your Wallet
              </h3>
              <p className="text-gray-600 mb-6">
                Please connect your Solana wallet to start deploying agents.
              </p>
              <WalletMultiButton 
                className="!bg-blue-600 hover:!bg-blue-700 !rounded-lg !px-6 !py-2 !text-white !font-semibold"
                style={{ 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontWeight: '600'
                }}
              />
            </div>
          )}
        </div>

        {/* Features Section */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Solana Wallet
            </h3>
            <p className="text-gray-600">
              Connect with Phantom, Solflare, or other Solana wallets
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Bot className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Agent Deployment
            </h3>
            <p className="text-gray-600">
              Upload your agent code and metadata to IPFS
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Bot className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              On-Chain Registry
            </h3>
            <p className="text-gray-600">
              Register your agent on the Solana blockchain
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
