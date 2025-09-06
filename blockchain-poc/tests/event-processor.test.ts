import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { EventProcessor } from '../src/processing/event-processor';
import { EventDecoder } from '../src/processing/event-decoder';
import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';

// Mock the EventDecoder
jest.mock('../src/processing/event-decoder');

describe('EventProcessor', () => {
  let processor: EventProcessor;
  let mockDb: jest.Mocked<PrismaClient>;
  let mockProvider: jest.Mocked<ethers.JsonRpcProvider>;
  let mockDecoder: jest.Mocked<EventDecoder>;

  beforeEach(() => {
    // Mock database
    mockDb = {
      transaction: {
        findMany: jest.fn(),
        count: jest.fn()
      },
      event: {
        count: jest.fn(),
        groupBy: jest.fn()
      },
      transfer: {
        count: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn()
      },
      token: {
        findMany: jest.fn()
      },
      block: {
        findFirst: jest.fn()
      },
      $disconnect: jest.fn()
    } as any;

    // Mock provider
    mockProvider = {
      getTransactionReceipt: jest.fn()
    } as any;

    // Mock decoder
    mockDecoder = {
      decodeTransactionLogs: jest.fn(),
      storeDecodedEvents: jest.fn(),
      extractTransferEvents: jest.fn(),
      storeTransferEvents: jest.fn()
    } as any;

    // Mock EventDecoder constructor
    (EventDecoder as jest.Mock).mockImplementation(() => mockDecoder);

    processor = new EventProcessor(mockProvider, mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processTransactionEvents', () => {
    it('should process transaction events successfully', async () => {
      const txHash = '0x123';
      const mockReceipt = {
        logs: [
          {
            address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'],
            data: '0x0000000000000000000000000000000000000000000000000000000000000001',
            logIndex: 0,
            transactionHash: txHash
          }
        ]
      };

      const mockDecodedEvents = [
        {
          eventName: 'Transfer',
          args: {
            from: '0x1111111111111111111111111111111111111111',
            to: '0x2222222222222222222222222222222222222222',
            value: BigInt('1000000')
          },
          contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          txHash: txHash,
          logIndex: 0
        }
      ];

      const mockTransferEvents = [
        {
          from: '0x1111111111111111111111111111111111111111',
          to: '0x2222222222222222222222222222222222222222',
          amount: '1000000',
          contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          txHash: txHash,
          logIndex: 0
        }
      ];

      mockProvider.getTransactionReceipt.mockResolvedValue(mockReceipt as any);
      mockDecoder.decodeTransactionLogs.mockResolvedValue(mockDecodedEvents);
      mockDecoder.extractTransferEvents.mockResolvedValue(mockTransferEvents);
      mockDecoder.storeDecodedEvents.mockResolvedValue();
      mockDecoder.storeTransferEvents.mockResolvedValue();

      await processor.processTransactionEvents(txHash);

      expect(mockProvider.getTransactionReceipt).toHaveBeenCalledWith(txHash);
      expect(mockDecoder.decodeTransactionLogs).toHaveBeenCalledWith(txHash, mockReceipt.logs);
      expect(mockDecoder.storeDecodedEvents).toHaveBeenCalledWith(mockDecodedEvents);
      expect(mockDecoder.extractTransferEvents).toHaveBeenCalledWith(mockDecodedEvents);
      expect(mockDecoder.storeTransferEvents).toHaveBeenCalledWith(mockTransferEvents);
    });

    it('should handle transaction with no logs', async () => {
      const txHash = '0x123';
      const mockReceipt = { logs: [] };

      mockProvider.getTransactionReceipt.mockResolvedValue(mockReceipt as any);

      await processor.processTransactionEvents(txHash);

      expect(mockProvider.getTransactionReceipt).toHaveBeenCalledWith(txHash);
      expect(mockDecoder.decodeTransactionLogs).not.toHaveBeenCalled();
    });

    it('should handle missing transaction receipt', async () => {
      const txHash = '0x123';

      mockProvider.getTransactionReceipt.mockResolvedValue(null);

      await processor.processTransactionEvents(txHash);

      expect(mockProvider.getTransactionReceipt).toHaveBeenCalledWith(txHash);
      expect(mockDecoder.decodeTransactionLogs).not.toHaveBeenCalled();
    });
  });

  describe('processBlockEvents', () => {
    it('should process all transactions in a block', async () => {
      const blockNumber = 12345;
      const mockTransactions = [
        { hash: '0x111', blockNumber: BigInt(blockNumber) },
        { hash: '0x222', blockNumber: BigInt(blockNumber) }
      ];

      mockDb.transaction.findMany.mockResolvedValue(mockTransactions as any);
      mockProvider.getTransactionReceipt.mockResolvedValue({ logs: [] } as any);

      await processor.processBlockEvents(blockNumber);

      expect(mockDb.transaction.findMany).toHaveBeenCalledWith({
        where: { blockNumber: BigInt(blockNumber) }
      });
      expect(mockProvider.getTransactionReceipt).toHaveBeenCalledTimes(2);
    });

    it('should handle processing errors gracefully', async () => {
      const blockNumber = 12345;
      const mockTransactions = [
        { hash: '0x111', blockNumber: BigInt(blockNumber) },
        { hash: '0x222', blockNumber: BigInt(blockNumber) }
      ];

      mockDb.transaction.findMany.mockResolvedValue(mockTransactions as any);
      mockProvider.getTransactionReceipt
        .mockResolvedValueOnce({ logs: [] } as any)
        .mockRejectedValueOnce(new Error('RPC Error'));

      await processor.processBlockEvents(blockNumber);

      expect(mockProvider.getTransactionReceipt).toHaveBeenCalledTimes(2);
    });
  });

  describe('getEventStatistics', () => {
    it('should return comprehensive event statistics', async () => {
      const mockEventsByContract = [
        { contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7', _count: { contract: 5 } }
      ];

      const mockTransfersByToken = [
        { tokenId: 1, _count: { tokenId: 3 } }
      ];

      const mockTokens = [
        { id: 1, address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' }
      ];

      mockDb.event.count.mockResolvedValue(5);
      mockDb.transfer.count.mockResolvedValue(3);
      mockDb.event.groupBy.mockResolvedValue(mockEventsByContract as any);
      mockDb.transfer.groupBy.mockResolvedValue(mockTransfersByToken as any);
      mockDb.token.findMany.mockResolvedValue(mockTokens as any);

      const stats = await processor.getEventStatistics();

      expect(stats).toEqual({
        totalEvents: 5,
        totalTransfers: 3,
        eventsByContract: {
          '0xdAC17F958D2ee523a2206206994597C13D831ec7': 5
        },
        transfersByToken: {
          '0xdAC17F958D2ee523a2206206994597C13D831ec7': 3
        }
      });
    });
  });

  describe('getTransferEventsByAddress', () => {
    it('should retrieve transfer events for an address', async () => {
      const address = '0x1111111111111111111111111111111111111111';
      const mockTransfers = [
        {
          from: address,
          to: '0x2222222222222222222222222222222222222222',
          amount: '1000000',
          txHash: '0x123',
          createdAt: new Date(),
          token: {
            address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            name: 'USDT',
            symbol: 'USDT',
            decimals: 6
          }
        }
      ];

      mockDb.transfer.findMany.mockResolvedValue(mockTransfers as any);

      const transfers = await processor.getTransferEventsByAddress(address);

      expect(transfers).toHaveLength(1);
      expect(transfers[0].from).toBe(address);
      expect(transfers[0].token.address).toBe('0xdAC17F958D2ee523a2206206994597C13D831ec7');

      expect(mockDb.transfer.findMany).toHaveBeenCalledWith({
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
        take: 100
      });
    });
  });
});
