import { BlockchainFetcher } from './blockchain-fetcher';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './config.env' });

export class IngestionService {
  private fetcher: BlockchainFetcher;
  private db: PrismaClient;
  private isRunning: boolean = false;

  constructor(rpcUrl: string, db: PrismaClient) {
    this.db = db;
    this.fetcher = new BlockchainFetcher(rpcUrl, db);
  }

  /**
   * Start blockchain data ingestion
   */
  async startIngestion(blockCount: number = 10): Promise<void> {
    if (this.isRunning) {
      throw new Error('❌ Ingestion is already running');
    }

    this.isRunning = true;
    console.log(`🚀 Starting ingestion of ${blockCount} blocks...`);

    try {
      const latestBlock = await this.fetcher.getLatestBlock();
      console.log(`📊 Latest block: ${latestBlock.number}`);

      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < blockCount; i++) {
        const blockNumber = Number(latestBlock.number) - i;
        try {
          await this.processBlock(blockNumber);
          successCount++;
        } catch (error) {
          console.error(`❌ Failed to process block ${blockNumber}:`, error);
          errorCount++;
          // Continue with next block instead of failing completely
        }
      }

      console.log(`✅ Ingestion completed: ${successCount} successful, ${errorCount} failed`);
    } catch (error) {
      console.error('❌ Ingestion failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process a single block
   */
  private async processBlock(blockNumber: number): Promise<void> {
    try {
      console.log(`🔄 Processing block ${blockNumber}...`);
      
      // Fetch block data
      const block = await this.fetcher.getBlock(blockNumber);
      await this.fetcher.storeBlock(block);

      // Fetch and store transactions
      const transactions = await this.fetcher.getBlockTransactions(blockNumber);
      let transactionCount = 0;
      
      for (const tx of transactions) {
        try {
          await this.fetcher.storeTransaction(tx, BigInt(blockNumber));
          transactionCount++;
        } catch (error) {
          console.error(`❌ Failed to store transaction ${tx.hash}:`, error);
          // Continue with next transaction
        }
      }

      console.log(`✅ Successfully processed block ${blockNumber} with ${transactionCount}/${transactions.length} transactions`);
    } catch (error) {
      console.error(`❌ Failed to process block ${blockNumber}:`, error);
      throw error;
    }
  }

  /**
   * Get ingestion status
   */
  async getIngestionStatus(): Promise<{ 
    isRunning: boolean; 
    lastProcessedBlock?: number;
    totalBlocks: number;
    totalTransactions: number;
  }> {
    const [lastBlock, blockCount, transactionCount] = await Promise.all([
      this.db.block.findFirst({
        orderBy: { number: 'desc' }
      }),
      this.db.block.count(),
      this.db.transaction.count()
    ]);

    return {
      isRunning: this.isRunning,
      lastProcessedBlock: lastBlock ? Number(lastBlock.number) : undefined,
      totalBlocks: blockCount,
      totalTransactions: transactionCount
    };
  }

  /**
   * Get ingestion statistics
   */
  async getIngestionStats(): Promise<{
    totalBlocks: number;
    totalTransactions: number;
    latestBlock: number;
    oldestBlock: number;
    averageTransactionsPerBlock: number;
  }> {
    const [blockStats, transactionCount, latestBlock, oldestBlock] = await Promise.all([
      this.db.block.aggregate({
        _count: { number: true }
      }),
      this.db.transaction.count(),
      this.db.block.findFirst({
        orderBy: { number: 'desc' },
        select: { number: true }
      }),
      this.db.block.findFirst({
        orderBy: { number: 'asc' },
        select: { number: true }
      })
    ]);

    const totalBlocks = blockStats._count.number;
    const averageTransactionsPerBlock = totalBlocks > 0 ? transactionCount / totalBlocks : 0;

    return {
      totalBlocks,
      totalTransactions: transactionCount,
      latestBlock: latestBlock ? Number(latestBlock.number) : 0,
      oldestBlock: oldestBlock ? Number(oldestBlock.number) : 0,
      averageTransactionsPerBlock: Math.round(averageTransactionsPerBlock * 100) / 100
    };
  }

  /**
   * Test ingestion with a small number of blocks
   */
  async testIngestion(blockCount: number = 3): Promise<void> {
    console.log(`🧪 Testing ingestion with ${blockCount} blocks...`);
    await this.startIngestion(blockCount);
    
    const stats = await this.getIngestionStats();
    console.log('📊 Test ingestion results:', stats);
  }
}
