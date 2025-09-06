# Story 003: Event Decoding

## Story Information
- **Epic**: EPIC-001: PoC Foundation - Blockchain Data Processing
- **Story ID**: STORY-003
- **Priority**: High
- **Story Points**: 8
- **Sprint**: Week 2, Day 1-2

## User Story

**As a** system  
**I want** to decode ERC-20 Transfer events  
**So that** I can extract structured data from raw logs  

## Acceptance Criteria

### Functional Requirements
- [ ] **ERC-20 Decoding**: Decode ERC-20 Transfer events from transaction logs
- [ ] **Data Extraction**: Extract from, to, amount from event data
- [ ] **Normalized Storage**: Store decoded events in normalized database format
- [ ] **ABI Handling**: Handle missing ABIs gracefully with fallback mechanisms
- [ ] **Token Support**: Support at least 3 popular ERC-20 tokens (USDT, USDC, DAI)

### Technical Requirements
- [ ] **EventDecoder Class**: Implement robust event decoding system
- [ ] **ABI Management**: Manage and cache contract ABIs
- [ ] **Error Handling**: Handle decoding failures without crashing
- [ ] **Performance**: Decode events efficiently without blocking
- [ ] **Validation**: Validate decoded data before storage

## Implementation Details

### EventDecoder Class
```typescript
// src/processing/event-decoder.ts
import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';

interface TransferEvent {
  from: string;
  to: string;
  amount: string;
  contract: string;
  txHash: string;
  logIndex: number;
}

interface DecodedEvent {
  eventName: string;
  args: any;
  contract: string;
  txHash: string;
  logIndex: number;
}

export class EventDecoder {
  private db: PrismaClient;
  private abiCache: Map<string, ethers.Interface> = new Map();
  
  // Common ERC-20 ABI
  private erc20Abi = [
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)"
  ];

  // Popular token addresses for testing
  private popularTokens = {
    '0xdAC17F958D2ee523a2206206994597C13D831ec7': 'USDT', // Tether
    '0xA0b86a33E6441c8C4C4C4C4C4C4C4C4C4C4C4C4C': 'USDC', // USD Coin
    '0x6B175474E89094C44Da98b954EedeAC495271d0F': 'DAI'   // Dai Stablecoin
  };

  constructor(db: PrismaClient) {
    this.db = db;
    this.initializeAbiCache();
  }

  private initializeAbiCache(): void {
    // Cache ERC-20 ABI for popular tokens
    const erc20Interface = new ethers.Interface(this.erc20Abi);
    
    Object.keys(this.popularTokens).forEach(address => {
      this.abiCache.set(address.toLowerCase(), erc20Interface);
    });
  }

  async decodeTransactionLogs(txHash: string, logs: ethers.Log[]): Promise<DecodedEvent[]> {
    const decodedEvents: DecodedEvent[] = [];

    for (const log of logs) {
      try {
        const decoded = await this.decodeLog(log);
        if (decoded) {
          decodedEvents.push(decoded);
        }
      } catch (error) {
        console.warn(`Failed to decode log in transaction ${txHash}:`, error);
        // Store raw log for debugging
        await this.storeRawEvent(log, txHash);
      }
    }

    return decodedEvents;
  }

  private async decodeLog(log: ethers.Log): Promise<DecodedEvent | null> {
    const contractAddress = log.address.toLowerCase();
    const interface = this.abiCache.get(contractAddress);

    if (!interface) {
      console.warn(`No ABI found for contract ${contractAddress}`);
      return null;
    }

    try {
      const decoded = interface.parseLog({
        topics: log.topics,
        data: log.data
      });

      if (!decoded) {
        return null;
      }

      return {
        eventName: decoded.name,
        args: decoded.args,
        contract: log.address,
        txHash: log.transactionHash,
        logIndex: log.logIndex
      };
    } catch (error) {
      console.warn(`Failed to parse log for contract ${contractAddress}:`, error);
      return null;
    }
  }

  async extractTransferEvents(decodedEvents: DecodedEvent[]): Promise<TransferEvent[]> {
    const transferEvents: TransferEvent[] = [];

    for (const event of decodedEvents) {
      if (event.eventName === 'Transfer') {
        const transferEvent: TransferEvent = {
          from: event.args.from,
          to: event.args.to,
          amount: event.args.value.toString(),
          contract: event.contract,
          txHash: event.txHash,
          logIndex: event.logIndex
        };
        transferEvents.push(transferEvent);
      }
    }

    return transferEvents;
  }

  async storeDecodedEvents(decodedEvents: DecodedEvent[]): Promise<void> {
    for (const event of decodedEvents) {
      try {
        await this.db.event.upsert({
          where: {
            txHash_logIndex: {
              txHash: event.txHash,
              logIndex: event.logIndex
            }
          },
          update: {
            contract: event.contract,
            eventName: event.eventName,
            args: event.args
          },
          create: {
            txHash: event.txHash,
            logIndex: event.logIndex,
            contract: event.contract,
            eventName: event.eventName,
            args: event.args
          }
        });
      } catch (error) {
        console.error(`Failed to store event ${event.txHash}:${event.logIndex}:`, error);
      }
    }
  }

  async storeTransferEvents(transferEvents: TransferEvent[]): Promise<void> {
    for (const transfer of transferEvents) {
      try {
        // Ensure token exists in database
        const token = await this.ensureTokenExists(transfer.contract);
        
        await this.db.transfer.create({
          data: {
            txHash: transfer.txHash,
            from: transfer.from,
            to: transfer.to,
            amount: transfer.amount,
            tokenId: token.id
          }
        });
        
        console.log(`Stored transfer: ${transfer.amount} from ${transfer.from} to ${transfer.to}`);
      } catch (error) {
        console.error(`Failed to store transfer ${transfer.txHash}:`, error);
      }
    }
  }

  private async ensureTokenExists(contractAddress: string): Promise<any> {
    const existingToken = await this.db.token.findUnique({
      where: { address: contractAddress }
    });

    if (existingToken) {
      return existingToken;
    }

    // Create token with basic info
    const tokenName = this.popularTokens[contractAddress] || 'Unknown';
    
    return await this.db.token.create({
      data: {
        address: contractAddress,
        name: tokenName,
        symbol: tokenName,
        decimals: 18, // Default, will be updated later
        totalSupply: '0'
      }
    });
  }

  private async storeRawEvent(log: ethers.Log, txHash: string): Promise<void> {
    try {
      await this.db.event.create({
        data: {
          txHash: txHash,
          logIndex: log.logIndex,
          contract: log.address,
          eventName: 'Unknown',
          args: {
            topics: log.topics,
            data: log.data
          }
        }
      });
    } catch (error) {
      console.error(`Failed to store raw event:`, error);
    }
  }

  async getDecodedEventsByContract(contractAddress: string, limit: number = 100): Promise<DecodedEvent[]> {
    const events = await this.db.event.findMany({
      where: {
        contract: contractAddress,
        eventName: { not: 'Unknown' }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return events.map(event => ({
      eventName: event.eventName,
      args: event.args,
      contract: event.contract,
      txHash: event.txHash,
      logIndex: event.logIndex
    }));
  }

  async getTransferEventsByAddress(address: string, limit: number = 100): Promise<TransferEvent[]> {
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
      contract: transfer.token.address,
      txHash: transfer.txHash,
      logIndex: 0 // Not stored in transfer table
    }));
  }
}
```

