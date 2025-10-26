'use client';

import React, { useEffect, useState } from 'react';
import ChatFeed from '@/app/components/ChatFeed';
import Composer from '@/app/components/Composer';
import { WalletMultiButton } from '@/app/components/WalletProvider';
import { useWallet } from '@solana/wallet-adapter-react';
import { callPlanner, summarizePlan } from '@/app/services/planner';
import { MessageCircle } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: 'Tell me your DeFi goal…',
  ts: Date.now(),
};

const QUICK_ACTIONS = [
  'Swap 1 SOL → USDC (≤30bps)',
  'Rebalance to 60/30/10',
  'Exit LP position to USDC',
];

export default function ChatPage() {
  const { publicKey } = useWallet();
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [loading, setLoading] = useState(false);
  const [budget, setBudget] = useState(0.2);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ar-chat');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to hydrate messages:', error);
    }

    setIsHydrated(true);
  }, []);

  // Persist messages to localStorage
  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem('ar-chat', JSON.stringify(messages));
      } catch (error) {
        console.error('Failed to save messages:', error);
      }
    }
  }, [messages, isHydrated]);

  const handleSend = async (text: string, budgetAmount: number) => {
    // Guard against double-submit
    if (loading) return;

    // Add user message
    const userMessage: Message = {
      role: 'user',
      content: text,
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      // Call planner
      const plan = await callPlanner(text, budgetAmount);

      // Summarize plan
      const { summary } = summarizePlan(plan);

      // Build assistant message with summary and JSON panel
      let assistantContent = summary;

      if (!publicKey) {
        assistantContent += '\n\n_Connect your wallet to execute (RFP → hire → x402 → run)._';
      }

      // Add JSON in a code block (more reliable than HTML)
      assistantContent += `\n\n**Raw Plan (JSON):**\n\`\`\`json\n${JSON.stringify(plan, null, 2)}\n\`\`\``;

      const assistantMessage: Message = {
        role: 'assistant',
        content: assistantContent,
        ts: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Planner error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content:
          'Planner failed. Try again or simplify the goal.',
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
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
    <div className="chat-page-root">
      {/* Sticky Top Bar */}
      <header className="chat-top-bar">
        <div className="chat-top-bar-content">
          <div className="chat-logo">
            <MessageCircle size={24} />
            <span className="chat-logo-text">AgentRunner</span>
          </div>
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
      </header>

      {/* Main Content */}
      <main className="chat-main-content">
        <div className="chat-card">
          {/* Quick Actions */}
          {messages.length === 1 && (
            <div className="quick-actions-container">
              {QUICK_ACTIONS.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickAction(action)}
                  className="quick-action-button"
                  disabled={loading}
                  aria-label={`Quick action: ${action}`}
                >
                  {action}
                </button>
              ))}
            </div>
          )}

          {/* Chat Feed */}
          <ChatFeed messages={messages} isLoading={loading} />

          {/* Wallet Hint */}
          {!publicKey && (
            <div className="wallet-hint-banner">
              <p>
                You&apos;re not connected. Planning works; execution requires a
                wallet.
              </p>
            </div>
          )}

          {publicKey && (
            <div className="wallet-ready-badge">
              <div className="wallet-ready-dot" />
              <span>Ready to execute</span>
            </div>
          )}

          {/* Composer */}
          <Composer
            onSend={handleSend}
            isLoading={loading}
            budget={budget}
            onBudgetChange={setBudget}
          />
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
