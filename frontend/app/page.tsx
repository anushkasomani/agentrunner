'use client';

import AgentRegistrationForm from './components/AgentRegistrationForm';
import { useWallet } from '@solana/wallet-adapter-react';
import { Bot, Wallet, Zap, Shield, Globe, ArrowRight, Star, Users, Activity } from 'lucide-react';

export default function Home() {
  const { connected } = useWallet();

  return (
    <div className="min-h-screen">

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-600/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-sm font-medium mb-8 animate-fade-in">
              <Zap className="w-4 h-4 mr-2" />
              Next-Generation DeFi Automation
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 animate-slide-up">
              Deploy AI Agents on
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> Solana</span>
            </h1>
            
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8 animate-slide-up">
              Create, deploy, and manage intelligent DeFi agents that execute complex strategies automatically. 
              Built on Solana for lightning-fast transactions and minimal fees.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12 animate-scale-in">
              <a
                href="/chat"
                className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Start Building
                <ArrowRight className="w-5 h-5 ml-2" />
              </a>
              <a
                href="/agents"
                className="inline-flex items-center px-8 py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-semibold rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <Users className="w-5 h-5 mr-2" />
                Browse Agents
              </a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto animate-fade-in">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">24+</div>
                <div className="text-gray-600 dark:text-gray-400">Active Agents</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">1,247</div>
                <div className="text-gray-600 dark:text-gray-400">Transactions</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">94.2%</div>
                <div className="text-gray-600 dark:text-gray-400">Success Rate</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Agent Registration Section */}
      <section className="py-20 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Deploy Your Agent
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Connect your Solana wallet and deploy your agent code to IPFS. 
              Your agent will be registered on-chain and ready to execute tasks.
            </p>
          </div>

          <div className="flex justify-center">
            {connected ? (
              <div className="w-full max-w-4xl animate-scale-in">
                <AgentRegistrationForm />
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-12 text-center max-w-md animate-scale-in border border-gray-200 dark:border-gray-700">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Wallet className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  Connect Your Wallet
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-8">
                  Please connect your Solana wallet to start deploying agents and accessing the full platform.
                </p>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Supported wallets: Phantom, Solflare, Torus, and more
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Why Choose AgentRunner?
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Built for the future of DeFi with cutting-edge technology and user-friendly design.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700 group">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200">
                <Wallet className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Multi-Wallet Support
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Connect with Phantom, Solflare, Torus, and other popular Solana wallets seamlessly.
              </p>
              <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium">
                <span className="text-sm">Learn more</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700 group">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                IPFS Integration
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Upload your agent code and metadata to IPFS for decentralized, permanent storage.
              </p>
              <div className="flex items-center text-green-600 dark:text-green-400 font-medium">
                <span className="text-sm">Learn more</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700 group">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                On-Chain Registry
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Register your agent on the Solana blockchain for transparent, verifiable deployment.
              </p>
              <div className="flex items-center text-purple-600 dark:text-purple-400 font-medium">
                <span className="text-sm">Learn more</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700 group">
              <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Lightning Fast
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Built on Solana for sub-second transaction times and minimal fees.
              </p>
              <div className="flex items-center text-orange-600 dark:text-orange-400 font-medium">
                <span className="text-sm">Learn more</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700 group">
              <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-pink-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200">
                <Globe className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Decentralized
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Fully decentralized platform with no single point of failure.
              </p>
              <div className="flex items-center text-pink-600 dark:text-pink-400 font-medium">
                <span className="text-sm">Learn more</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700 group">
              <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200">
                <Activity className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Real-time Analytics
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Monitor agent performance with comprehensive analytics and insights.
              </p>
              <div className="flex items-center text-indigo-600 dark:text-indigo-400 font-medium">
                <span className="text-sm">Learn more</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Build the Future of DeFi?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
            Join thousands of developers building intelligent DeFi agents on Solana. 
            Start your journey today with our comprehensive platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/chat"
              className="inline-flex items-center px-8 py-4 bg-white text-blue-600 font-semibold rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <Zap className="w-5 h-5 mr-2" />
              Start Building Now
            </a>
            <a
              href="/agents"
              className="inline-flex items-center px-8 py-4 bg-transparent text-white font-semibold rounded-xl border-2 border-white hover:bg-white hover:text-blue-600 transition-all duration-200"
            >
              <Users className="w-5 h-5 mr-2" />
              Explore Agents
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
