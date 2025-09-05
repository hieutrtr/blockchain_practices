# EPIC-003: Data Enrichment - Token Metadata & Pricing

## Overview

**Goal**: Enrich processed blockchain data with external metadata, pricing information, and contextual data to provide comprehensive insights for DeFi applications.

**Duration**: 2-3 weeks  
**Complexity**: Medium  
**Phase**: Phase 2 (Enhancement)  

## Business Value

- **Rich Data**: Provide comprehensive token and NFT metadata
- **Pricing Context**: Add USD valuations and historical pricing
- **User Experience**: Enable human-readable data for applications
- **Analytics**: Support advanced analytics and reporting
- **Competitive Advantage**: Offer enriched data that competitors lack

## Epic Scope

### In Scope
- Token metadata enrichment (name, symbol, decimals, total supply)
- NFT metadata enrichment (images, attributes, descriptions)
- Real-time and historical pricing data
- Protocol and contract labeling
- Metadata caching and refresh strategies
- Data quality validation

### Out of Scope
- Advanced DeFi analytics (handled in Epic 004)
- Multi-chain support (handled in Epic 006)
- Real-time streaming (handled in later epics)
- Custom metadata sources (handled in Epic 008)

## Technical Requirements

### Enrichment Sources
```typescript
// Token Metadata Sources
- On-chain contract calls (name, symbol, decimals)
- Etherscan API (verified contracts)
- CoinGecko API (market data)
- CoinMarketCap API (pricing data)

// NFT Metadata Sources
- IPFS gateways (tokenURI)
- OpenSea API (collection data)
- Rarible API (marketplace data)
- Custom metadata services

// Pricing Sources
- Chainlink oracles (on-chain)
- CoinGecko API (off-chain)
- CoinMarketCap API (backup)
- Kaiko API (institutional)
```

### Tech Stack Additions
```typescript
// Additional Technologies
- Redis for metadata caching
- Axios for HTTP requests
- Node-cron for scheduled tasks
- Sharp for image processing
- IPFS for decentralized storage
```

## User Stories

### US-003-001: Token Metadata Enrichment
**As a** system  
**I want** to enrich tokens with comprehensive metadata  
**So that** applications can display human-readable information  

**Acceptance Criteria:**
- [ ] Fetch token name, symbol, decimals from contracts
- [ ] Retrieve market data from external APIs
- [ ] Store metadata with versioning and timestamps
- [ ] Cache metadata to reduce API calls
- [ ] Handle missing or invalid metadata gracefully

### US-003-002: NFT Metadata Enrichment
**As a** system  
**I want** to enrich NFTs with images and attributes  
**So that** applications can display rich NFT content  

**Acceptance Criteria:**
- [ ] Fetch NFT metadata from IPFS
- [ ] Process and validate image URLs
- [ ] Extract and normalize attributes
- [ ] Handle different metadata standards
- [ ] Cache processed metadata

### US-003-003: Pricing Data Integration
**As a** system  
**I want** to provide real-time and historical pricing  
**So that** applications can show USD valuations  

**Acceptance Criteria:**
- [ ] Integrate multiple pricing sources
- [ ] Provide real-time price updates
- [ ] Store historical price data
- [ ] Handle price discrepancies between sources
- [ ] Implement price validation and sanity checks

### US-003-004: Protocol Labeling
**As a** system  
**I want** to label contracts with protocol information  
**So that** users can understand the context of transactions  

**Acceptance Criteria:**
- [ ] Identify DeFi protocols from contract addresses
- [ ] Label contract functions and events
- [ ] Provide protocol-specific metadata
- [ ] Support protocol versioning
- [ ] Handle protocol migrations and updates

### US-003-005: Metadata Refresh Management
**As a** system  
**I want** to manage metadata refresh cycles  
**So that** data remains current and accurate  

**Acceptance Criteria:**
- [ ] Implement scheduled metadata refresh
- [ ] Prioritize refresh based on usage
- [ ] Handle refresh failures and retries
- [ ] Monitor refresh performance
- [ ] Provide manual refresh capabilities

