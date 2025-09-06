import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { BlockchainFetcher } from '../src/ingestion/blockchain-fetcher';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './config.env' });

describe('Environment Setup', () => {
  let db: PrismaClient;

  beforeAll(async () => {
    db = new PrismaClient();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('should have required environment variables', () => {
    expect(process.env.DATABASE_URL).toBeDefined();
    expect(process.env.ETH_RPC_URL).toBeDefined();
    expect(process.env.API_PORT).toBeDefined();
  });

  it('should connect to database', async () => {
    const result = await db.$queryRaw`SELECT 1 as test`;
    expect(result).toBeDefined();
  });

  it('should have database schema tables', async () => {
    // Test that all required tables exist by querying them
    const tables = ['block', 'transaction', 'event', 'token', 'transfer'];
    
    for (const table of tables) {
      try {
        await db.$queryRawUnsafe(`SELECT 1 FROM ${table} LIMIT 1`);
      } catch (error) {
        // If table doesn't exist, the query will fail
        throw new Error(`Table ${table} does not exist or is not accessible`);
      }
    }
  });

  it('should connect to Ethereum RPC', async () => {
    const fetcher = new BlockchainFetcher();
    const connectionTest = await fetcher.testConnection();
    
    expect(connectionTest.success).toBe(true);
    expect(connectionTest.blockNumber).toBeGreaterThan(0);
  });

  it('should get network information', async () => {
    const fetcher = new BlockchainFetcher();
    const networkInfo = await fetcher.getNetworkInfo();
    
    expect(networkInfo.chainId).toBeGreaterThan(0);
    expect(networkInfo.name).toBeDefined();
  });
});
