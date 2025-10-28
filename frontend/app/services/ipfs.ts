import axios from 'axios';

interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

interface AgentMetadata {
  name: string;
  description: string;
  code: string;
  service_type: 'agent' | 'api';
  service_store: string;
  charge: string;
  capability: string;
  version: string;
  author: string;
  agentId: string;
  agentPda: string; 
  timestamp: number;
}

interface APIServiceConfig {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers: Record<string, string>;
  body: any;
  inputParams: Record<string, any>;
  queryParams: Record<string, any>;
}


export class IPFSService {
  private pinataApiKey: string;
  private pinataSecretKey: string;
  private pinataGateway: string;

  constructor() {
    this.pinataApiKey = process.env.NEXT_PUBLIC_PINATA_API_KEY || '';
    this.pinataSecretKey = process.env.NEXT_PUBLIC_PINATA_SECRET_KEY || '';
    this.pinataGateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud';
  }

  async uploadAgentMetadata(metadata: AgentMetadata): Promise<string> {
    try {
      const data = JSON.stringify({
        pinataContent: metadata,
        pinataMetadata: {
          name: `agent-${metadata.name}-${Date.now()}`,
        },
        pinataOptions: {
          cidVersion: 1,
        },
      });

      const config = {
        method: 'post',
        url: 'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        headers: {
          'Content-Type': 'application/json',
          pinata_api_key: this.pinataApiKey,
          pinata_secret_api_key: this.pinataSecretKey,
        },
        data: data,
      };

      const response = await axios(config);
      const result: PinataResponse = response.data;
      
      return `${this.pinataGateway}/ipfs/${result.IpfsHash}`;
    } catch (error) {
      console.error('Error uploading to IPFS:', error);
      throw new Error('Failed to upload agent metadata to IPFS');
    }
  }

  async uploadCode(code: string, filename: string): Promise<string> {
    try {
      const formData = new FormData();
      const blob = new Blob([code], { type: 'text/typescript/python' });
      formData.append('file', blob, filename);

      const metadata = JSON.stringify({
        name: `agent-code-${filename}-${Date.now()}`,
      });
      formData.append('pinataMetadata', metadata);

      const options = JSON.stringify({
        cidVersion: 1,
      });
      formData.append('pinataOptions', options);

      const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinFileToIPFS',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            pinata_api_key: this.pinataApiKey,
            pinata_secret_api_key: this.pinataSecretKey,
          },
        }
      );

      const result: PinataResponse = response.data;
      return `${this.pinataGateway}/ipfs/${result.IpfsHash}`;
    } catch (error) {
      console.error('Error uploading code to IPFS:', error);
      throw new Error('Failed to upload agent code to IPFS');
    }
  }

  /**
   * Parse API service configuration from service_store string
   */
  parseAPIServiceConfig(serviceStore: string): APIServiceConfig | null {
    try {
      if (!serviceStore || serviceStore.trim() === '') {
        return null;
      }
      return JSON.parse(serviceStore);
    } catch (error) {
      console.error('Error parsing API service config:', error);
      return null;
    }
  }

  /**
   * Validate API service configuration
   */
  validateAPIServiceConfig(config: APIServiceConfig): boolean {
    if (!config.endpoint || !config.method) {
      return false;
    }
    
    // Basic URL validation
    try {
      new URL(config.endpoint);
    } catch {
      return false;
    }

    // Validate HTTP method
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE'];
    if (!validMethods.includes(config.method)) {
      return false;
    }

    return true;
  }

  /**
   * Get service type from metadata
   */
  getServiceType(metadata: AgentMetadata): 'agent' | 'api' {
    return metadata.service_type || 'agent';
  }

  /**
   * Check if metadata represents an API service
   */
  isAPIService(metadata: AgentMetadata): boolean {
    return this.getServiceType(metadata) === 'api';
  }

  /**
   * Get API service configuration from metadata
   */
  getAPIServiceConfig(metadata: AgentMetadata): APIServiceConfig | null {
    if (!this.isAPIService(metadata)) {
      return null;
    }
    return this.parseAPIServiceConfig(metadata.service_store);
  }

  /**
   * Fetch and parse agent metadata from IPFS URL
   */
  async fetchAgentMetadata(metadataUrl: string): Promise<AgentMetadata | null> {
    try {
      const response = await axios.get(metadataUrl);
      return response.data as AgentMetadata;
    } catch (error) {
      console.error('Error fetching agent metadata:', error);
      return null;
    }
  }

  /**
   * Convert agent metadata to tool format for marketplace
   */
  metadataToTool(metadata: AgentMetadata): any {
    const apiConfig = this.getAPIServiceConfig(metadata);
    
    if (!this.isAPIService(metadata) || !apiConfig) {
      return null; // Not an API service
    }

    return {
      id: metadata.agentId,
      name: metadata.name,
      description: metadata.description,
      endpoint: apiConfig.endpoint,
      method: apiConfig.method,
      price: parseFloat(metadata.charge),
      usage: 0, // This would come from analytics
      category: metadata.capability,
      icon: this.getCategoryIcon(metadata.capability),
      headers: apiConfig.headers,
      body: apiConfig.body,
      inputParams: apiConfig.inputParams,
      queryParams: apiConfig.queryParams,
    };
  }

  /**
   * Get icon for capability category
   */
  private getCategoryIcon(capability: string): string {
    const iconMap: Record<string, string> = {
      'trading': '💰',
      'arbitrage': '⚡',
      'yield-farming': '🌾',
      'liquidity-management': '💧',
      'portfolio-rebalancing': '⚖️',
      'risk-management': '🛡️',
      'data': '📊',
      'ai': '🧠',
      'utility': '🔧',
      'other': '🔮',
    };
    return iconMap[capability] || '🔮';
  }

}
