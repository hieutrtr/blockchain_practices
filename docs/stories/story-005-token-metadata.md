# Story 005: Token Metadata

## Story Information
- **Epic**: EPIC-001: PoC Foundation - Blockchain Data Processing
- **Story ID**: STORY-005
- **Priority**: Medium
- **Story Points**: 5
- **Sprint**: Week 3, Day 1-2

## User Story

**As a** system  
**I want** to enrich token data with metadata  
**So that** I can provide human-readable information  

## Acceptance Criteria

### Functional Requirements
- [ ] **Token Metadata Fetching**: Fetch token name, symbol, decimals, and total supply
- [ ] **Metadata Storage**: Store token metadata in database
- [ ] **Caching**: Cache metadata to avoid repeated contract calls
- [ ] **Error Handling**: Handle failed metadata fetches gracefully
- [ ] **Token Support**: Support at least 10 popular tokens

### Technical Requirements
- [ ] **TokenMetadataEnricher Class**: Implement robust metadata enrichment system
- [ ] **Contract Interaction**: Interact with ERC-20 contracts to fetch metadata
- [ ] **Fallback Handling**: Provide fallback values for failed fetches
- [ ] **Performance**: Cache metadata to minimize contract calls
- [ ] **Validation**: Validate metadata before storage

## Implementation Details