## Implementation Plan

### Week 1: Token Metadata Foundation
**Day 1-2: Database Schema**
```sql
-- Token Metadata Tables
CREATE TABLE token_metadata (
  id SERIAL PRIMARY KEY,
  address VARCHAR(42) UNIQUE NOT NULL,
  name VARCHAR(100),
  symbol VARCHAR(20),
  decimals INTEGER,
  total_supply VARCHAR(78),
  logo_url TEXT,
  description TEXT,
  website_url TEXT,
  twitter_url TEXT,
  discord_url TEXT,
  telegram_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_refreshed TIMESTAMP DEFAULT NOW()
);

CREATE TABLE token_prices (
  id SERIAL PRIMARY KEY,
  token_address VARCHAR(42) NOT NULL,
  price_usd DECIMAL(20,8),
  market_cap DECIMAL(20,2),
  volume_24h DECIMAL(20,2),
  price_change_24h DECIMAL(8,4),
  source VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (token_address) REFERENCES token_metadata(address)
);

CREATE TABLE nft_metadata (
  id SERIAL PRIMARY KEY,
  contract_address VARCHAR(42) NOT NULL,
  token_id VARCHAR(78) NOT NULL,
  name VARCHAR(200),
  description TEXT,
  image_url TEXT,
  animation_url TEXT,
  external_url TEXT,
  attributes JSONB,
  collection_name VARCHAR(100),
  collection_description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(contract_address, token_id)
);

CREATE INDEX idx_token_prices_address_timestamp ON token_prices(token_address, timestamp);
CREATE INDEX idx_nft_metadata_contract_token ON nft_metadata(contract_address, token_id);
```

**Day 3-4: Token Metadata Service**
```typescript
// src/enrichment/token-metadata-service.ts
import { ethers } from 'ethers';
import axios from 'axios';

export class TokenMetadataService {
  private provider: ethers.Provider;
  private db: PrismaClient;
  private cache: Redis;
  
  async enrichToken(address: string): Promise<TokenMetadata> {
    // Check cache first
    const cached = await this.cache.get(`token:${address}`);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Fetch from multiple sources
    const [onChainData, marketData] = await Promise.allSettled([
      this.fetchOnChainMetadata(address),
      this.fetchMarketData(address)
    ]);
    
    const metadata: TokenMetadata = {
      address,
      name: onChainData.status === 'fulfilled' ? onChainData.value.name : null,
      symbol: onChainData.status === 'fulfilled' ? onChainData.value.symbol : null,
      decimals: onChainData.status === 'fulfilled' ? onChainData.value.decimals : null,
      totalSupply: onChainData.status === 'fulfilled' ? onChainData.value.totalSupply : null,
      logoUrl: marketData.status === 'fulfilled' ? marketData.value.logoUrl : null,
      description: marketData.status === 'fulfilled' ? marketData.value.description : null,
      websiteUrl: marketData.status === 'fulfilled' ? marketData.value.websiteUrl : null,
      lastRefreshed: new Date()
    };
    
    // Store in database
    await this.storeTokenMetadata(metadata);
    
    // Cache for 1 hour
    await this.cache.setex(`token:${address}`, 3600, JSON.stringify(metadata));
    
    return metadata;
  }
  
  private async fetchOnChainMetadata(address: string): Promise<OnChainMetadata> {
    const contract = new ethers.Contract(address, [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
      'function totalSupply() view returns (uint256)'
    ], this.provider);
    
    try {
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals(),
        contract.totalSupply()
      ]);
      
      return {
        name,
        symbol,
        decimals,
        totalSupply: totalSupply.toString()
      };
    } catch (error) {
      throw new Error(`Failed to fetch on-chain metadata: ${error.message}`);
    }
  }
  
  private async fetchMarketData(address: string): Promise<MarketData> {
    try {
      // Try CoinGecko first
      const coingeckoData = await this.fetchCoinGeckoData(address);
      if (coingeckoData) {
        return coingeckoData;
      }
      
      // Fallback to CoinMarketCap
      const cmcData = await this.fetchCoinMarketCapData(address);
      if (cmcData) {
        return cmcData;
      }
      
      throw new Error('No market data available');
    } catch (error) {
      throw new Error(`Failed to fetch market data: ${error.message}`);
    }
  }
  
  private async fetchCoinGeckoData(address: string): Promise<MarketData | null> {
    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/coins/ethereum/contract/${address}`,
        {
          timeout: 5000,
          headers: {
            'Accept': 'application/json'
          }
        }
      );
      
      const data = response.data;
      return {
        logoUrl: data.image?.large,
        description: data.description?.en,
        websiteUrl: data.links?.homepage?.[0],
        twitterUrl: data.links?.twitter_screen_name ? 
          `https://twitter.com/${data.links.twitter_screen_name}` : null,
        discordUrl: data.links?.chat_url?.find((url: string) => url.includes('discord')),
        telegramUrl: data.links?.chat_url?.find((url: string) => url.includes('t.me'))
      };
    } catch (error) {
      if (error.response?.status === 404) {
        return null; // Token not found
      }
      throw error;
    }
  }
}
```

**Day 5: NFT Metadata Service**
```typescript
// src/enrichment/nft-metadata-service.ts
export class NFTMetadataService {
  private db: PrismaClient;
  private cache: Redis;
  private ipfsGateways = [
    'https://ipfs.io/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/'
  ];
  
