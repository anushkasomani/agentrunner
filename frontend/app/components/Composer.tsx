'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';

interface ComposerProps {
  onSend: (message: string, budget: number) => void;
  isLoading: boolean;
  budget: number;
  onBudgetChange: (budget: number) => void;
}

export default function Composer({
  onSend,
  isLoading,
  budget,
  onBudgetChange,
}: ComposerProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(
        Math.max(textareaRef.current.scrollHeight, 44),
        96
      );
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [message]);

  const handleSend = () => {
    if (!message.trim() || isLoading || isSending) return;

    setIsSending(true);
    onSend(message.trim(), budget);
    setMessage('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    setIsSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isSendDisabled = !message.trim() || isLoading || isSending;

  return (
    <div className="composer-container">
      <div className="composer-input-group">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tell me your DeFi goal…"
          className="composer-textarea"
          disabled={isLoading}
          aria-label="Message input"
          rows={1}
        />

        <div className="composer-controls">
          <div className="budget-input-wrapper">
            <label htmlFor="budget-input" className="budget-label">
              Budget (USD)
            </label>
            <input
              id="budget-input"
              type="number"
              value={budget}
              onChange={(e) => onBudgetChange(Math.max(0, parseFloat(e.target.value) || 0))}
              min="0"
              step="0.05"
              className="budget-input"
              aria-label="Budget in USD"
              disabled={isLoading}
            />
          </div>

          <button
            onClick={handleSend}
            disabled={isSendDisabled}
            className="send-button"
            aria-label={isLoading ? 'Sending...' : 'Send message'}
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      <div className="composer-helper-text">
        Planning is free. Execution is pay-gated later via x402.
      </div>
    </div>
  );
}