### TokenMetadataEnricher Class
```typescript
// src/enrichment/token-metadata.ts
import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';

interface TokenMetadata {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
}

interface EnrichmentResult {
  success: boolean;
  metadata?: TokenMetadata;
  error?: string;
}

export class TokenMetadataEnricher {
  private provider: ethers.Provider;
  private db: PrismaClient;
  private cache: Map<string, TokenMetadata> = new Map();
  private failedTokens: Set<string> = new Set();

  // ERC-20 standard functions
  private erc20Abi = [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)'
  ];

  // Popular token addresses for testing
  private popularTokens = {
    '0xdAC17F958D2ee523a2206206994597C13D831ec7': { name: 'Tether USD', symbol: 'USDT', decimals: 6 },
    '0xA0b86a33E6441c8C4C4C4C4C4C4C4C4C4C4C4C4C': { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
    '0x6B175474E89094C44Da98b954EedeAC495271d0F': { name: 'Dai Stablecoin', symbol: 'DAI', decimals: 18 },
    '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599': { name: 'Wrapped BTC', symbol: 'WBTC', decimals: 8 },
    '0x514910771AF9Ca656af840dff83E8264EcF986CA': { name: 'ChainLink Token', symbol: 'LINK', decimals: 18 },
    '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984': { name: 'Uniswap', symbol: 'UNI', decimals: 18 },
    '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0': { name: 'Polygon', symbol: 'MATIC', decimals: 18 },
    '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE': { name: 'SHIBA INU', symbol: 'SHIB', decimals: 18 },
    '0x4Fabb145d64652a948d72533023f6E7A623C7C53': { name: 'Binance USD', symbol: 'BUSD', decimals: 18 },
    '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2': { name: 'Maker', symbol: 'MKR', decimals: 18 }
  };

  constructor(provider: ethers.Provider, db: PrismaClient) {
    this.provider = provider;
    this.db = db;
    this.initializeCache();
  }

  private async initializeCache(): Promise<void> {
    // Load existing tokens from database
    const existingTokens = await this.db.token.findMany({
      where: {
        name: { not: null },
        symbol: { not: null }
      }
    });

    existingTokens.forEach(token => {
      if (token.name && token.symbol) {
        this.cache.set(token.address.toLowerCase(), {
          address: token.address,
          name: token.name,
          symbol: token.symbol,
          decimals: token.decimals || 18,
          totalSupply: token.totalSupply || '0'
        });
      }
    });

    console.log(`Initialized cache with ${this.cache.size} tokens`);
  }

  async enrichToken(address: string): Promise<EnrichmentResult> {
    const normalizedAddress = address.toLowerCase();

    // Check cache first
    if (this.cache.has(normalizedAddress)) {
      return {
        success: true,
        metadata: this.cache.get(normalizedAddress)
      };
    }

    // Check if we've already failed to fetch this token
    if (this.failedTokens.has(normalizedAddress)) {
      return {
        success: false,
        error: 'Token metadata fetch previously failed'
      };
    }

    try {
      console.log(`Enriching token metadata for ${address}...`);
      
      const metadata = await this.fetchTokenMetadata(address);
      
      if (metadata) {
        // Cache the result
        this.cache.set(normalizedAddress, metadata);
        
        // Store in database
        await this.storeTokenMetadata(metadata);
        
        return {
          success: true,
          metadata
        };
      } else {
        this.failedTokens.add(normalizedAddress);
        return {
          success: false,
          error: 'Failed to fetch token metadata'
        };
      }
    } catch (error) {
      console.error(`Error enriching token ${address}:`, error);
      this.failedTokens.add(normalizedAddress);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async fetchTokenMetadata(address: string): Promise<TokenMetadata | null> {
    try {
      const contract = new ethers.Contract(address, this.erc20Abi, this.provider);
      
      // Fetch all metadata in parallel
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        this.safeContractCall(contract.name()),
        this.safeContractCall(contract.symbol()),
        this.safeContractCall(contract.decimals()),
        this.safeContractCall(contract.totalSupply())
      ]);

      // Validate the results
      if (!name || !symbol || decimals === null) {
        console.warn(`Invalid metadata for token ${address}: name=${name}, symbol=${symbol}, decimals=${decimals}`);
        return null;
      }

      return {
        address,
        name: name.toString(),
        symbol: symbol.toString(),
        decimals: Number(decimals),
        totalSupply: totalSupply ? totalSupply.toString() : '0'
      };
    } catch (error) {
      console.error(`Contract call failed for token ${address}:`, error);
      return null;
    }
  }

  private async safeContractCall(call: Promise<any>): Promise<any> {
    try {
      const result = await call;
      return result;
    } catch (error) {
      console.warn('Contract call failed:', error);
      return null;
    }
  }

  private async storeTokenMetadata(metadata: TokenMetadata): Promise<void> {
    try {
      await this.db.token.upsert({
        where: { address: metadata.address },
        update: {
          name: metadata.name,
          symbol: metadata.symbol,
          decimals: metadata.decimals,
          totalSupply: metadata.totalSupply,
          updatedAt: new Date()
        },
        create: {
          address: metadata.address,
          name: metadata.name,
          symbol: metadata.symbol,
          decimals: metadata.decimals,
          totalSupply: metadata.totalSupply
        }
      });
      
      console.log(`Stored metadata for token ${metadata.symbol} (${metadata.address})`);
    } catch (error) {
      console.error(`Failed to store metadata for token ${metadata.address}:`, error);
      throw error;
    }
  }

  async enrichPopularTokens(): Promise<EnrichmentResult[]> {
    const results: EnrichmentResult[] = [];
    
    console.log('Enriching popular tokens...');
    
    for (const [address, knownInfo] of Object.entries(this.popularTokens)) {
      try {
        const result = await this.enrichToken(address);
        results.push(result);
        
        if (result.success) {
          console.log(`✅ Enriched ${result.metadata?.symbol} (${address})`);
        } else {
          console.log(`❌ Failed to enrich ${address}: ${result.error}`);
        }
      } catch (error) {
        console.error(`Error enriching popular token ${address}:`, error);
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return results;
  }

  async enrichTokensFromTransfers(): Promise<EnrichmentResult[]> {
    const results: EnrichmentResult[] = [];
    
    // Get unique token addresses from transfers
    const tokenAddresses = await this.db.transfer.findMany({
      select: { token: { select: { address: true } } },
      distinct: ['tokenId']
    });
    
    console.log(`Found ${tokenAddresses.length} unique tokens in transfers`);
    
    for (const { token } of tokenAddresses) {
      try {
        const result = await this.enrichToken(token.address);
        results.push(result);
        
        if (result.success) {
          console.log(`✅ Enriched ${result.metadata?.symbol} (${token.address})`);
        } else {
          console.log(`❌ Failed to enrich ${token.address}: ${result.error}`);
        }
      } catch (error) {
        console.error(`Error enriching token ${token.address}:`, error);
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return results;
  }

  async getEnrichmentStatistics(): Promise<{
    totalTokens: number;
    enrichedTokens: number;
    failedTokens: number;
    cacheSize: number;
  }> {
    const [totalTokens, enrichedTokens] = await Promise.all([
      this.db.token.count(),
      this.db.token.count({
        where: {
          name: { not: null },
          symbol: { not: null }
        }
      })
    ]);

    return {
      totalTokens,
      enrichedTokens,
      failedTokens: this.failedTokens.size,
      cacheSize: this.cache.size
    };
  }

  async getTokenMetadata(address: string): Promise<TokenMetadata | null> {
    const normalizedAddress = address.toLowerCase();
    return this.cache.get(normalizedAddress) || null;
  }

  async clearCache(): Promise<void> {
    this.cache.clear();
    this.failedTokens.clear();
    console.log('Token metadata cache cleared');
  }

  async refreshTokenMetadata(address: string): Promise<EnrichmentResult> {
    // Remove from cache and failed tokens to force refresh
    const normalizedAddress = address.toLowerCase();
    this.cache.delete(normalizedAddress);
    this.failedTokens.delete(normalizedAddress);
    
    return await this.enrichToken(address);
  }
}
```