### Event Processing Pipeline
```typescript
// src/processing/event-processor.ts
import { ethers } from 'ethers';
import { EventDecoder } from './event-decoder';
import { PrismaClient } from '@prisma/client';

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
      console.log(`Processing events for transaction ${txHash}...`);
      
      // Get transaction receipt to access logs
      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt || !receipt.logs) {
        console.log(`No logs found for transaction ${txHash}`);
        return;
      }

      // Decode all logs
      const decodedEvents = await this.decoder.decodeTransactionLogs(txHash, receipt.logs);
      
      // Store decoded events
      await this.decoder.storeDecodedEvents(decodedEvents);
      
      // Extract and store transfer events
      const transferEvents = await this.decoder.extractTransferEvents(decodedEvents);
      await this.decoder.storeTransferEvents(transferEvents);
      
      console.log(`Processed ${decodedEvents.length} events, ${transferEvents.length} transfers for transaction ${txHash}`);
    } catch (error) {
      console.error(`Failed to process events for transaction ${txHash}:`, error);
      throw error;
    }
  }

  async processBlockEvents(blockNumber: number): Promise<void> {
    try {
      console.log(`Processing events for block ${blockNumber}...`);
      
      // Get all transactions in the block
      const transactions = await this.db.transaction.findMany({
        where: { blockNumber: BigInt(blockNumber) }
      });

      let totalEvents = 0;
      let totalTransfers = 0;

      for (const tx of transactions) {
        try {
          await this.processTransactionEvents(tx.hash);
          totalEvents++;
        } catch (error) {
          console.error(`Failed to process transaction ${tx.hash}:`, error);
        }
      }

      console.log(`Processed ${totalEvents} transactions in block ${blockNumber}`);
    } catch (error) {
      console.error(`Failed to process events for block ${blockNumber}:`, error);
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
      _count: { tokenId: true },
      include: {
        token: true
      }
    });

    return results.reduce((acc, result) => {
      const tokenAddress = result.token?.address || 'unknown';
      acc[tokenAddress] = result._count.tokenId;
      return acc;
    }, {} as Record<string, number>);
  }
}
```

