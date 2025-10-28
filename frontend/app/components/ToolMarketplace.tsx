'use client';

import React, { useState, useEffect } from 'react';
import { Search, ExternalLink, DollarSign, Zap, Globe, Code, Database, TrendingUp } from 'lucide-react';

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

interface ToolMarketplaceProps {
  onToolSelect: (tool: Tool) => void;
  selectedTools: Tool[];
  onClose: () => void;
}

const CATEGORIES = [
  { id: 'all', name: 'All', icon: Globe },
  { id: 'ai', name: 'AI', icon: Zap },
  { id: 'trading', name: 'Trading', icon: TrendingUp },
  { id: 'data', name: 'Data', icon: Database },
  { id: 'utility', name: 'Utility', icon: Code },
];

export default function ToolMarketplace({ onToolSelect, selectedTools, onClose }: ToolMarketplaceProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock data - in real implementation, this would come from your API
  useEffect(() => {
    const mockTools: Tool[] = [
      {
        id: '1',
        name: 'Financial Data API',
        description: 'Get real-time financial market data including crypto, stocks, and forex prices.',
        endpoint: 'https://financial-agent.daydreams.systems/entrypoint',
        method: 'GET',
        price: 0.07,
        usage: 286,
        category: 'data',
        icon: '📊',
      },
      {
        id: '2',
        name: 'Firecrawl Search',
        description: 'The search endpoint combines web search (SERP) with Firecrawl\'s scraping capabilities to return full page content for any query.',
        endpoint: 'https://api.firecrawl.dev/v2/x402/search',
        method: 'POST',
        price: 0.01,
        usage: 273,
        category: 'utility',
        icon: '🔥',
      },
      {
        id: '3',
        name: 'Tavily Extractor',
        description: 'Extracts structured content from web pages using Tavily. Cleans and processes raw HTML into readable, structured text data.',
        endpoint: 'https://echo.router.merit.systems/resource/tavily/exti',
        method: 'POST',
        price: 0.00,
        usage: 212,
        category: 'utility',
        icon: '🔷',
      },
      {
        id: '4',
        name: 'Ainalyst API',
        description: 'Touch the data - Advanced analytics and data processing API.',
        endpoint: 'https://ainalyst-api.xyz/touch',
        method: 'POST',
        price: 1.00,
        usage: 177,
        category: 'ai',
        icon: '🧠',
      },
      {
        id: '5',
        name: 'DeFi Price Oracle',
        description: 'Get accurate DeFi token prices and liquidity data for trading decisions.',
        endpoint: 'https://oracle.defi.com/prices',
        method: 'GET',
        price: 0.05,
        usage: 145,
        category: 'trading',
        icon: '💰',
      },
    ];

    // Simulate API call
    setTimeout(() => {
      setTools(mockTools);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredTools = tools.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const isToolSelected = (tool: Tool) => {
    return selectedTools.some(selected => selected.id === tool.id);
  };

  const handleToolToggle = (tool: Tool) => {
    if (isToolSelected(tool)) {
      // Remove tool from selection
      const updatedTools = selectedTools.filter(t => t.id !== tool.id);
      // In a real implementation, you'd call a callback to update parent state
    } else {
      onToolSelect(tool);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Loading tools...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Search Tools</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-gray-700"
            />
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    selectedCategory === category.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{category.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Selected Tools */}
          {selectedTools.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Selected</h3>
              <div className="space-y-3">
                {selectedTools.map((tool) => (
                  <div key={tool.id} className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{tool.icon}</span>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">{tool.name}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{tool.endpoint}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{tool.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {tool.usage} ${tool.price.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available Tools */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Tools</h3>
            <div className="space-y-3">
              {filteredTools.map((tool) => (
                <div
                  key={tool.id}
                  onClick={() => handleToolToggle(tool)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                    isToolSelected(tool)
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                      : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{tool.icon}</span>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">{tool.name}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{tool.endpoint}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{tool.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {tool.usage} ${tool.price.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        per call
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {selectedTools.length} tool{selectedTools.length !== 1 ? 's' : ''} selected
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Add Tools
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
