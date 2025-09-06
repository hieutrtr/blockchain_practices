import { ethers } from 'ethers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './config.env' });

export class BlockchainFetcher {
  private provider: ethers.Provider;
  private rpcUrl: string;

  constructor(rpcUrl?: string) {
    this.rpcUrl = rpcUrl || process.env.ETH_RPC_URL || 'https://rpc.ankr.com/eth';
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
  }

  /**
   * Test the connection to the Ethereum network
   */
  async testConnection(): Promise<{ success: boolean; blockNumber?: number; error?: string }> {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      return {
        success: true,
        blockNumber: Number(blockNumber)
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get the latest block
   */
  async getLatestBlock(): Promise<ethers.Block> {
    const block = await this.provider.getBlock('latest', true);
    if (!block) {
      throw new Error('Failed to fetch latest block');
    }
    return block;
  }

  /**
   * Get a specific block by number
   */
  async getBlock(blockNumber: number): Promise<ethers.Block> {
    const block = await this.provider.getBlock(blockNumber, true);
    if (!block) {
      throw new Error(`Failed to fetch block ${blockNumber}`);
    }
    return block;
  }

  /**
   * Get block transactions
   */
  async getBlockTransactions(blockNumber: number): Promise<ethers.TransactionResponse[]> {
    const block = await this.provider.getBlock(blockNumber, true);
    if (!block || !block.transactions) {
      return [];
    }
    // Filter out transaction hashes and return only transaction objects
    return block.transactions.filter(tx => typeof tx === 'object') as ethers.TransactionResponse[];
  }

  /**
   * Get network information
   */
  async getNetworkInfo(): Promise<{ chainId: number; name: string }> {
    const network = await this.provider.getNetwork();
    return {
      chainId: Number(network.chainId),
      name: network.name
    };
  }

  /**
   * Get provider URL
   */
  getProviderUrl(): string {
    return this.rpcUrl;
  }
}
