import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { IngestionService } from '../src/ingestion/ingestion-service';
import { BlockchainFetcher } from '../src/ingestion/blockchain-fetcher';
import { PrismaClient } from '@prisma/client';

// Mock the BlockchainFetcher
jest.mock('../src/ingestion/blockchain-fetcher');

describe('IngestionService', () => {
  let ingestionService: IngestionService;
  let mockDb: jest.Mocked<PrismaClient>;
  let mockFetcher: jest.Mocked<BlockchainFetcher>;

  beforeEach(() => {
    // Mock database
    mockDb = {
      block: {
        findFirst: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn()
      },
      transaction: {
        count: jest.fn()
      },
      $disconnect: jest.fn()
    } as any;

    // Mock fetcher
    mockFetcher = {
      getLatestBlock: jest.fn(),
      getBlock: jest.fn(),
      getBlockTransactions: jest.fn(),
      storeBlock: jest.fn(),
      storeTransaction: jest.fn()
    } as any;

    // Mock BlockchainFetcher constructor
    (BlockchainFetcher as jest.Mock).mockImplementation(() => mockFetcher);

    ingestionService = new IngestionService('https://test-rpc.com', mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('startIngestion', () => {
    it('should process blocks successfully', async () => {
      const mockLatestBlock = {
        number: 100n,
        hash: '0x123',
        timestamp: 1234567890,
        parentHash: '0x456',
        gasUsed: 1000000n,
        gasLimit: 2000000n
      };

      const mockBlock = {
        number: 100n,
        hash: '0x123',
        timestamp: 1234567890,
        parentHash: '0x456',
        gasUsed: 1000000n,
        gasLimit: 2000000n
      };

      const mockTransactions = [
        {
          hash: '0xtx1',
          from: '0xfrom1',
          to: '0xto1',
          value: 1000000000000000000n,
          gasLimit: 21000n,
          gasPrice: 20000000000n
        },
        {
          hash: '0xtx2',
          from: '0xfrom2',
          to: '0xto2',
          value: 2000000000000000000n,
          gasLimit: 21000n,
          gasPrice: 20000000000n
        }
      ];

      mockFetcher.getLatestBlock.mockResolvedValue(mockLatestBlock);
      mockFetcher.getBlock.mockResolvedValue(mockBlock);
      mockFetcher.getBlockTransactions.mockResolvedValue(mockTransactions);
      mockFetcher.storeBlock.mockResolvedValue();
      mockFetcher.storeTransaction.mockResolvedValue();

      await ingestionService.startIngestion(2);

      expect(mockFetcher.getLatestBlock).toHaveBeenCalledTimes(1);
      expect(mockFetcher.getBlock).toHaveBeenCalledTimes(2);
      expect(mockFetcher.storeBlock).toHaveBeenCalledTimes(2);
      expect(mockFetcher.storeTransaction).toHaveBeenCalledTimes(4);
    });

    it('should handle errors gracefully and continue processing', async () => {
      const mockLatestBlock = {
        number: 100n,
        hash: '0x123',
        timestamp: 1234567890,
        parentHash: '0x456',
        gasUsed: 1000000n,
        gasLimit: 2000000n
      };

      const mockBlock = {
        number: 100n,
        hash: '0x123',
        timestamp: 1234567890,
        parentHash: '0x456',
        gasUsed: 1000000n,
        gasLimit: 2000000n
      };

      mockFetcher.getLatestBlock.mockResolvedValue(mockLatestBlock);
      mockFetcher.getBlock
        .mockRejectedValueOnce(new Error('Block fetch failed'))
        .mockResolvedValueOnce(mockBlock);
      mockFetcher.getBlockTransactions.mockResolvedValue([]);
      mockFetcher.storeBlock.mockResolvedValue();

      await ingestionService.startIngestion(2);

      expect(mockFetcher.getBlock).toHaveBeenCalledTimes(2);
      expect(mockFetcher.storeBlock).toHaveBeenCalledTimes(1);
    });

    it('should prevent concurrent ingestion', async () => {
      const mockLatestBlock = {
        number: 100n,
        hash: '0x123',
        timestamp: 1234567890,
        parentHash: '0x456',
        gasUsed: 1000000n,
        gasLimit: 2000000n
      };

      mockFetcher.getLatestBlock.mockResolvedValue(mockLatestBlock);
      mockFetcher.getBlock.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      // Start first ingestion
      const firstIngestion = ingestionService.startIngestion(1);

      // Try to start second ingestion immediately
      await expect(ingestionService.startIngestion(1)).rejects.toThrow('Ingestion is already running');

      await firstIngestion;
    });
  });

  describe('getIngestionStatus', () => {
    it('should return correct status', async () => {
      const mockLastBlock = {
        number: 100n,
        hash: '0x123',
        timestamp: new Date(),
        parentHash: '0x456',
        gasUsed: 1000000n,
        gasLimit: 2000000n,
        createdAt: new Date()
      };

      mockDb.block.findFirst.mockResolvedValue(mockLastBlock);
      mockDb.block.count.mockResolvedValue(10);
      mockDb.transaction.count.mockResolvedValue(50);

      const status = await ingestionService.getIngestionStatus();

      expect(status).toEqual({
        isRunning: false,
        lastProcessedBlock: 100,
        totalBlocks: 10,
        totalTransactions: 50
      });
    });
  });

  describe('getIngestionStats', () => {
    it('should return correct statistics', async () => {
      const mockLatestBlock = { number: 100n };
      const mockOldestBlock = { number: 90n };

      mockDb.block.aggregate.mockResolvedValue({ _count: { number: 10 } });
      mockDb.transaction.count.mockResolvedValue(50);
      mockDb.block.findFirst
        .mockResolvedValueOnce(mockLatestBlock) // Latest block
        .mockResolvedValueOnce(mockOldestBlock); // Oldest block

      const stats = await ingestionService.getIngestionStats();

      expect(stats).toEqual({
        totalBlocks: 10,
        totalTransactions: 50,
        latestBlock: 100,
        oldestBlock: 90,
        averageTransactionsPerBlock: 5
      });
    });
  });

  describe('testIngestion', () => {
    it('should run test ingestion successfully', async () => {
      const mockLatestBlock = {
        number: 100n,
        hash: '0x123',
        timestamp: 1234567890,
        parentHash: '0x456',
        gasUsed: 1000000n,
        gasLimit: 2000000n
      };

      const mockBlock = {
        number: 100n,
        hash: '0x123',
        timestamp: 1234567890,
        parentHash: '0x456',
        gasUsed: 1000000n,
        gasLimit: 2000000n
      };

      mockFetcher.getLatestBlock.mockResolvedValue(mockLatestBlock);
      mockFetcher.getBlock.mockResolvedValue(mockBlock);
      mockFetcher.getBlockTransactions.mockResolvedValue([]);
      mockFetcher.storeBlock.mockResolvedValue();

      // Mock getIngestionStats
      mockDb.block.aggregate.mockResolvedValue({ _count: { number: 3 } });
      mockDb.transaction.count.mockResolvedValue(15);
      mockDb.block.findFirst
        .mockResolvedValueOnce({ number: 100n })
        .mockResolvedValueOnce({ number: 98n });

      await ingestionService.testIngestion(3);

      expect(mockFetcher.getLatestBlock).toHaveBeenCalledTimes(1);
      expect(mockFetcher.getBlock).toHaveBeenCalledTimes(3);
      expect(mockFetcher.storeBlock).toHaveBeenCalledTimes(3);
    });
  });
});