  async enrichNFT(contractAddress: string, tokenId: string): Promise<NFTMetadata> {
    const cacheKey = `nft:${contractAddress}:${tokenId}`;
    
    // Check cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Fetch metadata
    const metadata = await this.fetchNFTMetadata(contractAddress, tokenId);
    
    // Store in database
    await this.storeNFTMetadata(metadata);
    
    // Cache for 24 hours
    await this.cache.setex(cacheKey, 86400, JSON.stringify(metadata));
    
    return metadata;
  }
  
  private async fetchNFTMetadata(contractAddress: string, tokenId: string): Promise<NFTMetadata> {
    try {
      // Get tokenURI from contract
      const tokenURI = await this.getTokenURI(contractAddress, tokenId);
      
      if (!tokenURI) {
        throw new Error('No tokenURI found');
      }
      
      // Fetch metadata from IPFS
      const metadata = await this.fetchFromIPFS(tokenURI);
      
      // Validate and normalize metadata
      return this.normalizeNFTMetadata(contractAddress, tokenId, metadata);
    } catch (error) {
      // Return minimal metadata on failure
      return {
        contractAddress,
        tokenId,
        name: `Token #${tokenId}`,
        description: 'Metadata not available',
        imageUrl: null,
        attributes: []
      };
    }
  }
  
  private async fetchFromIPFS(uri: string): Promise<any> {
    const ipfsUrl = this.convertToIPFSUrl(uri);
    
    for (const gateway of this.ipfsGateways) {
      try {
        const response = await axios.get(ipfsUrl, {
          timeout: 10000,
          headers: {
            'Accept': 'application/json'
          }
        });
        
        return response.data;
      } catch (error) {
        console.warn(`Failed to fetch from gateway ${gateway}:`, error.message);
        continue;
      }
    }
    
    throw new Error('All IPFS gateways failed');
  }
  
  private convertToIPFSUrl(uri: string): string {
    if (uri.startsWith('ipfs://')) {
      return uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }
    if (uri.startsWith('https://')) {
      return uri;
    }
    throw new Error(`Unsupported URI format: ${uri}`);
  }
  