### CLI Command for Testing
```typescript
// src/cli/decode-events.ts
import { PrismaClient } from '@prisma/client';
import { EventProcessor } from '../processing/event-processor';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const db = new PrismaClient();
  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
  
  try {
    const processor = new EventProcessor(provider, db);
    
    // Process events for the last 5 blocks
    const latestBlock = await db.block.findFirst({
      orderBy: { number: 'desc' }
    });
    
    if (!latestBlock) {
      console.log('No blocks found. Run data ingestion first.');
      return;
    }
    
    const startBlock = Number(latestBlock.number) - 4;
    const endBlock = Number(latestBlock.number);
    
    for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber++) {
      await processor.processBlockEvents(blockNumber);
    }
    
    // Show statistics
    const stats = await processor.getEventStatistics();
    console.log('Event processing statistics:', stats);
    
  } catch (error) {
    console.error('Event processing failed:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
```

## Definition of Done

### Code Quality
- [ ] EventDecoder class implemented with proper error handling
- [ ] ABI caching mechanism implemented
- [ ] All methods properly documented with JSDoc
- [ ] TypeScript types properly defined
- [ ] No hardcoded values (use configuration)

### Testing
- [ ] Unit tests for EventDecoder class
- [ ] Integration tests for event processing
- [ ] Error handling scenarios tested
- [ ] ABI parsing tested with various contracts
- [ ] Database storage operations tested

### Performance
- [ ] Successfully decode events from 10+ transactions
- [ ] Handle decoding failures without crashing
- [ ] Process events within reasonable time limits
- [ ] Memory usage remains stable during processing

### Data Quality
- [ ] All ERC-20 Transfer events properly decoded
- [ ] Transfer data stored in normalized format
- [ ] Token references properly maintained
- [ ] Raw events stored for debugging

## Testing Strategy

### Unit Tests
```typescript
// tests/event-decoder.test.ts
import { describe, it, expect, jest } from '@jest/globals';
import { EventDecoder } from '../src/processing/event-decoder';
import { PrismaClient } from '@prisma/client';

describe('EventDecoder', () => {
  let decoder: EventDecoder;
  let mockDb: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockDb = {
      event: {
        upsert: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn()
      },
      transfer: {
        create: jest.fn(),
        findMany: jest.fn()
      },
      token: {
        findUnique: jest.fn(),
        create: jest.fn()
      }
    } as any;

    decoder = new EventDecoder(mockDb);
  });

  it('should decode ERC-20 Transfer events', async () => {
    // Mock log data
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

    // Test decoding
    const decoded = await decoder.decodeTransactionLogs('0x123', [mockLog]);
    expect(decoded).toHaveLength(1);
    expect(decoded[0].eventName).toBe('Transfer');
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

    const decoded = await decoder.decodeTransactionLogs('0x789', [mockLog]);
    expect(decoded).toHaveLength(0);
  });
});
```

### Integration Tests
```typescript
// tests/event-processor.test.ts
import { describe, it, expect } from '@jest/globals';
import { EventProcessor } from '../src/processing/event-processor';

describe('EventProcessor', () => {
  it('should process transaction events', async () => {
    // Test full event processing flow
    // ...
  });

  it('should handle processing errors gracefully', async () => {
    // Test error handling
    // ...
  });
});
```

## Dependencies

### External Dependencies
- STORY-001: Environment Setup (PostgreSQL, Prisma)
- STORY-002: Basic Data Ingestion (transactions and blocks)

### Internal Dependencies
- ethers.js for log parsing
- Prisma for database operations
- Popular token addresses for testing

## Risks and Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| ABI parsing failures | Medium | Medium | Implement fallback mechanisms, store raw logs |
| Invalid event data | Medium | Low | Validate data before storage, handle edge cases |
| Performance issues | Medium | Low | Process events in batches, implement caching |
| Database storage failures | High | Low | Implement transaction rollback, error handling |
| Memory issues with large logs | Medium | Low | Process logs individually, implement streaming |

## Notes

- Focus on ERC-20 Transfer events for the PoC
- Implement ABI caching for performance
- Store raw logs for debugging purposes
- Consider implementing event filtering for production use

## Related Stories
- STORY-002: Basic Data Ingestion (dependency)
- STORY-004: Data API (uses decoded events)
- STORY-005: Token Metadata (uses decoded events)