### Metadata Enrichment Service
```typescript
// src/enrichment/metadata-service.ts
import { ethers } from 'ethers';
import { TokenMetadataEnricher } from './token-metadata';
import { PrismaClient } from '@prisma/client';

export class MetadataService {
  private enricher: TokenMetadataEnricher;
  private db: PrismaClient;

  constructor(provider: ethers.Provider, db: PrismaClient) {
    this.db = db;
    this.enricher = new TokenMetadataEnricher(provider, db);
  }

  async enrichAllTokens(): Promise<void> {
    console.log('Starting token metadata enrichment...');
    
    try {
      // First, enrich popular tokens
      console.log('Enriching popular tokens...');
      const popularResults = await this.enricher.enrichPopularTokens();
      const popularSuccess = popularResults.filter(r => r.success).length;
      console.log(`Enriched ${popularSuccess}/${popularResults.length} popular tokens`);
      
      // Then, enrich tokens from transfers
      console.log('Enriching tokens from transfers...');
      const transferResults = await this.enricher.enrichTokensFromTransfers();
      const transferSuccess = transferResults.filter(r => r.success).length;
      console.log(`Enriched ${transferSuccess}/${transferResults.length} tokens from transfers`);
      
      // Show statistics
      const stats = await this.enricher.getEnrichmentStatistics();
      console.log('Enrichment statistics:', stats);
      
    } catch (error) {
      console.error('Token enrichment failed:', error);
      throw error;
    }
  }

  async enrichToken(address: string): Promise<void> {
    const result = await this.enricher.enrichToken(address);
    
    if (result.success) {
      console.log(`Successfully enriched token ${result.metadata?.symbol} (${address})`);
    } else {
      console.error(`Failed to enrich token ${address}: ${result.error}`);
      throw new Error(result.error);
    }
  }

  async getEnrichmentStatus(): Promise<{
    totalTokens: number;
    enrichedTokens: number;
    failedTokens: number;
    cacheSize: number;
    enrichmentRate: number;
  }> {
    const stats = await this.enricher.getEnrichmentStatistics();
    
    return {
      ...stats,
      enrichmentRate: stats.totalTokens > 0 ? (stats.enrichedTokens / stats.totalTokens) * 100 : 0
    };
  }

  async getTokenMetadata(address: string): Promise<any> {
    const metadata = await this.enricher.getTokenMetadata(address);
    
    if (!metadata) {
      // Try to enrich the token
      const result = await this.enricher.enrichToken(address);
      if (result.success) {
        return result.metadata;
      }
    }
    
    return metadata;
  }

  async refreshTokenMetadata(address: string): Promise<void> {
    const result = await this.enricher.refreshTokenMetadata(address);
    
    if (result.success) {
      console.log(`Successfully refreshed token ${result.metadata?.symbol} (${address})`);
    } else {
      console.error(`Failed to refresh token ${address}: ${result.error}`);
      throw new Error(result.error);
    }
  }
}
```

### CLI Command for Testing
```typescript
// src/cli/enrich-metadata.ts
import { PrismaClient } from '@prisma/client';
import { MetadataService } from '../enrichment/metadata-service';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const db = new PrismaClient();
  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
  
  try {
    const metadataService = new MetadataService(provider, db);
    
    // Show current status
    const status = await metadataService.getEnrichmentStatus();
    console.log('Current enrichment status:', status);
    
    // Enrich all tokens
    await metadataService.enrichAllTokens();
    
    // Show final status
    const finalStatus = await metadataService.getEnrichmentStatus();
    console.log('Final enrichment status:', finalStatus);
    
    // Test individual token enrichment
    const testToken = '0xdAC17F958D2ee523a2206206994597C13D831ec7'; // USDT
    console.log(`\nTesting individual token enrichment for ${testToken}...`);
    const metadata = await metadataService.getTokenMetadata(testToken);
    console.log('Token metadata:', metadata);
    
  } catch (error) {
    console.error('Metadata enrichment failed:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
```

## Definition of Done

