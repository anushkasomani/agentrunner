import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

interface AgentRecord {
  agentId: string;
  agentPda: string;
  identity: string;
  metadataUrl: string;
  codeUrl: string;
  name: string;
  description: string;
  author: string;
  timestamp: number;
}

interface AgentExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  executionTime: number;
}

export class AgentService {
  private agentsCache: Map<string, AgentRecord> = new Map();
  private codeCache: Map<string, string> = new Map();

  async fetchAgentById(agentId: string): Promise<AgentRecord | null> {
    // Check cache first
    if (this.agentsCache.has(agentId)) {
      return this.agentsCache.get(agentId)!;
    }

    try {
      // Fetch from IPFS via Pinata gateway
      const pinataGateway = process.env.PINATA_GATEWAY || 'https://moccasin-broad-kiwi-732.mypinata.cloud';
      const agentRecordUrl = `${pinataGateway}/ipfs/QmAgents/${agentId}/agent-record.json`;
      const response = await axios.get(agentRecordUrl);
      const agentRecord: AgentRecord = response.data;

      this.agentsCache.set(agentId, agentRecord);
      return agentRecord;
    } catch (error) {
      console.error('Error fetching agent from IPFS:', error);
      return null;
    }
  }

  async fetchAgentCode(codeUrl: string): Promise<string | null> {
    // Check cache first
    if (this.codeCache.has(codeUrl)) {
      return this.codeCache.get(codeUrl)!;
    }

    try {
      const response = await axios.get(codeUrl);
      const code = response.data;
      
      this.codeCache.set(codeUrl, code);
      return code;
    } catch (error) {
      console.error('Error fetching agent code:', error);
      return null;
    }
  }

  async executeAgent(agentId: string, input: any): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Fetch agent metadata
      const agent = await this.fetchAgentById(agentId);
      if (!agent) {
        return {
          success: false,
          error: 'Agent not found',
          executionTime: Date.now() - startTime,
        };
      }

      // Fetch agent code
      const code = await this.fetchAgentCode(agent.codeUrl);
      if (!code) {
        return {
          success: false,
          error: 'Failed to fetch agent code',
          executionTime: Date.now() - startTime,
        };
      }

      // Create temporary file for agent code
      const tempDir = path.join(__dirname, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFile = path.join(tempDir, `${agentId}.js`);
      fs.writeFileSync(tempFile, code);

      // Execute agent code
      const result = await this.runAgentCode(tempFile, input);

      // Clean up
      fs.unlinkSync(tempFile);

      return {
        success: true,
        output: result,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async runAgentCode(filePath: string, input: any): Promise<any> {
    const containerId = uuidv4();
    const tempDir = path.join(__dirname, 'temp', containerId);
    
    try {
      // Create isolated directory for this execution
      fs.mkdirSync(tempDir, { recursive: true });
      
      // Copy agent code to temp directory
      const agentFile = path.join(tempDir, 'agent.js');
      fs.copyFileSync(filePath, agentFile);
      
      // Create package.json for dependencies
      const packageJson = {
        name: `agent-${containerId}`,
        version: '1.0.0',
        main: 'agent.js',
        dependencies: {
          // Common dependencies agents might need
          'axios': '^1.6.0',
          '@solana/web3.js': '^1.87.0',
          '@coral-xyz/anchor': '^0.28.0',
        }
      };
      
      fs.writeFileSync(
        path.join(tempDir, 'package.json'), 
        JSON.stringify(packageJson, null, 2)
      );
      
      // Create Dockerfile for isolated execution
      const dockerfile = `
FROM node:18-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY agent.js ./
CMD ["node", "agent.js"]
      `.trim();
      
      fs.writeFileSync(path.join(tempDir, 'Dockerfile'), dockerfile);
      
      // Create wrapper script that handles input/output
      const wrapperCode = `
const agentCode = require('./agent.js');

// Execute the agent with input
const result = agentCode.execute ? 
  agentCode.execute(${JSON.stringify(input)}) : 
  agentCode(${JSON.stringify(input)});

console.log(JSON.stringify(result));
      `;
      
      fs.writeFileSync(path.join(tempDir, 'wrapper.js'), wrapperCode);
      
      // Build and run Docker container
      const buildCmd = `docker build -t agent-${containerId} "${tempDir}"`;
      const runCmd = `docker run --rm -v "${tempDir}:/app" agent-${containerId} node wrapper.js`;
      
      console.log('Building Docker container...');
      await execAsync(buildCmd);
      
      console.log('Running agent in Docker container...');
      const { stdout, stderr } = await execAsync(runCmd);
      
      if (stderr) {
        throw new Error(stderr);
      }
      
      return JSON.parse(stdout.trim());
      
    } catch (error) {
      throw new Error(`Docker execution failed: ${error}`);
    } finally {
      // Clean up Docker image and temp directory
      try {
        await execAsync(`docker rmi agent-${containerId}`);
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn('Cleanup failed:', cleanupError);
      }
    }
  }

  async getAllAgents(): Promise<AgentRecord[]> {
    try {
      // Fetch all agents from IPFS via Pinata gateway
      const pinataGateway = process.env.PINATA_GATEWAY || 'https://moccasin-broad-kiwi-732.mypinata.cloud';
      const agentsListUrl = `${pinataGateway}/ipfs/QmAgents/agents-list.json`;
      const response = await axios.get(agentsListUrl);
      const agentIds: string[] = response.data.agents || [];
      
      // Fetch each agent record
      const agents: AgentRecord[] = [];
      for (const agentId of agentIds) {
        const agent = await this.fetchAgentById(agentId);
        if (agent) {
          agents.push(agent);
        }
      }
      
      return agents;
    } catch (error) {
      console.error('Error fetching all agents:', error);
      // Fallback to cached agents
      return Array.from(this.agentsCache.values());
    }
  }

  clearCache(): void {
    this.agentsCache.clear();
    this.codeCache.clear();
  }
}
