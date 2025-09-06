import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { BlockchainFetcher } from '../src/ingestion/blockchain-fetcher';
import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';

// Mock ethers
jest.mock('ethers');

describe('BlockchainFetcher', () => {
  let fetcher: BlockchainFetcher;
  let mockDb: jest.Mocked<PrismaClient>;
  let mockProvider: jest.Mocked<ethers.JsonRpcProvider>;

  beforeEach(() => {
    // Mock database
    mockDb = {
      block: {
        upsert: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn()
      },
      transaction: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn()
      },
      $disconnect: jest.fn()
    } as any;

    // Mock provider
    mockProvider = {
      getBlockNumber: jest.fn(),
      getBlock: jest.fn(),
      getNetwork: jest.fn()
    } as any;

    // Mock ethers.JsonRpcProvider constructor
    (ethers.JsonRpcProvider as jest.Mock).mockImplementation(() => mockProvider);

    fetcher = new BlockchainFetcher('https://test-rpc.com', mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('testConnection', () => {
    it('should return success when connection works', async () => {
      mockProvider.getBlockNumber.mockResolvedValue(12345n);

      const result = await fetcher.testConnection();

      expect(result.success).toBe(true);
      expect(result.blockNumber).toBe(12345);
      expect(result.error).toBeUndefined();
    });

    it('should return error when connection fails', async () => {
      mockProvider.getBlockNumber.mockRejectedValue(new Error('Connection failed'));

      const result = await fetcher.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
      expect(result.blockNumber).toBeUndefined();
    });
  });

  describe('getLatestBlock', () => {
    it('should fetch latest block successfully', async () => {
      const mockBlock = {
        number: 12345n,
        hash: '0x123',
        timestamp: 1234567890,
        parentHash: '0x456',
        gasUsed: 1000000n,
        gasLimit: 2000000n,
        transactions: []
      };

      mockProvider.getBlock.mockResolvedValue(mockBlock);

      const result = await fetcher.getLatestBlock();

      expect(result).toEqual(mockBlock);
      expect(mockProvider.getBlock).toHaveBeenCalledWith('latest', true);
    });

    it('should throw error when block is null', async () => {
      mockProvider.getBlock.mockResolvedValue(null);

      await expect(fetcher.getLatestBlock()).rejects.toThrow('Failed to fetch latest block');
    });

    it('should retry on failure', async () => {
      mockProvider.getBlock
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({
          number: 12345n,
          hash: '0x123',
          timestamp: 1234567890,
          parentHash: '0x456',
          gasUsed: 1000000n,
          gasLimit: 2000000n,
          transactions: []
        });

      const result = await fetcher.getLatestBlock();

      expect(result.number).toBe(12345n);
      expect(mockProvider.getBlock).toHaveBeenCalledTimes(3);
    });
  });

  describe('storeBlock', () => {
    it('should store block in database', async () => {
      const mockBlock = {
        number: 12345n,
        hash: '0x123',
        timestamp: 1234567890,
        parentHash: '0x456',
        gasUsed: 1000000n,
        gasLimit: 2000000n
      };

      mockDb.block.upsert.mockResolvedValue({} as any);

      await fetcher.storeBlock(mockBlock);

      expect(mockDb.block.upsert).toHaveBeenCalledWith({
        where: { number: mockBlock.number },
        update: {
          hash: mockBlock.hash,
          timestamp: new Date(mockBlock.timestamp * 1000),
          parentHash: mockBlock.parentHash,
          gasUsed: mockBlock.gasUsed,
          gasLimit: mockBlock.gasLimit
        },
        create: {
          number: mockBlock.number,
          hash: mockBlock.hash,
          timestamp: new Date(mockBlock.timestamp * 1000),
          parentHash: mockBlock.parentHash,
          gasUsed: mockBlock.gasUsed,
          gasLimit: mockBlock.gasLimit
        }
      });
    });

    it('should throw error when database operation fails', async () => {
      const mockBlock = {
        number: 12345n,
        hash: '0x123',
        timestamp: 1234567890,
        parentHash: '0x456',
        gasUsed: 1000000n,
        gasLimit: 2000000n
      };

      mockDb.block.upsert.mockRejectedValue(new Error('Database error'));

      await expect(fetcher.storeBlock(mockBlock)).rejects.toThrow('Database error');
    });
  });

  describe('storeTransaction', () => {
    it('should store transaction in database', async () => {
      const mockTransaction = {
        hash: '0xtx123',
        from: '0xfrom',
        to: '0xto',
        value: 1000000000000000000n,
        gasLimit: 21000n,
        gasPrice: 20000000000n
      };

      const blockNumber = 12345n;

      mockDb.transaction.upsert.mockResolvedValue({} as any);

      await fetcher.storeTransaction(mockTransaction, blockNumber);

      expect(mockDb.transaction.upsert).toHaveBeenCalledWith({
        where: { hash: mockTransaction.hash },
        update: {
          blockNumber: blockNumber,
          from: mockTransaction.from,
          to: mockTransaction.to,
          value: mockTransaction.value.toString(),
          gasUsed: mockTransaction.gasLimit,
          gasPrice: mockTransaction.gasPrice.toString(),
          status: 1
        },
        create: {
          hash: mockTransaction.hash,
          blockNumber: blockNumber,
          from: mockTransaction.from,
          to: mockTransaction.to,
          value: mockTransaction.value.toString(),
          gasUsed: mockTransaction.gasLimit,
          gasPrice: mockTransaction.gasPrice.toString(),
          status: 1
        }
      });
    });
  });
});
