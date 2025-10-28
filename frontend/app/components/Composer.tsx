'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Send, Plus, Zap } from 'lucide-react';
import ToolMarketplace from './ToolMarketplace';

interface Tool {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  price: number;
  usage: number;
  category: string;
  icon: string;
  headers?: Record<string, string>;
  body?: any;
}

interface ComposerProps {
  onSend: (message: string, budget: number, tools: Tool[]) => void;
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
  const [selectedTools, setSelectedTools] = useState<Tool[]>([]);
  const [showToolMarketplace, setShowToolMarketplace] = useState(false);
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
    onSend(message.trim(), budget, selectedTools);
    setMessage('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    setIsSending(false);
  };

  const handleToolSelect = (tool: Tool) => {
    setSelectedTools(prev => [...prev, tool]);
  };

  const removeTool = (toolId: string) => {
    setSelectedTools(prev => prev.filter(tool => tool.id !== toolId));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isSendDisabled = !message.trim() || isLoading || isSending;

  return (
    <>
      <div className="composer-container">
        {/* Selected Tools Display */}
        {selectedTools.length > 0 && (
          <div className="selected-tools-container">
            <div className="selected-tools-header">
              <Zap className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {selectedTools.length} Tool{selectedTools.length !== 1 ? 's' : ''} Selected
              </span>
            </div>
            <div className="selected-tools-list">
              {selectedTools.map((tool) => (
                <div key={tool.id} className="selected-tool-item">
                  <span className="tool-icon">{tool.icon}</span>
                  <span className="tool-name">{tool.name}</span>
                  <span className="tool-price">${tool.price.toFixed(2)}</span>
                  <button
                    onClick={() => removeTool(tool.id)}
                    className="remove-tool-button"
                    aria-label={`Remove ${tool.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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
            {/* Add Tools Button */}
            <button
              onClick={() => setShowToolMarketplace(true)}
              className="add-tools-button"
              aria-label="Add tools"
              disabled={isLoading}
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Tools</span>
            </button>

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

      {/* Tool Marketplace Modal */}
      {showToolMarketplace && (
        <ToolMarketplace
          onToolSelect={handleToolSelect}
          selectedTools={selectedTools}
          onClose={() => setShowToolMarketplace(false)}
        />
      )}
    </>
  );
}