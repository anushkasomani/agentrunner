'use client';

import React, { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { IPFSService } from '../services/ipfs';
import { Upload, Code, FileText, User, Loader2, CheckCircle, Bot } from 'lucide-react';
import * as anchor from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';

interface AgentFormData {
  name: string;
  description: string;
  code: string;
  charge: string;
  capability: string;
  serviceType: 'agent' | 'api';
  apiEndpoint?: string;
  apiMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  apiHeaders?: string;
  apiBody?: string;
  perCallPrice?: string;
  apiInputParams?: string;
  apiQueryParams?: string;
}

const PROGRAM_ID = new PublicKey("HXGQvWagr4soQviA3Lr9LPzVw5G1EmstnaivhYE3BCHK");

export default function AgentRegistrationForm() {
  const { publicKey, connected, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [formData, setFormData] = useState<AgentFormData>({
    name: '',
    description: '',
    code: '',
    charge: '',
    capability: '',
    serviceType: 'agent',
    apiEndpoint: '',
    apiMethod: 'GET',
    apiHeaders: '',
    apiBody: '',
    perCallPrice: '0.01',
    apiInputParams: '',
    apiQueryParams: '',
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    metadataUrl: string;
    codeUrl: string;
    agentId: string;
    agentPda: string;
  } | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const registerAgentOnSolana = async (metadataUri: string, agentIdentity: PublicKey): Promise<PublicKey> => {
    if (!publicKey || !signTransaction) {
      throw new Error('Wallet not connected');
    }

    // Create agent PDA using the identity
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), agentIdentity.toBuffer()],
      PROGRAM_ID
    );

    // Create wallet adapter
    const wallet = {
      publicKey,
      signTransaction,
      signAllTransactions: async (txs: any[]) => {
        return txs.map(tx => signTransaction(tx));
      }
    } as anchor.Wallet;

    const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    
    // Load IDL - try both methods
    let idl;
    try {
      // Try importing first
      const idlModule = await import('../services/registry-idl.json');
      idl = idlModule.default;
    } catch {
      // Fallback to fetch
      const idlResponse = await fetch('/services/registry-idl.json');
      idl = await idlResponse.json();
    }
    
    const program = new anchor.Program(idl, provider);

    // Debug: Check what methods are available
    console.log('IDL loaded:', idl);
    console.log('Available methods:', Object.keys(program.methods));
    console.log('register_agent exists:', !!program.methods.register_agent);

    // Register agent with explicit typing to avoid deep type instantiation
    const tx = await (program.methods as any)
      .registerAgent(agentIdentity, metadataUri)
      .accounts({
        owner: publicKey,
        agent: agentPda,
        system_program: SystemProgram.programId,
      })
      .rpc();

    console.log('Agent registered on Solana:', tx);

    //fetch agent from solana
    try {
      const agents = await (program.account as any).agent.all();
      console.log('Agents:', agents);
    } catch (error) {
      console.log('Could not fetch agents:', error);
    }
    return agentPda;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!connected || !publicKey) {
      alert('Please connect your wallet first');
      return;
    }

    // Validate common fields
    if (!formData.name || !formData.description || !formData.capability) {
      alert('Please fill in name, description, and capability');
      return;
    }

    // Validate based on service type
    if (formData.serviceType === 'agent') {
      if (!formData.code || !formData.charge) {
        alert('Please fill in agent code and charge amount');
        return;
      }
    } else if (formData.serviceType === 'api') {
      if (!formData.apiEndpoint || !formData.perCallPrice) {
        alert('Please fill in API endpoint and per-call price');
        return;
      }
    }

    setIsUploading(true);
    
    try {
      const ipfsService = new IPFSService();
      
      // Generate unique agent ID
      const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create agent identity directly from agentId
      const agentIdentity = new PublicKey(
        Buffer.from(agentId.padEnd(32, '\0')).slice(0, 32)
      );
      
      // Pre-determine agent PDA using the identity directly
      const [agentPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('agent'), agentIdentity.toBuffer()],
        PROGRAM_ID
      );
      
      // Parse API configuration for both upload and metadata
      let headers = {};
      let body = null;
      
      if (formData.serviceType === 'api') {
        try {
          if (formData.apiHeaders) {
            headers = JSON.parse(formData.apiHeaders);
          }
        } catch (e) {
          throw new Error('Invalid JSON in API headers. Please check the format.');
        }
        
        try {
          if (formData.apiBody) {
            body = JSON.parse(formData.apiBody);
          }
        } catch (e) {
          throw new Error('Invalid JSON in API body. Please check the format.');
        }
      }

      // Upload code or API configuration based on service type
      let codeUrl = '';
      if (formData.serviceType === 'agent') {
        codeUrl = await ipfsService.uploadCode(formData.code, `${formData.name}.py`);
      } else {
        // For API services, create a configuration file
        const apiConfig = {
          endpoint: formData.apiEndpoint,
          method: formData.apiMethod,
          headers,
          body,
          inputParams: formData.apiInputParams ? JSON.parse(formData.apiInputParams) : {},
          queryParams: formData.apiQueryParams ? JSON.parse(formData.apiQueryParams) : {},
        };
        codeUrl = await ipfsService.uploadCode(
          JSON.stringify(apiConfig, null, 2), 
          `${formData.name}-config.json`
        );
      }

      // Upload metadata with pre-determined agentPda
      const metadata = {
        name: formData.name,
        description: formData.description,
        code: codeUrl,
        charge: (formData.serviceType === 'agent' ? formData.charge : formData.perCallPrice) || '0',
        capability: formData.capability,
        service_type: formData.serviceType,
        service_store: formData.serviceType === 'api' ? JSON.stringify({
          endpoint: formData.apiEndpoint,
          method: formData.apiMethod,
          headers,
          body,
          inputParams: formData.apiInputParams ? JSON.parse(formData.apiInputParams) : {},
          queryParams: formData.apiQueryParams ? JSON.parse(formData.apiQueryParams) : {},
        }) : '',
        version: '1.0.0',
        author: publicKey.toString(),
        agentId: agentId,
        agentPda: agentPda.toString(), 
        timestamp: Date.now(),
        // Add service-specific metadata
        ...(formData.serviceType === 'agent' ? {
          code_language: 'python',
          execution_type: 'agent'
        } : {
          api_type: 'rest',
          execution_type: 'api_service'
        })
      };
      
      const metadataUrl = await ipfsService.uploadAgentMetadata(metadata);
      
      // Register agent on Solana
      await registerAgentOnSolana(metadataUrl, agentIdentity);
      
      // Simple success - no complex folder logic needed
      
      setUploadResult({
        metadataUrl,
        codeUrl,
        agentId,
        agentPda: agentPda.toString(),
      });
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        code: '',
        charge: '',
        capability: '',
        serviceType: 'agent',
        apiEndpoint: '',
        apiMethod: 'GET',
        apiHeaders: '',
        apiBody: '',
        perCallPrice: '0.01',
        apiInputParams: '',
        apiQueryParams: '',
      });
      
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload agent. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg">
        <User className="w-16 h-16 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-600 mb-2">
          Wallet Not Connected
        </h3>
        <p className="text-gray-500 text-center">
          Please connect your Solana wallet to register an agent.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
            <Bot className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">
              Deploy New Agent
            </h2>
            <p className="text-blue-100">
              Create and register your AI agent on Solana
            </p>
          </div>
        </div>
      </div>

      {/* Wallet Info */}
      <div className="px-8 py-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
              <User className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Connected Wallet
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {publicKey?.toString().slice(0, 8)}...{publicKey?.toString().slice(-8)}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              Devnet
            </span>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="p-8">

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Agent Name */}
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-semibold text-gray-900 dark:text-white">
              Agent Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-gray-700 transition-all duration-200"
              placeholder="Enter a unique name for your agent"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label htmlFor="description" className="block text-sm font-semibold text-gray-900 dark:text-white">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-gray-700 transition-all duration-200 resize-none"
              placeholder="Describe what your agent does and how it helps users..."
              required
            />
          </div>

          {/* Service Type */}
          <div className="space-y-2">
            <label htmlFor="serviceType" className="block text-sm font-semibold text-gray-900 dark:text-white">
              Service Type
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, serviceType: 'agent' }))}
                className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                  formData.serviceType === 'agent'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                <Bot className="w-6 h-6 mx-auto mb-2" />
                <div className="text-sm font-medium">AI Agent</div>
                <div className="text-xs opacity-75">Executable trading logic</div>
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, serviceType: 'api' }))}
                className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                  formData.serviceType === 'api'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                <FileText className="w-6 h-6 mx-auto mb-2" />
                <div className="text-sm font-medium">API Service</div>
                <div className="text-xs opacity-75">External API endpoint</div>
              </button>
            </div>
          </div>

          {/* Agent Code - Only show for agent type */}
          {formData.serviceType === 'agent' && (
          <div className="space-y-2">
            <label htmlFor="code" className="block text-sm font-semibold text-gray-900 dark:text-white">
              Agent Code
            </label>
            <div className="relative">
              <textarea
                id="code"
                name="code"
                value={formData.code}
                onChange={handleInputChange}
                rows={12}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-gray-50 dark:bg-gray-900 transition-all duration-200 resize-none"
                placeholder="// Enter your agent code here...&#10;// Example:&#10;function executeTrade() {&#10;  // Your trading logic here&#10;}"
                required
              />
              <div className="absolute top-3 right-3 text-xs text-gray-400 dark:text-gray-500">
                Python/JavaScript
              </div>
            </div>
          </div>
          )}

          {/* API Configuration - Only show for API type */}
          {formData.serviceType === 'api' && (
            <div className="space-y-6">
              {/* API Endpoint */}
              <div className="space-y-2">
                <label htmlFor="apiEndpoint" className="block text-sm font-semibold text-gray-900 dark:text-white">
                  API Endpoint URL
                </label>
                <input
                  type="url"
                  id="apiEndpoint"
                  name="apiEndpoint"
                  value={formData.apiEndpoint}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-gray-700 transition-all duration-200"
                  placeholder="https://api.example.com/v1/data"
                  required
                />
              </div>

              {/* API Method and Headers Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="apiMethod" className="block text-sm font-semibold text-gray-900 dark:text-white">
                    HTTP Method
                  </label>
                  <select
                    id="apiMethod"
                    name="apiMethod"
                    value={formData.apiMethod}
                    onChange={handleSelectChange}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-white bg-white dark:bg-gray-700 transition-all duration-200"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="perCallPrice" className="block text-sm font-semibold text-gray-900 dark:text-white">
                    Price per Call (USDC)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      id="perCallPrice"
                      name="perCallPrice"
                      value={formData.perCallPrice}
                      onChange={handleInputChange}
                      step="0.001"
                      min="0"
                      className="w-full px-4 py-3 pl-8 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-gray-700 transition-all duration-200"
                      placeholder="0.01"
                      required
                    />
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">
                      $
                    </div>
                  </div>
                </div>
              </div>

              {/* API Headers */}
              <div className="space-y-2">
                <label htmlFor="apiHeaders" className="block text-sm font-semibold text-gray-900 dark:text-white">
                  Request Headers (JSON)
                </label>
                <textarea
                  id="apiHeaders"
                  name="apiHeaders"
                  value={formData.apiHeaders}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-gray-50 dark:bg-gray-900 transition-all duration-200 resize-none"
                  placeholder='{"Authorization": "Bearer YOUR_TOKEN", "Content-Type": "application/json"}'
                />
              </div>

              {/* API Body - Only show for POST/PUT */}
              {(formData.apiMethod === 'POST' || formData.apiMethod === 'PUT') && (
                <div className="space-y-2">
                  <label htmlFor="apiBody" className="block text-sm font-semibold text-gray-900 dark:text-white">
                    Request Body (JSON)
                  </label>
                  <textarea
                    id="apiBody"
                    name="apiBody"
                    value={formData.apiBody}
                    onChange={handleInputChange}
                    rows={6}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-gray-50 dark:bg-gray-900 transition-all duration-200 resize-none"
                    placeholder='{"query": "{{user_input}}", "limit": 10}'
                  />
                </div>
              )}

              {/* API Input Parameters */}
              <div className="space-y-2">
                <label htmlFor="apiInputParams" className="block text-sm font-semibold text-gray-900 dark:text-white">
                  Input Parameters (JSON Schema)
                </label>
                <textarea
                  id="apiInputParams"
                  name="apiInputParams"
                  value={formData.apiInputParams}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-gray-50 dark:bg-gray-900 transition-all duration-200 resize-none"
                  placeholder='{"symbol": "string", "timeframe": "string", "vs_currency": "string"}'
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Define the input parameters your API expects (for planner to build correct inputs)
                </p>
              </div>

              {/* API Query Parameters */}
              <div className="space-y-2">
                <label htmlFor="apiQueryParams" className="block text-sm font-semibold text-gray-900 dark:text-white">
                  Query Parameters (JSON Schema)
                </label>
                <textarea
                  id="apiQueryParams"
                  name="apiQueryParams"
                  value={formData.apiQueryParams}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-gray-50 dark:bg-gray-900 transition-all duration-200 resize-none"
                  placeholder='{"symbol": "string", "timeframe": "string", "vs_currency": "string"}'
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Define the query parameters your API expects (for GET requests)
                </p>
              </div>
            </div>
          )}

          {/* Capability - Show for both agent and API types */}
          <div className="space-y-2">
            <label htmlFor="capability" className="block text-sm font-semibold text-gray-900 dark:text-white">
              Capability
            </label>
            <select
              id="capability"
              name="capability"
              value={formData.capability}
              onChange={handleSelectChange}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white bg-white dark:bg-gray-700 transition-all duration-200"
              required
            >
              <option value="">Select capability</option>
              <option value="trading">Trading</option>
              <option value="arbitrage">Arbitrage</option>
              <option value="yield-farming">Yield Farming</option>
              <option value="liquidity-management">Liquidity Management</option>
              <option value="portfolio-rebalancing">Portfolio Rebalancing</option>
              <option value="risk-management">Risk Management</option>
              <option value="data-provider">Data Provider</option>
              <option value="price-feed">Price Feed</option>
              <option value="analytics">Analytics</option>
              <option value="ohlcv-data">OHLCV Data</option>
              <option value="market-data">Market Data</option>
              <option value="other">Other</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formData.serviceType === 'agent' 
                ? 'What your agent specializes in' 
                : 'What type of service your API provides'
              }
            </p>
          </div>

          {/* Charge/Price - Show based on service type */}
          {formData.serviceType === 'agent' && (
          <div className="space-y-2">
            <label htmlFor="charge" className="block text-sm font-semibold text-gray-900 dark:text-white">
              Charge per Call (USDC)
            </label>
            <div className="relative">
              <input
                type="number"
                id="charge"
                name="charge"
                value={formData.charge}
                onChange={handleInputChange}
                step="0.001"
                min="0"
                className="w-full px-4 py-3 pl-8 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-gray-700 transition-all duration-200"
                placeholder="0.001"
                required
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">
                $
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Amount users pay per agent execution
            </p>
          </div>
          )}

          {/* Submit Button */}
          <div className="pt-6">
            <button
              type="submit"
              disabled={isUploading}
              className="w-full flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                  Deploying Agent...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-3" />
                  Deploy Agent to Solana
                </>
              )}
            </button>
          </div>
        </form>

        {/* Success Message */}
        {uploadResult && (
          <div className="mt-8 p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-2xl">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-green-800 dark:text-green-200 mb-3">
                  🎉 Agent Deployed Successfully!
                </h3>
                <p className="text-green-700 dark:text-green-300 mb-4">
                  Your agent has been registered on Solana and is ready to execute tasks.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-semibold text-green-700 dark:text-green-300 w-24">Agent ID:</span>
                    <span className="text-sm font-mono text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 px-3 py-1 rounded-lg">
                      {uploadResult.agentId}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-semibold text-green-700 dark:text-green-300 w-24">Agent PDA:</span>
                    <span className="text-sm font-mono text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 px-3 py-1 rounded-lg break-all">
                      {uploadResult.agentPda}
                    </span>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="text-sm font-semibold text-green-700 dark:text-green-300 w-24 mt-1">Metadata:</span>
                    <a 
                      href={uploadResult.metadataUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all bg-white dark:bg-gray-800 px-3 py-1 rounded-lg"
                    >
                      {uploadResult.metadataUrl}
                    </a>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="text-sm font-semibold text-green-700 dark:text-green-300 w-24 mt-1">Code:</span>
                    <a 
                      href={uploadResult.codeUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all bg-white dark:bg-gray-800 px-3 py-1 rounded-lg"
                    >
                      {uploadResult.codeUrl}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
