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
  version: string;
  author: string;
  agentId: string;
  agentPda: string; 
  timestamp: number;
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
      const blob = new Blob([code], { type: 'text/javascript/python' });
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

}