  private normalizeNFTMetadata(
    contractAddress: string,
    tokenId: string,
    rawMetadata: any
  ): NFTMetadata {
    return {
      contractAddress,
      tokenId,
      name: rawMetadata.name || `Token #${tokenId}`,
      description: rawMetadata.description || '',
      imageUrl: this.normalizeImageUrl(rawMetadata.image),
      animationUrl: rawMetadata.animation_url || null,
      externalUrl: rawMetadata.external_url || null,
      attributes: this.normalizeAttributes(rawMetadata.attributes),
      collectionName: rawMetadata.collection?.name || null,
      collectionDescription: rawMetadata.collection?.description || null
    };
  }
}
```

### Week 2: Pricing Integration
**Day 1-2: Pricing Service**
```typescript
// src/enrichment/pricing-service.ts
export class PricingService {
  private db: PrismaClient;
  private cache: Redis;
  private sources = [
    new ChainlinkPriceSource(),
    new CoinGeckoPriceSource(),
    new CoinMarketCapPriceSource()
  ];
  
  async getTokenPrice(address: string): Promise<TokenPrice> {
    const cacheKey = `price:${address}`;
    
    // Check cache first (5 minute cache)
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Fetch from multiple sources
    const prices = await Promise.allSettled(
      this.sources.map(source => source.getPrice(address))
    );
    
    const validPrices = prices
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<TokenPrice>).value);
    
    if (validPrices.length === 0) {
      throw new Error('No valid prices available');
    }
    
    // Calculate weighted average
    const finalPrice = this.calculateWeightedAverage(validPrices);
    
    // Store in database
    await this.storeTokenPrice(address, finalPrice);
    
    // Cache for 5 minutes
    await this.cache.setex(cacheKey, 300, JSON.stringify(finalPrice));
    
    return finalPrice;
  }
  
  private calculateWeightedAverage(prices: TokenPrice[]): TokenPrice {
    // Weight sources by reliability
    const weights = {
      chainlink: 0.5,
      coingecko: 0.3,
      coinmarketcap: 0.2
    };
    
    let totalWeight = 0;
    let weightedPrice = 0;
    let weightedMarketCap = 0;
    let weightedVolume = 0;
    
    prices.forEach(price => {
      const weight = weights[price.source] || 0.1;
      totalWeight += weight;
      weightedPrice += price.priceUsd * weight;
      weightedMarketCap += (price.marketCap || 0) * weight;
      weightedVolume += (price.volume24h || 0) * weight;
    });
    
    return {
      tokenAddress: prices[0].tokenAddress,
      priceUsd: weightedPrice / totalWeight,
      marketCap: weightedMarketCap / totalWeight,
      volume24h: weightedVolume / totalWeight,
      priceChange24h: this.calculateAveragePriceChange(prices),
      source: 'aggregated',
      timestamp: new Date()
    };
  }
  
  async getHistoricalPrices(
    address: string,
    days: number = 30
  ): Promise<HistoricalPrice[]> {
    const cacheKey = `historical:${address}:${days}`;
    
    // Check cache first (1 hour cache)
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Fetch from CoinGecko
    const historicalData = await this.fetchHistoricalData(address, days);
    
    // Store in database
    await this.storeHistoricalPrices(address, historicalData);
    
    // Cache for 1 hour
    await this.cache.setex(cacheKey, 3600, JSON.stringify(historicalData));
    
    return historicalData;
  }
}
```

**Day 3-4: Price Source Implementations**
```typescript
// src/enrichment/price-sources/chainlink-price-source.ts
export class ChainlinkPriceSource implements PriceSource {
  private provider: ethers.Provider;
  private priceFeeds = new Map<string, string>([
    ['0xA0b86a33E6441c8C4C4C4C4C4C4C4C4C4C4C4C4C', '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419'], // ETH/USD
    ['0x6B175474E89094C44Da98b954EedeAC495271d0F', '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9']  // DAI/USD
  ]);
  
  async getPrice(tokenAddress: string): Promise<TokenPrice> {
    const priceFeedAddress = this.priceFeeds.get(tokenAddress);
    
    if (!priceFeedAddress) {
      throw new Error(`No Chainlink price feed for token ${tokenAddress}`);
    }
    
    const priceFeed = new ethers.Contract(priceFeedAddress, [
      'function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)'
    ], this.provider);
    
    const [, price, , , ] = await priceFeed.latestRoundData();
    
    return {
      tokenAddress,
      priceUsd: Number(ethers.formatUnits(price, 8)), // Chainlink uses 8 decimals
      source: 'chainlink',
      timestamp: new Date()
    };
  }
}

