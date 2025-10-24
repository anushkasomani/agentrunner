import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

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
      // In a real implementation, you'd fetch from your API or IPFS
      // For now, we'll simulate with mock data
      const mockAgent: AgentRecord = {
        agentId: agentId,
        agentPda: 'HXGQvWagr4soQviA3Lr9LPzVw5G1EmstnaivhYE3BCHK',
        identity: 'ABBtVWcRYZd64waP5HJtKH9CyZLMSP5SbRQ7csuepu6w',
        metadataUrl: 'https://gateway.pinata.cloud/ipfs/QmExample1',
        codeUrl: 'https://gateway.pinata.cloud/ipfs/QmExample2',
        name: 'Swap Agent',
        description: 'Automatically executes token swaps on Raydium with optimal pricing',
        author: 'ABBtVWcRYZd64waP5HJtKH9CyZLMSP5SbRQ7csuepu6w',
        timestamp: Date.now() - 86400000,
      };

      this.agentsCache.set(agentId, mockAgent);
      return mockAgent;
    } catch (error) {
      console.error('Error fetching agent:', error);
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
    try {
      // Create a wrapper script that calls the agent function
      const wrapperCode = `
        const agentCode = require('${filePath}');
        
        // Execute the agent with input
        const result = agentCode.execute ? 
          agentCode.execute(${JSON.stringify(input)}) : 
          agentCode(${JSON.stringify(input)});
        
        console.log(JSON.stringify(result));
      `;

      const wrapperFile = path.join(path.dirname(filePath), 'wrapper.js');
      fs.writeFileSync(wrapperFile, wrapperCode);

      // Execute the wrapper
      const { stdout, stderr } = await execAsync(`node "${wrapperFile}"`);
      
      // Clean up wrapper
      fs.unlinkSync(wrapperFile);

      if (stderr) {
        throw new Error(stderr);
      }

      return JSON.parse(stdout.trim());
    } catch (error) {
      throw new Error(`Agent execution failed: ${error}`);
    }
  }

  async getAllAgents(): Promise<AgentRecord[]> {
    // In a real implementation, you'd fetch from your API or IPFS
    // For now, return cached agents
    return Array.from(this.agentsCache.values());
  }

  clearCache(): void {
    this.agentsCache.clear();
    this.codeCache.clear();
  }
}
