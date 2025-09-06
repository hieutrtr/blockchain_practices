import { ethers } from 'ethers';
import { EventDecoder } from './event-decoder';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './config.env' });

export class EventProcessor {
  private decoder: EventDecoder;
  private db: PrismaClient;
  private provider: ethers.Provider;

  constructor(provider: ethers.Provider, db: PrismaClient) {
    this.provider = provider;
    this.db = db;
    this.decoder = new EventDecoder(db);
  }

  async processTransactionEvents(txHash: string): Promise<void> {
    try {
      console.log(`🔄 Processing events for transaction ${txHash}...`);
      
      // Get transaction receipt to access logs
      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt || !receipt.logs) {
        console.log(`📝 No logs found for transaction ${txHash}`);
        return;
      }

      console.log(`📊 Found ${receipt.logs.length} logs in transaction ${txHash}`);

      // Decode all logs
      const decodedEvents = await this.decoder.decodeTransactionLogs(txHash, [...receipt.logs]);
      
      // Store decoded events
      await this.decoder.storeDecodedEvents(decodedEvents);
      
      // Extract and store transfer events
      const transferEvents = await this.decoder.extractTransferEvents(decodedEvents);
      await this.decoder.storeTransferEvents(transferEvents);
      
      console.log(`✅ Processed ${decodedEvents.length} events, ${transferEvents.length} transfers for transaction ${txHash}`);
    } catch (error) {
      console.error(`❌ Failed to process events for transaction ${txHash}:`, error);
      throw error;
    }
  }

  async processBlockEvents(blockNumber: number): Promise<void> {
    try {
      console.log(`🔄 Processing events for block ${blockNumber}...`);
      
      // Get all transactions in the block
      const transactions = await this.db.transaction.findMany({
        where: { blockNumber: BigInt(blockNumber) }
      });

      console.log(`📊 Found ${transactions.length} transactions in block ${blockNumber}`);

      let totalEvents = 0;
      let totalTransfers = 0;
      let processedTransactions = 0;

      for (const tx of transactions) {
        try {
          await this.processTransactionEvents(tx.hash);
          processedTransactions++;
          
          // Count events and transfers for this transaction
          const txEvents = await this.db.event.count({
            where: { txHash: tx.hash }
          });
          const txTransfers = await this.db.transfer.count({
            where: { txHash: tx.hash }
          });
          
          totalEvents += txEvents;
          totalTransfers += txTransfers;
        } catch (error) {
          console.error(`❌ Failed to process transaction ${tx.hash}:`, error);
        }
      }

      console.log(`✅ Processed ${processedTransactions}/${transactions.length} transactions in block ${blockNumber}`);
      console.log(`📊 Total events: ${totalEvents}, Total transfers: ${totalTransfers}`);
    } catch (error) {
      console.error(`❌ Failed to process events for block ${blockNumber}:`, error);
      throw error;
    }
  }

  async processLatestBlocks(blockCount: number = 5): Promise<void> {
    try {
      console.log(`🚀 Starting event processing for ${blockCount} latest blocks...`);
      
      // Get the latest block from database
      const latestBlock = await this.db.block.findFirst({
        orderBy: { number: 'desc' }
      });
      
      if (!latestBlock) {
        throw new Error('No blocks found in database. Run data ingestion first.');
      }

      const startBlock = Number(latestBlock.number) - blockCount + 1;
      const endBlock = Number(latestBlock.number);
      
      console.log(`📊 Processing blocks ${startBlock} to ${endBlock}`);

      let totalEvents = 0;
      let totalTransfers = 0;

      for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber++) {
        try {
          await this.processBlockEvents(blockNumber);
          
          // Get statistics for this block
          const blockStats = await this.getBlockEventStatistics(blockNumber);
          totalEvents += blockStats.totalEvents;
          totalTransfers += blockStats.totalTransfers;
        } catch (error) {
          console.error(`❌ Failed to process block ${blockNumber}:`, error);
        }
      }

      console.log(`🎉 Event processing completed!`);
      console.log(`📊 Total events processed: ${totalEvents}`);
      console.log(`📊 Total transfers processed: ${totalTransfers}`);
    } catch (error) {
      console.error('❌ Event processing failed:', error);
      throw error;
    }
  }

  async getEventStatistics(): Promise<{
    totalEvents: number;
    totalTransfers: number;
    eventsByContract: Record<string, number>;
    transfersByToken: Record<string, number>;
  }> {
    const [totalEvents, totalTransfers, eventsByContract, transfersByToken] = await Promise.all([
      this.db.event.count(),
      this.db.transfer.count(),
      this.getEventsByContract(),
      this.getTransfersByToken()
    ]);

    return {
      totalEvents,
      totalTransfers,
      eventsByContract,
      transfersByToken
    };
  }

  async getBlockEventStatistics(blockNumber: number): Promise<{
    totalEvents: number;
    totalTransfers: number;
  }> {
    const [totalEvents, totalTransfers] = await Promise.all([
      this.db.event.count({
        where: {
          transaction: {
            blockNumber: BigInt(blockNumber)
          }
        }
      }),
      this.db.transfer.count({
        where: {
          txHash: {
            in: await this.db.transaction.findMany({
              where: { blockNumber: BigInt(blockNumber) },
              select: { hash: true }
            }).then(txs => txs.map(tx => tx.hash))
          }
        }
      })
    ]);

    return {
      totalEvents,
      totalTransfers
    };
  }

  private async getEventsByContract(): Promise<Record<string, number>> {
    const results = await this.db.event.groupBy({
      by: ['contract'],
      _count: { contract: true }
    });

    return results.reduce((acc, result) => {
      acc[result.contract] = result._count.contract;
      return acc;
    }, {} as Record<string, number>);
  }

  private async getTransfersByToken(): Promise<Record<string, number>> {
    const results = await this.db.transfer.groupBy({
      by: ['tokenId'],
      _count: { tokenId: true }
    });

    // Get token addresses for the token IDs
    const tokenIds = results.map(r => r.tokenId);
    const tokens = await this.db.token.findMany({
      where: { id: { in: tokenIds } },
      select: { id: true, address: true }
    });

    const tokenMap = tokens.reduce((acc, token) => {
      acc[token.id] = token.address;
      return acc;
    }, {} as Record<number, string>);

    return results.reduce((acc, result) => {
      const tokenAddress = tokenMap[result.tokenId] || 'unknown';
      acc[tokenAddress] = result._count.tokenId;
      return acc;
    }, {} as Record<string, number>);
  }

  async getTransferEventsByAddress(address: string, limit: number = 100): Promise<any[]> {
    const transfers = await this.db.transfer.findMany({
      where: {
        OR: [
          { from: address },
          { to: address }
        ]
      },
      include: {
        token: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return transfers.map(transfer => ({
      from: transfer.from,
      to: transfer.to,
      amount: transfer.amount,
      token: {
        address: transfer.token.address,
        name: transfer.token.name,
        symbol: transfer.token.symbol,
        decimals: transfer.token.decimals
      },
      txHash: transfer.txHash,
      createdAt: transfer.createdAt
    }));
  }
}