// src/enrichment/price-sources/coingecko-price-source.ts
export class CoinGeckoPriceSource implements PriceSource {
  async getPrice(tokenAddress: string): Promise<TokenPrice> {
    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/token_price/ethereum`,
        {
          params: {
            contract_addresses: tokenAddress,
            vs_currencies: 'usd',
            include_market_cap: true,
            include_24hr_vol: true,
            include_24hr_change: true
          },
          timeout: 5000
        }
      );
      
      const data = response.data[tokenAddress.toLowerCase()];
      
      if (!data) {
        throw new Error('Token not found');
      }
      
      return {
        tokenAddress,
        priceUsd: data.usd,
        marketCap: data.usd_market_cap,
        volume24h: data.usd_24h_vol,
        priceChange24h: data.usd_24h_change,
        source: 'coingecko',
        timestamp: new Date()
      };
    } catch (error) {
      throw new Error(`CoinGecko API error: ${error.message}`);
    }
  }
}
```

**Day 5: Protocol Labeling**
```typescript
// src/enrichment/protocol-labeling-service.ts
export class ProtocolLabelingService {
  private db: PrismaClient;
  private protocolRegistry = new Map<string, ProtocolInfo>([
    ['0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', {
      name: 'Uniswap V2',
      protocol: 'dex',
      version: 'v2',
      description: 'Uniswap V2 Router'
    }],
    ['0xE592427A0AEce92De3Edee1F18E0157C05861564', {
      name: 'Uniswap V3',
      protocol: 'dex',
      version: 'v3',
      description: 'Uniswap V3 Router'
    }],
    ['0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9', {
      name: 'Aave Lending Pool',
      protocol: 'lending',
      version: 'v2',
      description: 'Aave V2 Lending Pool'
    }]
  ]);
  
  async labelContract(address: string): Promise<ProtocolInfo | null> {
    // Check registry first
    const protocolInfo = this.protocolRegistry.get(address);
    if (protocolInfo) {
      return protocolInfo;
    }
    
    // Try to identify from contract code
    const identified = await this.identifyContract(address);
    if (identified) {
      // Store in registry for future use
      this.protocolRegistry.set(address, identified);
      return identified;
    }
    
    return null;
  }
  
  private async identifyContract(address: string): Promise<ProtocolInfo | null> {
    try {
      // Get contract code
      const code = await this.provider.getCode(address);
      
      if (code === '0x') {
        return null; // EOA
      }
      
      // Check for known function selectors
      const selectors = this.extractFunctionSelectors(code);
      
      // Identify protocol based on function selectors
      if (this.hasUniswapSelectors(selectors)) {
        return {
          name: 'Uniswap',
          protocol: 'dex',
          version: 'unknown',
          description: 'Uniswap-compatible DEX'
        };
      }
      
      if (this.hasAaveSelectors(selectors)) {
        return {
          name: 'Aave',
          protocol: 'lending',
          version: 'unknown',
          description: 'Aave-compatible lending protocol'
        };
      }
      
      return null;
    } catch (error) {
      console.error(`Failed to identify contract ${address}:`, error);
      return null;
    }
  }
}
```

### Week 3: Refresh Management & Testing
**Day 1-2: Refresh Management**
```typescript
// src/enrichment/refresh-manager.ts
import cron from 'node-cron';

export class RefreshManager {
  private db: PrismaClient;
  private tokenService: TokenMetadataService;
  private pricingService: PricingService;
  
  constructor() {
    this.setupScheduledTasks();
  }
  
  private setupScheduledTasks(): void {
    // Refresh token metadata every 24 hours
    cron.schedule('0 2 * * *', async () => {
      await this.refreshTokenMetadata();
    });
    
    // Refresh prices every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      await this.refreshPrices();
    });
    
    // Refresh NFT metadata every 7 days
    cron.schedule('0 3 * * 0', async () => {
      await this.refreshNFTMetadata();
    });
  }
  
  async refreshTokenMetadata(): Promise<void> {
    const tokens = await this.db.tokenMetadata.findMany({
      where: {
        OR: [
          { lastRefreshed: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          { lastRefreshed: null }
        ]
      },
      orderBy: { lastRefreshed: 'asc' },
      take: 100
    });
    
    for (const token of tokens) {
      try {
        await this.tokenService.enrichToken(token.address);
        console.log(`Refreshed metadata for token ${token.address}`);
      } catch (error) {
        console.error(`Failed to refresh token ${token.address}:`, error);
      }
    }
  }
  
  async refreshPrices(): Promise<void> {
    const tokens = await this.db.tokenMetadata.findMany({
      select: { address: true }
    });
    
    for (const token of tokens) {
      try {
        await this.pricingService.getTokenPrice(token.address);
      } catch (error) {
        console.error(`Failed to refresh price for token ${token.address}:`, error);
      }
    }
  }
}
```

**Day 3-4: Comprehensive Testing**
```typescript
// tests/enrichment/token-metadata-service.test.ts
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('TokenMetadataService', () => {
  let service: TokenMetadataService;
  let mockProvider: ethers.Provider;
  let mockDb: PrismaClient;
  let mockCache: Redis;
  
  beforeEach(() => {
    mockProvider = createMockProvider();
    mockDb = createMockDb();
    mockCache = createMockCache();
    service = new TokenMetadataService(mockProvider, mockDb, mockCache);
  });
  
  it('should enrich token with on-chain metadata', async () => {
    const mockContract = {
      name: () => Promise.resolve('Test Token'),
      symbol: () => Promise.resolve('TEST'),
      decimals: () => Promise.resolve(18),
      totalSupply: () => Promise.resolve(ethers.parseEther('1000000'))
    };
    
    jest.spyOn(ethers, 'Contract').mockReturnValue(mockContract as any);
    
    const result = await service.enrichToken('0x...');
    
    expect(result.name).toBe('Test Token');
    expect(result.symbol).toBe('TEST');
    expect(result.decimals).toBe(18);
    expect(result.totalSupply).toBe('1000000000000000000000000');
  });
  
  it('should handle missing on-chain metadata gracefully', async () => {
    const mockContract = {
      name: () => Promise.reject(new Error('Function not found')),
      symbol: () => Promise.reject(new Error('Function not found')),
      decimals: () => Promise.reject(new Error('Function not found')),
      totalSupply: () => Promise.reject(new Error('Function not found'))
    };
    
    jest.spyOn(ethers, 'Contract').mockReturnValue(mockContract as any);
    
    const result = await service.enrichToken('0x...');
    
    expect(result.name).toBeNull();
    expect(result.symbol).toBeNull();
    expect(result.decimals).toBeNull();
    expect(result.totalSupply).toBeNull();
  });
  
  it('should cache enriched metadata', async () => {
    const mockContract = createMockContract();
    jest.spyOn(ethers, 'Contract').mockReturnValue(mockContract as any);
    
    // First call
    await service.enrichToken('0x...');
    
    // Second call should use cache
    await service.enrichToken('0x...');
    
    expect(mockContract.name).toHaveBeenCalledTimes(1);
  });
});
```

**Day 5: Integration & Documentation**
```typescript
// src/enrichment/enrichment-service.ts
export class EnrichmentService {
  private tokenService: TokenMetadataService;
  private nftService: NFTMetadataService;
  private pricingService: PricingService;
  private protocolService: ProtocolLabelingService;
  
  async enrichTransfer(transfer: NormalizedTransfer): Promise<EnrichedTransfer> {
    const [tokenMetadata, price] = await Promise.allSettled([
      this.tokenService.enrichToken(transfer.contract),
      this.pricingService.getTokenPrice(transfer.contract)
    ]);
    
    return {
      ...transfer,
      tokenName: tokenMetadata.status === 'fulfilled' ? tokenMetadata.value.name : null,
      tokenSymbol: tokenMetadata.status === 'fulfilled' ? tokenMetadata.value.symbol : null,
      tokenDecimals: tokenMetadata.status === 'fulfilled' ? tokenMetadata.value.decimals : null,
      priceUsd: price.status === 'fulfilled' ? price.value.priceUsd : null,
      valueUsd: price.status === 'fulfilled' ? 
        this.calculateValueUsd(transfer.amount, price.value.priceUsd, tokenMetadata.value?.decimals) : null
    };
  }
  
  async enrichEvent(event: DecodedEvent): Promise<EnrichedEvent> {
    const protocolInfo = await this.protocolService.labelContract(event.contract);
    
    return {
      ...event,
      protocolName: protocolInfo?.name || null,
      protocolType: protocolInfo?.protocol || null,
      protocolVersion: protocolInfo?.version || null
    };
  }
  
  private calculateValueUsd(amount: string, priceUsd: number, decimals: number): number {
    const normalizedAmount = Number(ethers.formatUnits(amount, decimals));
    return normalizedAmount * priceUsd;
  }
}
```

## Acceptance Criteria

### Functional Requirements
- [ ] **Token Metadata**: Enrich tokens with name, symbol, decimals, total supply
- [ ] **NFT Metadata**: Enrich NFTs with images, attributes, descriptions
- [ ] **Pricing Data**: Provide real-time and historical pricing
- [ ] **Protocol Labeling**: Identify and label DeFi protocols
- [ ] **Refresh Management**: Automated metadata refresh cycles

### Non-Functional Requirements
- [ ] **Performance**: <5s response time for metadata enrichment
- [ ] **Reliability**: 99%+ success rate for metadata fetching
- [ ] **Caching**: Efficient caching to reduce API calls
- [ ] **Error Handling**: Graceful handling of API failures
- [ ] **Data Quality**: Validation and quality checks

### Quality Requirements
- [ ] **Coverage**: Support for 100+ popular tokens
- [ ] **Accuracy**: 95%+ accuracy for metadata enrichment
- [ ] **Freshness**: Metadata refreshed within 24 hours
- [ ] **Completeness**: 90%+ of tokens have complete metadata

## Success Metrics

- **Coverage**: 100+ tokens with complete metadata
- **Performance**: <5s enrichment time per token
- **Reliability**: 99%+ success rate for metadata fetching
- **Cache Hit Rate**: 80%+ cache hit rate for repeated requests
- **Data Quality**: 95%+ accuracy for enriched data

## Risk Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| API Rate Limits | High | Medium | Multiple sources, caching, rate limiting |
| Data Inconsistency | Medium | High | Validation, multiple sources, quality checks |
| Performance Issues | Medium | Medium | Caching, async processing, optimization |
| External Dependencies | High | Medium | Fallback sources, error handling |

## Dependencies

- **Epic 002**: Core Decoding (completed)
- **External**: CoinGecko API, CoinMarketCap API, IPFS gateways
- **Internal**: Token registry, contract registry

## Deliverables

1. **Token Metadata Service**: Complete token enrichment system
2. **NFT Metadata Service**: NFT metadata fetching and processing
3. **Pricing Service**: Multi-source pricing integration
4. **Protocol Labeling**: Contract identification and labeling
5. **Refresh Manager**: Automated metadata refresh system
6. **Tests**: Comprehensive test suite
7. **Documentation**: API docs, integration guide

## Next Steps

After completing this epic:
1. Integrate with Epic 004 (DeFi Analytics)
2. Prepare for Epic 006 (Multi-Chain Support)
3. Plan Epic 007 (Performance Optimization)
4. Consider advanced enrichment features

---

**Estimated Effort**: 2-3 weeks  
**Team Size**: 2-3 developers  
**Priority**: High (Essential for rich data experience)