### Code Quality
- [ ] TokenMetadataEnricher class implemented with proper error handling
- [ ] Caching mechanism implemented for performance
- [ ] All methods properly documented with JSDoc
- [ ] TypeScript types properly defined
- [ ] No hardcoded values (use configuration)

### Testing
- [ ] Unit tests for TokenMetadataEnricher class
- [ ] Integration tests for metadata enrichment
- [ ] Error handling scenarios tested
- [ ] Caching behavior tested
- [ ] Database storage operations tested

### Performance
- [ ] Successfully enrich metadata for 10+ tokens
- [ ] Cache metadata to avoid repeated contract calls
- [ ] Handle enrichment failures without crashing
- [ ] Process tokens within reasonable time limits

### Data Quality
- [ ] All popular tokens properly enriched
- [ ] Metadata stored in normalized format
- [ ] Fallback values provided for failed fetches
- [ ] Cache properly maintained

## Testing Strategy

### Unit Tests
```typescript
// tests/token-metadata.test.ts
import { describe, it, expect, jest } from '@jest/globals';
import { TokenMetadataEnricher } from '../src/enrichment/token-metadata';
import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';

describe('TokenMetadataEnricher', () => {
  let enricher: TokenMetadataEnricher;
  let mockProvider: jest.Mocked<ethers.Provider>;
  let mockDb: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockProvider = {
      getNetwork: jest.fn(),
      getBlockNumber: jest.fn(),
      getBlock: jest.fn(),
      getTransaction: jest.fn(),
      getTransactionReceipt: jest.fn(),
      getLogs: jest.fn(),
      call: jest.fn(),
      estimateGas: jest.fn(),
      getFeeData: jest.fn(),
      resolveName: jest.fn(),
      lookupAddress: jest.fn(),
      getBalance: jest.fn(),
      getStorageAt: jest.fn(),
      getCode: jest.fn(),
      getTransactionCount: jest.fn(),
      sendTransaction: jest.fn(),
      waitForTransaction: jest.fn(),
      getResolver: jest.fn(),
      getAvatar: jest.fn(),
      getAddress: jest.fn(),
      getSigner: jest.fn(),
      getUncheckedSigner: jest.fn(),
      listAccounts: jest.fn(),
      createAccessList: jest.fn(),
      broadcastTransaction: jest.fn(),
      getBlockWithTransactions: jest.fn(),
      getTransactionResponse: jest.fn(),
      getTransactionResult: jest.fn(),
      getTransactionReceipt: jest.fn(),
      getTransactionReceiptResponse: jest.fn(),
      getTransactionReceiptResult: jest.fn(),
      getLogs: jest.fn(),
      getLogsResponse: jest.fn(),
      getLogsResult: jest.fn(),
      getBlock: jest.fn(),
      getBlockResponse: jest.fn(),
      getBlockResult: jest.fn(),
      getBlockWithTransactions: jest.fn(),
      getBlockWithTransactionsResponse: jest.fn(),
      getBlockWithTransactionsResult: jest.fn(),
      getBlockNumber: jest.fn(),
      getBlockNumberResponse: jest.fn(),
      getBlockNumberResult: jest.fn(),
      getNetwork: jest.fn(),
      getNetworkResponse: jest.fn(),
      getNetworkResult: jest.fn(),
      getFeeData: jest.fn(),
      getFeeDataResponse: jest.fn(),
      getFeeDataResult: jest.fn(),
      getBalance: jest.fn(),
      getBalanceResponse: jest.fn(),
      getBalanceResult: jest.fn(),
      getStorageAt: jest.fn(),
      getStorageAtResponse: jest.fn(),
      getStorageAtResult: jest.fn(),
      getCode: jest.fn(),
      getCodeResponse: jest.fn(),
      getCodeResult: jest.fn(),
      getTransactionCount: jest.fn(),
      getTransactionCountResponse: jest.fn(),
      getTransactionCountResult: jest.fn(),
      sendTransaction: jest.fn(),
      sendTransactionResponse: jest.fn(),
      sendTransactionResult: jest.fn(),
      waitForTransaction: jest.fn(),
      waitForTransactionResponse: jest.fn(),
      waitForTransactionResult: jest.fn(),
      getResolver: jest.fn(),
      getResolverResponse: jest.fn(),
      getResolverResult: jest.fn(),
      getAvatar: jest.fn(),
      getAvatarResponse: jest.fn(),
      getAvatarResult: jest.fn(),
      getAddress: jest.fn(),
      getAddressResponse: jest.fn(),
      getAddressResult: jest.fn(),
      getSigner: jest.fn(),
      getSignerResponse: jest.fn(),
      getSignerResult: jest.fn(),
      getUncheckedSigner: jest.fn(),
      getUncheckedSignerResponse: jest.fn(),
      getUncheckedSignerResult: jest.fn(),
      listAccounts: jest.fn(),
      listAccountsResponse: jest.fn(),
      listAccountsResult: jest.fn(),
      createAccessList: jest.fn(),
      createAccessListResponse: jest.fn(),
      createAccessListResult: jest.fn(),
      broadcastTransaction: jest.fn(),
      broadcastTransactionResponse: jest.fn(),
      broadcastTransactionResult: jest.fn()
    } as any;

    mockDb = {
      token: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      }
    } as any;

    enricher = new TokenMetadataEnricher(mockProvider, mockDb);
  });

  it('should enrich token metadata', async () => {
    // Mock contract calls
    const mockContract = {
      name: jest.fn().mockResolvedValue('Test Token'),
      symbol: jest.fn().mockResolvedValue('TEST'),
      decimals: jest.fn().mockResolvedValue(18),
      totalSupply: jest.fn().mockResolvedValue('1000000')
    };

    // Mock ethers.Contract constructor
    jest.spyOn(ethers, 'Contract').mockImplementation(() => mockContract as any);

    const result = await enricher.enrichToken('0xTestToken');
    
    expect(result.success).toBe(true);
    expect(result.metadata?.name).toBe('Test Token');
    expect(result.metadata?.symbol).toBe('TEST');
    expect(result.metadata?.decimals).toBe(18);
  });

  it('should handle contract call failures', async () => {
    // Mock contract calls to fail
    const mockContract = {
      name: jest.fn().mockRejectedValue(new Error('Contract call failed')),
      symbol: jest.fn().mockResolvedValue('TEST'),
      decimals: jest.fn().mockResolvedValue(18),
      totalSupply: jest.fn().mockResolvedValue('1000000')
    };

    jest.spyOn(ethers, 'Contract').mockImplementation(() => mockContract as any);

    const result = await enricher.enrichToken('0xTestToken');
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should cache token metadata', async () => {
    // Mock successful contract calls
    const mockContract = {
      name: jest.fn().mockResolvedValue('Test Token'),
      symbol: jest.fn().mockResolvedValue('TEST'),
      decimals: jest.fn().mockResolvedValue(18),
      totalSupply: jest.fn().mockResolvedValue('1000000')
    };

    jest.spyOn(ethers, 'Contract').mockImplementation(() => mockContract as any);

    // First call should fetch from contract
    const result1 = await enricher.enrichToken('0xTestToken');
    expect(result1.success).toBe(true);

    // Second call should use cache
    const result2 = await enricher.enrichToken('0xTestToken');
    expect(result2.success).toBe(true);
    expect(result2.metadata).toEqual(result1.metadata);
  });
});
```

