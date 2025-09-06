import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { EventDecoder } from '../src/processing/event-decoder';
import { PrismaClient } from '@prisma/client';

describe('EventDecoder', () => {
  let decoder: EventDecoder;
  let mockDb: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    // Mock database
    mockDb = {
      event: {
        upsert: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn()
      },
      transfer: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn()
      },
      token: {
        findUnique: jest.fn(),
        create: jest.fn()
      },
      $disconnect: jest.fn()
    } as any;

    decoder = new EventDecoder(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('decodeTransactionLogs', () => {
    it('should decode ERC-20 Transfer events', async () => {
      // Mock log data for USDT Transfer event
      const mockLog = {
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
        topics: [
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', // Transfer topic
          '0x0000000000000000000000001111111111111111111111111111111111111111', // from
          '0x0000000000000000000000002222222222222222222222222222222222222222'  // to
        ],
        data: '0x0000000000000000000000000000000000000000000000000000000000000001', // amount
        logIndex: 0,
        transactionHash: '0x123'
      };

      // Mock database responses
      mockDb.token.findUnique.mockResolvedValue({
        id: 1,
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        name: 'USDT',
        symbol: 'USDT',
        decimals: 6,
        totalSupply: '1000000000000000',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      mockDb.event.upsert.mockResolvedValue({} as any);
      mockDb.transfer.create.mockResolvedValue({} as any);

      // Test decoding
      const decoded = await decoder.decodeTransactionLogs('0x123', [mockLog]);
      
      expect(decoded).toHaveLength(1);
      expect(decoded[0].eventName).toBe('Transfer');
      expect(decoded[0].args.from).toBe('0x1111111111111111111111111111111111111111');
      expect(decoded[0].args.to).toBe('0x2222222222222222222222222222222222222222');
      expect(decoded[0].args.value.toString()).toBe('1');
    });

    it('should handle missing ABIs gracefully', async () => {
      // Test with unknown contract
      const mockLog = {
        address: '0xUnknownContract',
        topics: ['0x123'],
        data: '0x456',
        logIndex: 0,
        transactionHash: '0x789'
      };

      mockDb.event.create.mockResolvedValue({} as any);

      const decoded = await decoder.decodeTransactionLogs('0x789', [mockLog]);
      expect(decoded).toHaveLength(0);
      
      // Should store raw event for debugging
      expect(mockDb.event.create).toHaveBeenCalledWith({
        data: {
          txHash: '0x789',
          logIndex: 0,
          contract: '0xUnknownContract',
          eventName: 'Unknown',
          args: {
            topics: ['0x123'],
            data: '0x456'
          }
        }
      });
    });

    it('should handle decoding errors gracefully', async () => {
      const mockLog = {
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
        topics: ['0xinvalid'], // Invalid topic
        data: '0x456',
        logIndex: 0,
        transactionHash: '0x789'
      };

      mockDb.event.create.mockResolvedValue({} as any);

      const decoded = await decoder.decodeTransactionLogs('0x789', [mockLog]);
      expect(decoded).toHaveLength(0);
      
      // Should store raw event for debugging
      expect(mockDb.event.create).toHaveBeenCalled();
    });
  });

  describe('extractTransferEvents', () => {
    it('should extract Transfer events from decoded events', async () => {
      const decodedEvents = [
        {
          eventName: 'Transfer',
          args: {
            from: '0x1111111111111111111111111111111111111111',
            to: '0x2222222222222222222222222222222222222222',
            value: BigInt('1000000')
          },
          contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          txHash: '0x123',
          logIndex: 0
        },
        {
          eventName: 'Approval',
          args: {
            owner: '0x1111111111111111111111111111111111111111',
            spender: '0x3333333333333333333333333333333333333333',
            value: BigInt('500000')
          },
          contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          txHash: '0x123',
          logIndex: 1
        }
      ];

      const transferEvents = await decoder.extractTransferEvents(decodedEvents);
      
      expect(transferEvents).toHaveLength(1);
      expect(transferEvents[0].from).toBe('0x1111111111111111111111111111111111111111');
      expect(transferEvents[0].to).toBe('0x2222222222222222222222222222222222222222');
      expect(transferEvents[0].amount).toBe('1000000');
      expect(transferEvents[0].contract).toBe('0xdAC17F958D2ee523a2206206994597C13D831ec7');
    });
  });

  describe('storeTransferEvents', () => {
    it('should store transfer events in database', async () => {
      const transferEvents = [
        {
          from: '0x1111111111111111111111111111111111111111',
          to: '0x2222222222222222222222222222222222222222',
          amount: '1000000',
          contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          txHash: '0x123',
          logIndex: 0
        }
      ];

      // Mock token lookup
      mockDb.token.findUnique.mockResolvedValue({
        id: 1,
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        name: 'USDT',
        symbol: 'USDT',
        decimals: 6,
        totalSupply: '1000000000000000',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      mockDb.transfer.create.mockResolvedValue({} as any);

      await decoder.storeTransferEvents(transferEvents);

      expect(mockDb.token.findUnique).toHaveBeenCalledWith({
        where: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' }
      });

      expect(mockDb.transfer.create).toHaveBeenCalledWith({
        data: {
          txHash: '0x123',
          from: '0x1111111111111111111111111111111111111111',
          to: '0x2222222222222222222222222222222222222222',
          amount: '1000000',
          tokenId: 1
        }
      });
    });

    it('should create token if it does not exist', async () => {
      const transferEvents = [
        {
          from: '0x1111111111111111111111111111111111111111',
          to: '0x2222222222222222222222222222222222222222',
          amount: '1000000',
          contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          txHash: '0x123',
          logIndex: 0
        }
      ];

      // Mock token not found, then created
      mockDb.token.findUnique.mockResolvedValue(null);
      mockDb.token.create.mockResolvedValue({
        id: 1,
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        name: 'USDT',
        symbol: 'USDT',
        decimals: 18,
        totalSupply: '0',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      mockDb.transfer.create.mockResolvedValue({} as any);

      await decoder.storeTransferEvents(transferEvents);

      expect(mockDb.token.create).toHaveBeenCalledWith({
        data: {
          address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          name: 'USDT',
          symbol: 'USDT',
          decimals: 18,
          totalSupply: '0'
        }
      });
    });
  });

  describe('getTransferEventsByAddress', () => {
    it('should retrieve transfer events for an address', async () => {
      const mockTransfers = [
        {
          from: '0x1111111111111111111111111111111111111111',
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

      const transfers = await decoder.getTransferEventsByAddress('0x1111111111111111111111111111111111111111');

      expect(transfers).toHaveLength(1);
      expect(transfers[0].from).toBe('0x1111111111111111111111111111111111111111');
      expect(transfers[0].to).toBe('0x2222222222222222222222222222222222222222');
      expect(transfers[0].amount).toBe('1000000');
      expect(transfers[0].contract).toBe('0xdAC17F958D2ee523a2206206994597C13D831ec7');

      expect(mockDb.transfer.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { from: '0x1111111111111111111111111111111111111111' },
            { to: '0x1111111111111111111111111111111111111111' }
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
