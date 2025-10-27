'use client';

import React, { useEffect, useRef } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
  id: string;
  loadingState?: 'planning' | 'rfp' | 'offers' | 'hiring' | 'executing' | 'completed';
}

interface ChatFeedProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

// Safe markdown parser - converts safe subset to HTML
function parseMarkdown(text: string): string {
  let html = text;

  // Escape HTML first (but we'll un-escape safe tags after)
  const tempText = html;

  // Bold text: **text** or __text__
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic text: *text* or _text_
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Code blocks: ```lang\ncode\n```
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    '<pre><code class="code-block">$2</code></pre>'
  );

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Line breaks
  html = html.replace(/\n/g, '<br />');

  return html;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function getLoadingAnimation(loadingState: string): string {
  switch (loadingState) {
    case 'planning':
      return '🤖 Planning your DeFi strategy...';
    case 'rfp':
      return '📋 Creating Request for Proposal...';
    case 'offers':
      return '💰 Gathering agent offers...';
    case 'hiring':
      return '🎯 Hiring best agent...';
    case 'executing':
      return '⚡ Executing with hired agent...';
    case 'completed':
      return '✅ Execution Complete!';
    default:
      return 'Processing...';
  }
}

function LoadingIndicator({ loadingState }: { loadingState: string }) {
  return (
    <div className="loading-indicator">
      <div className="loading-content">
        <div className="loading-spinner" />
        <span className="loading-text">{getLoadingAnimation(loadingState)}</span>
      </div>
    </div>
  );
}

export default function ChatFeed({ messages, isLoading }: ChatFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="chat-feed-container" ref={feedRef} role="log" aria-label="Chat messages">
      {messages.map((message, index) => (
        <div
          key={message.id || `${message.role}-${message.ts}-${index}`}
          className={`chat-message-wrapper ${message.role}-message`}
        >
          <div className="chat-message-bubble">
            {message.role === 'assistant' ? (
              <div className="chat-message-content assistant-content">
                {message.loadingState && message.loadingState !== 'completed' ? (
                  <LoadingIndicator loadingState={message.loadingState} />
                ) : (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: parseMarkdown(message.content),
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="chat-message-content user-content">
                {message.content}
              </div>
            )}
            <span className="chat-message-timestamp">
              {formatTime(message.ts)}
            </span>
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="chat-message-wrapper assistant-message">
          <div className="chat-message-bubble chat-typing">
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      )}

      <div ref={endRef} />

      {/* Inline Styles for Loading Indicators */}
      <style jsx>{`
        .loading-indicator {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 0;
        }

        .loading-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .loading-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(99, 102, 241, 0.2);
          border-top: 2px solid #6366f1;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .loading-text {
          font-size: 14px;
          color: #6366f1;
          font-weight: 500;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        .chat-message-content.assistant-content {
          position: relative;
        }

        .chat-message-content.assistant-content .loading-indicator {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%);
          border-radius: 12px;
          padding: 12px 16px;
          border: 1px solid rgba(99, 102, 241, 0.1);
        }
      `}</style>
    </div>
  );
}