import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './config.env' });

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
  private popularTokens: Record<string, string> = {
    '0xdAC17F958D2ee523a2206206994597C13D831ec7': 'USDT', // Tether
    '0xA0b86a33E6441c8C4C4C4C4C4C4C4C4C4C4C4C': 'USDC', // USD Coin
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
    const contractInterface = this.abiCache.get(contractAddress);

    if (!contractInterface) {
      console.warn(`No ABI found for contract ${contractAddress}`);
      return null;
    }

    try {
      const decoded = contractInterface.parseLog({
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
        logIndex: (log as any).logIndex || 0
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
        
        console.log(`✅ Stored transfer: ${transfer.amount} from ${transfer.from} to ${transfer.to}`);
      } catch (error) {
        console.error(`❌ Failed to store transfer ${transfer.txHash}:`, error);
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
          logIndex: (log as any).logIndex || 0,
          contract: log.address,
          eventName: 'Unknown',
          args: {
            topics: log.topics,
            data: log.data
          }
        }
      });
    } catch (error) {
      console.error(`❌ Failed to store raw event:`, error);
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