### Integration Tests
```typescript
// tests/metadata-service.test.ts
import { describe, it, expect } from '@jest/globals';
import { MetadataService } from '../src/enrichment/metadata-service';

describe('MetadataService', () => {
  it('should enrich all tokens', async () => {
    // Test full enrichment flow
    // ...
  });

  it('should handle enrichment errors gracefully', async () => {
    // Test error handling
    // ...
  });
});
```

## Dependencies

### External Dependencies
- STORY-001: Environment Setup (PostgreSQL, Prisma)
- STORY-002: Basic Data Ingestion (transactions and blocks)
- STORY-003: Event Decoding (transfers and events)

### Internal Dependencies
- ethers.js for contract interaction
- Prisma for database operations
- Popular token addresses for testing

## Risks and Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Contract call failures | Medium | Medium | Implement fallback mechanisms, cache results |
| Invalid token contracts | Medium | Low | Validate contract responses, handle edge cases |
| Performance issues | Medium | Low | Implement caching, batch processing |
| Database storage failures | High | Low | Implement transaction rollback, error handling |
| Memory issues with large datasets | Medium | Low | Process tokens individually, implement streaming |

## Notes

- Focus on popular ERC-20 tokens for the PoC
- Implement caching to minimize contract calls
- Store fallback values for failed fetches
- Consider implementing batch processing for production use

## Related Stories
- STORY-001: Environment Setup (dependency)
- STORY-002: Basic Data Ingestion (dependency)
- STORY-003: Event Decoding (dependency)
- STORY-004: Data API (enhances API responses)
