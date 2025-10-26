'use client';

import React, { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { IPFSService } from '../services/ipfs';
import { Upload, Code, FileText, User, Loader2 } from 'lucide-react';
import * as anchor from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';

interface AgentFormData {
  name: string;
  description: string;
  code: string;
}

const PROGRAM_ID = new PublicKey("HXGQvWagr4soQviA3Lr9LPzVw5G1EmstnaivhYE3BCHK");

export default function AgentRegistrationForm() {
  const { publicKey, connected, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [formData, setFormData] = useState<AgentFormData>({
    name: '',
    description: '',
    code: '',
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
    const agents = await program.account.agent.all();
    console.log('Agents:', agents);
    return agentPda;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!connected || !publicKey) {
      alert('Please connect your wallet first');
      return;
    }

    if (!formData.name || !formData.description || !formData.code) {
      alert('Please fill in all fields');
      return;
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
      
      //upload code 
      const codeUrl = await ipfsService.uploadCode(formData.code, `${formData.name}.py`);

      // Upload metadata with pre-determined agentPda
      const metadata = {
        name: formData.name,
        description: formData.description,
        code: codeUrl,
        version: '1.0.0',
        author: publicKey.toString(),
        agentId: agentId,
        agentPda: agentPda.toString(), 
        timestamp: Date.now(),
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
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Register New Agent
        </h2>
        <p className="text-gray-600">
          Connected wallet: <span className="font-mono text-sm">{publicKey?.toString()}</span>
        </p>
        <p className="text-gray-600 text-sm">
          Network: <span className="font-semibold text-blue-600">Devnet</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Agent Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-500"
            placeholder="Enter agent name"
            required
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-500"
            placeholder="Describe what your agent does..."
            required
          />
        </div>

        <div>
          <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
            Agent Code
          </label>
          <textarea
            id="code"
            name="code"
            value={formData.code}
            onChange={handleInputChange}
            rows={10}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm text-black placeholder-gray-500"
            placeholder="// Enter your agent code here..."
            required
          />
        </div>

        <button
          type="submit"
          disabled={isUploading}
          className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading to IPFS...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Deploy Agent
            </>
          )}
        </button>
      </form>

      {uploadResult && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
          <h3 className="text-lg font-semibold text-green-800 mb-2">
            Agent Deployed Successfully!
          </h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium text-green-700">Agent ID:</span>
              <span className="ml-2 font-mono text-gray-800">{uploadResult.agentId}</span>
            </div>
            <div>
              <span className="font-medium text-green-700">Agent PDA:</span>
              <span className="ml-2 font-mono text-gray-800 break-all">{uploadResult.agentPda}</span>
            </div>
            <div>
              <span className="font-medium text-green-700">Metadata URL:</span>
              <a 
                href={uploadResult.metadataUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="ml-2 text-blue-600 hover:underline break-all"
              >
                {uploadResult.metadataUrl}
              </a>
            </div>
            <div>
              <span className="font-medium text-green-700">Code URL:</span>
              <a 
                href={uploadResult.codeUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="ml-2 text-blue-600 hover:underline break-all"
              >
                {uploadResult.codeUrl}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
