'use client';

import React, { useEffect, useRef } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
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

export default function ChatFeed({ messages, isLoading }: ChatFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="chat-feed-container" ref={feedRef} role="log" aria-label="Chat messages">
      {messages.map((message) => (
        <div
          key={`${message.role}-${message.ts}`}
          className={`chat-message-wrapper ${message.role}-message`}
        >
          <div className="chat-message-bubble">
            {message.role === 'assistant' ? (
              <div
                className="chat-message-content assistant-content"
                dangerouslySetInnerHTML={{
                  __html: parseMarkdown(message.content),
                }}
              />
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
    </div>
  );
}
