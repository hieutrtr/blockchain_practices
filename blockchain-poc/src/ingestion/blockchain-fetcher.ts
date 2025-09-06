import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './config.env' });

interface FetcherConfig {
  rpcUrl: string;
  maxRetries: number;
  retryDelay: number;
  requestTimeout: number;
}

export class BlockchainFetcher {
  private provider: ethers.Provider;
  private db: PrismaClient;
  private config: FetcherConfig;
  private rpcUrl: string;

  constructor(rpcUrl: string, db: PrismaClient, config?: Partial<FetcherConfig>) {
    this.rpcUrl = rpcUrl;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.db = db;
    this.config = {
      rpcUrl,
      maxRetries: 3,
      retryDelay: 1000,
      requestTimeout: 30000,
      ...config
    };
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
   * Get the latest block with retry logic
   */
  async getLatestBlock(): Promise<ethers.Block> {
    return await this.retryOperation(async () => {
      const block = await this.provider.getBlock('latest', true);
      if (!block) {
        throw new Error('Failed to fetch latest block');
      }
      return block;
    });
  }

  /**
   * Get a specific block by number with retry logic
   */
  async getBlock(blockNumber: number): Promise<ethers.Block> {
    return await this.retryOperation(async () => {
      const block = await this.provider.getBlock(blockNumber, true);
      if (!block) {
        throw new Error(`Failed to fetch block ${blockNumber}`);
      }
      return block;
    });
  }

  /**
   * Get block transactions with retry logic
   */
  async getBlockTransactions(blockNumber: number): Promise<ethers.TransactionResponse[]> {
    return await this.retryOperation(async () => {
      const block = await this.provider.getBlock(blockNumber, true);
      if (!block || !block.transactions) {
        throw new Error(`Failed to fetch transactions for block ${blockNumber}`);
      }
      // Filter out transaction hashes and return only transaction objects
      return block.transactions.filter(tx => typeof tx === 'object') as ethers.TransactionResponse[];
    });
  }

  /**
   * Store block data in database
   */
  async storeBlock(block: ethers.Block): Promise<void> {
    try {
      await this.db.block.upsert({
        where: { number: block.number },
        update: {
          hash: block.hash || '',
          timestamp: new Date(block.timestamp * 1000),
          parentHash: block.parentHash,
          gasUsed: block.gasUsed,
          gasLimit: block.gasLimit
        },
        create: {
          number: block.number,
          hash: block.hash || '',
          timestamp: new Date(block.timestamp * 1000),
          parentHash: block.parentHash,
          gasUsed: block.gasUsed,
          gasLimit: block.gasLimit
        }
      });
      console.log(`✅ Stored block ${block.number}`);
    } catch (error) {
      console.error(`❌ Failed to store block ${block.number}:`, error);
      throw error;
    }
  }

  /**
   * Store transaction data in database
   */
  async storeTransaction(tx: ethers.TransactionResponse, blockNumber: bigint): Promise<void> {
    try {
      await this.db.transaction.upsert({
        where: { hash: tx.hash },
        update: {
          blockNumber: blockNumber,
          from: tx.from,
          to: tx.to || null,
          value: tx.value.toString(),
          gasUsed: tx.gasLimit,
          gasPrice: tx.gasPrice?.toString() || '0',
          status: 1 // Assuming successful for now
        },
        create: {
          hash: tx.hash,
          blockNumber: blockNumber,
          from: tx.from,
          to: tx.to || null,
          value: tx.value.toString(),
          gasUsed: tx.gasLimit,
          gasPrice: tx.gasPrice?.toString() || '0',
          status: 1
        }
      });
      console.log(`✅ Stored transaction ${tx.hash.substring(0, 10)}...`);
    } catch (error) {
      console.error(`❌ Failed to store transaction ${tx.hash}:`, error);
      throw error;
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error = new Error('Unknown error');
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.warn(`⚠️  Attempt ${attempt} failed:`, error instanceof Error ? error.message : error);
        
        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
          console.log(`🔄 Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }
    
    throw new Error(`❌ Operation failed after ${this.config.maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
