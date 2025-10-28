'use client';

import React, { useEffect, useState } from 'react';
import ChatFeed from '../components/ChatFeed';
import Composer from '../components/Composer';
import { WalletMultiButton } from '@/app/components/WalletProvider';
import { useWallet } from '@solana/wallet-adapter-react';
import { callPlanner, summarizePlan } from '../services/planner';
import { MessageCircle, AlertCircle } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
  id: string;
  loadingState?: 'planning' | 'rfp' | 'offers' | 'hiring' | 'executing' | 'completed';
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: 'Tell me your DeFi goal…',
  ts: Date.now(),
  id: 'initial-message'
};

const QUICK_ACTIONS = [
  'Swap 1 SOL → USDC (≤30bps)',
  'Rebalance to 60/30/10',
  'Exit LP position to USDC',
];

const CHAT_BUTTONS = [
  {
    label: 'View Agent Registry',
    action: () => {
      // Navigate to agents page or open modal
      window.location.href = '/agents';
    },
    icon: '🤖'
  },
  {
    label: 'Register New Agent',
    action: () => {
      // Navigate to agent registration
      window.location.href = '/agents';
    },
    icon: '➕'
  }
];

export default function ChatPage() {
  const { publicKey } = useWallet();
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [loading, setLoading] = useState(false);
  const [budget, setBudget] = useState(0.2);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage on mount and when wallet changes
  useEffect(() => {
    try {
      const storageKey = publicKey ? `ar-chat-${publicKey.toString()}` : 'ar-chat-anonymous';
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Ensure all messages have unique IDs
          const messagesWithIds = parsed.map((msg: any, index: number) => ({
            ...msg,
            id: msg.id || `${msg.role}-${msg.ts}-${index}-${Math.random().toString(36).substr(2, 9)}`
          }));
          setMessages(messagesWithIds);
        } else {
          setMessages([INITIAL_MESSAGE]);
        }
      } else {
        setMessages([INITIAL_MESSAGE]);
      }
    } catch (error) {
      console.error('Failed to hydrate messages:', error);
      setMessages([INITIAL_MESSAGE]);
    }

    setIsHydrated(true);
  }, [publicKey]);

  // Persist messages to localStorage
  useEffect(() => {
    if (isHydrated) {
      try {
        const storageKey = publicKey ? `ar-chat-${publicKey.toString()}` : 'ar-chat-anonymous';
        localStorage.setItem(storageKey, JSON.stringify(messages));
      } catch (error) {
        console.error('Failed to save messages:', error);
      }
    }
  }, [messages, isHydrated, publicKey]);

  // Clear messages when wallet disconnects
  useEffect(() => {
    if (isHydrated && !publicKey) {
      setMessages([INITIAL_MESSAGE]);
    }
  }, [publicKey, isHydrated]);

  const handleSend = async (text: string, budgetAmount: number) => {
    // Guard against double-submit
    if (loading) return;

    // Add user message
    const userMessage: Message = {
      role: 'user',
      content: text,
      ts: Date.now(),
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      // Step 1: Call planner
      console.log('🚀 Starting execution flow...');
      console.log('📝 User request:', text);
      console.log('💰 Budget:', budgetAmount);
      
      const planningMessage: Message = {
        role: 'assistant',
        content: '🤖 Planning your DeFi strategy...',
        ts: Date.now(),
        id: `planning-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        loadingState: 'planning'
      };
      setMessages((prev) => [...prev, planningMessage]);

      console.log('📞 Calling planner service...');
      const plan = await callPlanner(text, budgetAmount);
      console.log('✅ Plan received:', JSON.stringify(plan, null, 2));
      
      const { summary } = summarizePlan(plan);
      console.log('📋 Plan summary:', summary);

      // Show plan details first
      const planDetailsMessage: Message = {
        role: 'assistant',
        content: `📋 **Plan Generated!**\n\n${summary}\n\n**Plan Details:**\n\`\`\`json\n${JSON.stringify(plan, null, 2)}\n\`\`\`\n\n🎯 **Next:** Creating RFP for agent hiring...`,
        ts: Date.now(),
        id: `plan-details-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        loadingState: 'completed'
      };
      setMessages((prev) => [...prev.slice(0, -1), planDetailsMessage]);

      // Step 2: Create RFP
      console.log('📋 Creating RFP...');
      const rfpMessage: Message = {
        role: 'assistant',
        content: '📋 Creating Request for Proposal...',
        ts: Date.now(),
        id: `rfp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        loadingState: 'rfp'
      };
      setMessages((prev) => [...prev, rfpMessage]);

      const rfpPayload = {
        capability: plan.steps[0]?.capability || 'generic',
        inputs: plan.steps[0]?.inputs || {},
        constraints: plan.steps[0]?.constraints || {},
        budget_usd: budgetAmount,
        slo: plan.steps[0]?.slo || { p95_ms: 3000 }
      };
      console.log('📤 RFP payload:', JSON.stringify(rfpPayload, null, 2));

      const rfpResponse = await fetch('/api/broker?path=/rfp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rfpPayload)
      });

      console.log('📥 RFP response status:', rfpResponse.status);
      if (!rfpResponse.ok) {
        const errorText = await rfpResponse.text();
        console.error('❌ RFP creation failed:', errorText);
        throw new Error(`RFP creation failed: ${errorText}`);
      }

      const rfpData = await rfpResponse.json();
      const rfpId = rfpData.rfp_id;
      console.log('✅ RFP created with ID:', rfpId);

      // Update with RFP success
      const rfpSuccessMessage: Message = {
        role: 'assistant',
        content: `✅ **RFP Created!**\n\n**RFP ID:** \`${rfpId}\`\n**Capability:** ${plan.steps[0]?.capability || 'generic'}\n**Budget:** $${budgetAmount}\n\n💰 **Next:** Fetching agent offers...`,
        ts: Date.now(),
        id: `rfp-success-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        loadingState: 'offers'
      };
      setMessages((prev) => [...prev.slice(0, -1), rfpSuccessMessage]);

      // Step 3: Get offers
      console.log('💰 Fetching offers...');

      const offersResponse = await fetch(`/api/broker?path=/rfp/${rfpId}/offers`);
      console.log('📥 Offers response status:', offersResponse.status);
      
      if (!offersResponse.ok) {
        const errorText = await offersResponse.text();
        console.error('❌ Failed to get offers:', errorText);
        throw new Error(`Failed to get offers: ${errorText}`);
      }

      const offersData = await offersResponse.json();
      const offers = offersData.offers;
      console.log('✅ Offers received:', JSON.stringify(offers, null, 2));

      // Show offers received
      const offersList = offers.map((o: any, idx: number) => 
        `${idx + 1}. **Agent:** ${o.agent_id}\n   💰 **Price:** $${o.price_usd}\n   ⏱️ **ETA:** ${o.eta_ms}ms\n   📊 **Confidence:** ${(o.confidence * 100).toFixed(0)}%`
      ).join('\n\n');

      const offersSuccessMessage: Message = {
        role: 'assistant',
        content: `💰 **Offers Received!**\n\n**Found ${offers.length} agent(s):**\n\n${offersList}\n\n🎯 **Next:** Selecting best agent...`,
        ts: Date.now(),
        id: `offers-success-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        loadingState: 'hiring'
      };
      setMessages((prev) => [...prev.slice(0, -1), offersSuccessMessage]);

      // Step 4: Hire best agent
      console.log('🎯 Hiring best agent...');

      const hireResponse = await fetch('/api/broker?path=/hire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rfp_id: rfpId })
      });

      console.log('📥 Hire response status:', hireResponse.status);
      if (!hireResponse.ok) {
        const errorText = await hireResponse.text();
        console.error('❌ Hiring failed:', errorText);
        throw new Error(`Hiring failed: ${errorText}`);
      }

      const hireData = await hireResponse.json();
      const hiredAgent = hireData.hired;
      console.log('✅ Agent hired:', JSON.stringify(hiredAgent, null, 2));

      // Show hired agent details
      const hiredAgentMessage: Message = {
        role: 'assistant',
        content: `🎯 **Agent Hired!**\n\n**Agent ID:** \`${hiredAgent.agent_id}\`\n**Price:** $${hiredAgent.price_usd}\n**ETA:** ${hiredAgent.eta_ms}ms\n**Score:** ${hiredAgent.score?.toFixed(2) || 'N/A'}\n\n⚡ **Next:** Executing transaction...`,
        ts: Date.now(),
        id: `hired-agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        loadingState: 'executing'
      };
      setMessages((prev) => [...prev.slice(0, -1), hiredAgentMessage]);

      // Step 5: Execute with hired agent
      console.log('⚡ Executing with hired agent...');

      const runPayload = {
        inMint: plan.steps[0]?.inputs?.inMint || "So11111111111111111111111111111111111111112",
        outMint: plan.steps[0]?.inputs?.outMint || "USDCoctVLVnvTXBEuP9s8hntucdJokbo17RwHuNXemT",
        amount: plan.steps[0]?.inputs?.amount || "1000000",
        slippageBps: plan.steps[0]?.constraints?.slippage_bps_max || 30,
        pythPriceIds: plan.steps[0]?.inputs?.pythPriceIds || []
      };
      console.log('📤 Run payload:', JSON.stringify(runPayload, null, 2));

      const runResponse = await fetch('/api/runner?path=/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(runPayload)
      });

      console.log('📥 Run response status:', runResponse.status);
      if (!runResponse.ok) {
        const errorText = await runResponse.text();
        console.error('❌ Execution failed:', errorText);
        throw new Error(`Execution failed: ${errorText}`);
      }

      const runData = await runResponse.json();
      console.log('✅ Execution completed:', JSON.stringify(runData, null, 2));

      // Show execution details
      const executionDetails = `
**Transaction Details:**
- **Input Mint:** \`${runPayload.inMint.slice(0, 8)}...${runPayload.inMint.slice(-8)}\`
- **Output Mint:** \`${runPayload.outMint.slice(0, 8)}...${runPayload.outMint.slice(-8)}\`
- **Amount:** ${runPayload.amount}
- **Slippage:** ${runPayload.slippageBps} bps
`;

      // Final success message
      let finalContent = `✅ **Execution Complete!**\n\n`;
      finalContent += `**Plan Summary:** ${summary}\n\n`;
      finalContent += `**Agent Details:**\n`;
      finalContent += `- Agent ID: \`${hiredAgent.agent_id}\`\n`;
      finalContent += `- Service Fee: $${hiredAgent.price_usd}\n`;
      finalContent += `- Score: ${hiredAgent.score?.toFixed(2) || 'N/A'}\n\n`;
      finalContent += executionDetails;
      finalContent += `**Status:** ${runData.ok ? '✅ Success' : '❌ Failed'}\n\n`;

      if (!publicKey) {
        finalContent += `_💡 Connect your wallet to execute future plans._\n\n`;
      }

      finalContent += `**📋 Full Plan:**\n\`\`\`json\n${JSON.stringify(plan, null, 2)}\n\`\`\``;

      const finalMessage: Message = {
        role: 'assistant',
        content: finalContent,
        ts: Date.now(),
        id: `final-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        loadingState: 'completed'
      };

      setMessages((prev) => [...prev.slice(0, -1), finalMessage]);
      console.log('🎉 Complete execution flow finished successfully!');

    } catch (error) {
      console.error('💥 Execution error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `❌ **Execution Failed**\n\n**Error:** ${error instanceof Error ? error.message : 'Unknown error'}\n\n**Troubleshooting:**\n1. Check that services are running\n2. Verify your wallet is connected\n3. Try simplifying your request\n4. Check console logs for details`,
        ts: Date.now(),
        id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        loadingState: 'completed'
      };
      setMessages((prev) => [...prev.slice(0, -1), errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (action: string) => {
    handleSend(action, budget);
  };

  if (!isHydrated) {
    return null; // Prevent hydration mismatch
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden min-h-[600px] flex flex-col">
          {/* Chat Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">DeFi Agent Chat</h1>
                  <p className="text-blue-100 text-sm">Ask me anything about DeFi strategies</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1 text-white">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm">Online</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          {messages.length === 1 && (
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Quick Actions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {QUICK_ACTIONS.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickAction(action)}
                    className="p-4 text-left bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-600 rounded-xl border border-blue-200 dark:border-gray-600 hover:from-blue-100 hover:to-purple-100 dark:hover:from-gray-600 dark:hover:to-gray-500 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    disabled={loading}
                    aria-label={`Quick action: ${action}`}
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {action}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Agent Management Buttons */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <div className="flex flex-wrap gap-3">
              {CHAT_BUTTONS.map((button, idx) => (
                <button
                  key={idx}
                  onClick={button.action}
                  className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-300 dark:hover:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading}
                  aria-label={button.label}
                >
                  <span className="text-lg">{button.icon}</span>
                  <span className="text-sm font-medium">{button.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Feed */}
          <ChatFeed messages={messages} isLoading={loading} />

          {/* Wallet Status */}
          {!publicKey && (
            <div className="px-6 py-4 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center space-x-2 text-yellow-800 dark:text-yellow-200">
                <AlertCircle className="w-5 h-5" />
                <p className="text-sm font-medium">
                  You&apos;re not connected. Planning works; execution requires a wallet.
                </p>
              </div>
            </div>
          )}

          {publicKey && (
            <div className="px-6 py-4 bg-green-50 dark:bg-green-900/20 border-t border-green-200 dark:border-green-800">
              <div className="flex items-center space-x-2 text-green-800 dark:text-green-200">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <p className="text-sm font-medium">Ready to execute transactions</p>
              </div>
            </div>
          )}

          {/* Composer */}
          <div className="mt-auto">
            <Composer
              onSend={handleSend}
              isLoading={loading}
              budget={budget}
              onBudgetChange={setBudget}
            />
          </div>
        </div>
      </main>

      {/* Inline Styles for Chat Page */}
      <style jsx>{`
        .chat-page-root {
          min-height: 100vh;
          background: radial-gradient(
            ellipse at top,
            rgba(199, 210, 254, 0.4),
            transparent 70%
          ),
          linear-gradient(180deg, rgba(240, 246, 255, 1) 0%, rgba(245, 243, 255, 1) 100%);
          display: flex;
          flex-direction: column;
        }

        .chat-top-bar {
          position: sticky;
          top: 0;
          z-index: 40;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(219, 234, 254, 0.5);
          padding: 16px 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .chat-top-bar-content {
          max-width: 880px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
        }

        .chat-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #1f2937;
        }

        .chat-logo-text {
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }

        .chat-main-content {
          flex: 1;
          display: flex;
          justify-content: center;
          padding: 24px 20px;
          overflow-y: auto;
        }

        .chat-card {
          width: 100%;
          max-width: 880px;
          background: white;
          border-radius: 24px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07),
                      0 10px 20px rgba(0, 0, 0, 0.04);
          border: 1px solid rgba(219, 234, 254, 0.3);
          display: flex;
          flex-direction: column;
          height: fit-content;
          max-height: 85vh;
          overflow: hidden;
        }

        .quick-actions-container {
          padding: 20px 24px;
          border-bottom: 1px solid rgba(219, 234, 254, 0.3);
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        @media (min-width: 640px) {
          .quick-actions-container {
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          }
        }

        .quick-action-button {
          padding: 12px 16px;
          border: 1px solid rgba(99, 102, 241, 0.2);
          background: white;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          color: #4f46e5;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .quick-action-button:hover:not(:disabled) {
          background: rgba(99, 102, 241, 0.05);
          border-color: rgba(99, 102, 241, 0.4);
        }

        .quick-action-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .agent-buttons-container {
          padding: 16px 24px;
          border-bottom: 1px solid rgba(219, 234, 254, 0.3);
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        .agent-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border: 1px solid rgba(16, 185, 129, 0.3);
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(34, 197, 94, 0.1) 100%);
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          color: #059669;
          cursor: pointer;
          transition: all 0.2s ease;
          min-width: 160px;
          justify-content: center;
        }

        .agent-button:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(34, 197, 94, 0.2) 100%);
          border-color: rgba(16, 185, 129, 0.5);
          transform: translateY(-1px);
        }

        .agent-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .agent-button-icon {
          font-size: 16px;
        }

        .agent-button-label {
          font-weight: 600;
        }

        .wallet-hint-banner {
          padding: 16px 24px;
          background: rgba(249, 250, 251, 0.6);
          border-bottom: 1px solid rgba(219, 234, 254, 0.3);
          font-size: 14px;
          color: #6b7280;
        }

        .wallet-ready-badge {
          padding: 12px 24px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #10b981;
          background: rgba(16, 185, 129, 0.05);
          border-bottom: 1px solid rgba(219, 234, 254, 0.3);
        }

        .wallet-ready-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
        }

        @media (max-width: 640px) {
          .chat-top-bar {
            padding: 12px 16px;
          }

          .chat-main-content {
            padding: 16px 12px;
          }

          .chat-card {
            border-radius: 16px;
            max-height: calc(100vh - 60px);
          }
        }
      `}</style>
    </div>
  );
}