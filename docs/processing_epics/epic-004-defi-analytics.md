# EPIC-004: DeFi Analytics - DEX Swaps, Approvals & NFT Activity

## Overview

**Goal**: Build comprehensive DeFi analytics capabilities including DEX swap tracking, token approvals monitoring, NFT activity analysis, and liquidity position management.

**Duration**: 3-4 weeks  
**Complexity**: High  
**Phase**: Phase 2 (Enhancement)  

## Business Value

- **DeFi Insights**: Provide deep insights into DeFi activities and patterns
- **Risk Management**: Enable approval monitoring and risk assessment
- **Trading Analytics**: Support DEX trading analysis and optimization
- **NFT Intelligence**: Comprehensive NFT activity tracking and analysis
- **Competitive Advantage**: Advanced analytics that competitors lack

## Epic Scope

### In Scope
- DEX swap detection and analysis (Uniswap, SushiSwap, 1inch, etc.)
- Token approval monitoring and risk assessment
- NFT activity tracking (mints, transfers, sales)
- Liquidity position management
- DeFi protocol interaction analysis
- Advanced analytics and reporting

### Out of Scope
- Real-time alerting (handled in Epic 008)
- Multi-chain support (handled in Epic 006)
- Production deployment (handled in Epic 008)
- Custom analytics (handled in Epic 008)

## Technical Requirements

### DeFi Protocol Support
```typescript
// Supported DEX Protocols
- Uniswap V2/V3
- SushiSwap
- 1inch
- Curve Finance
- Balancer
- PancakeSwap (BSC)

// Supported Lending Protocols
- Aave V2/V3
- Compound
- MakerDAO
- Venus (BSC)

// Supported NFT Marketplaces
- OpenSea
- LooksRare
- X2Y2
- Blur
- Magic Eden (Solana)
```

### Analytics Capabilities
```typescript
// DEX Analytics
- Swap volume and frequency
- Price impact analysis
- Slippage tracking
- Arbitrage opportunities
- Liquidity analysis

// Approval Analytics
- Approval risk assessment
- Spending limit analysis
- Protocol interaction patterns
- Security risk scoring

// NFT Analytics
- Collection performance
- Floor price tracking
- Trading volume analysis
- Holder distribution
- Rarity analysis
```

## User Stories

### US-004-001: DEX Swap Detection
**As a** system  
**I want** to detect and analyze DEX swaps  
**So that** I can provide comprehensive trading analytics  

**Acceptance Criteria:**
- [ ] Detect swaps from major DEX protocols
- [ ] Extract swap details (tokens, amounts, prices)
- [ ] Calculate price impact and slippage
- [ ] Identify arbitrage opportunities
- [ ] Track swap volume and frequency

### US-004-002: Token Approval Monitoring
**As a** system  
**I want** to monitor token approvals  
**So that** I can assess security risks and spending patterns  

**Acceptance Criteria:**
- [ ] Track approval events across all tokens
- [ ] Calculate approval amounts and limits
- [ ] Identify high-risk approvals
- [ ] Monitor approval revocations
- [ ] Provide risk scoring

### US-004-003: NFT Activity Analysis
**As a** system  
**I want** to analyze NFT activities  
**So that** I can provide comprehensive NFT insights  

**Acceptance Criteria:**
- [ ] Track NFT mints, transfers, and sales
- [ ] Calculate collection metrics
- [ ] Analyze holder distribution
- [ ] Track floor prices and volume
- [ ] Identify trending collections

### US-004-004: Liquidity Position Management
**As a** system  
**I want** to track liquidity positions  
**So that** I can provide LP analytics and insights  

**Acceptance Criteria:**
- [ ] Track LP token holdings
- [ ] Calculate position values
- [ ] Monitor impermanent loss
- [ ] Track yield and fees earned
- [ ] Provide position optimization suggestions

### US-004-005: DeFi Protocol Analytics
**As a** system  
**I want** to analyze DeFi protocol interactions  
**So that** I can provide comprehensive protocol insights  

**Acceptance Criteria:**
- [ ] Track protocol usage patterns
- [ ] Calculate TVL and volume metrics
- [ ] Analyze user behavior
- [ ] Monitor protocol health
- [ ] Provide protocol comparison

## Implementation Plan

### Week 1: DEX Swap Detection
**Day 1-2: DEX Protocol Detection**
```typescript
// src/analytics/dex/swap-detector.ts
export class DEXSwapDetector {
  private protocols = new Map<string, DEXProtocol>([
    ['0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', {
      name: 'Uniswap V2',
      type: 'dex',
      version: 'v2',
      swapTopic: '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822'
    }],
    ['0xE592427A0AEce92De3Edee1F18E0157C05861564', {
      name: 'Uniswap V3',
      type: 'dex',
      version: 'v3',
      swapTopic: '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67'
    }],
    ['0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F', {
      name: 'SushiSwap',
      type: 'dex',
      version: 'v2',
      swapTopic: '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822'
    }]
  ]);
  
  async detectSwaps(events: DecodedEvent[]): Promise<DEXSwap[]> {
    const swaps: DEXSwap[] = [];
    
    for (const event of events) {
      const protocol = this.protocols.get(event.contract);
      
      if (protocol && event.eventName === 'Swap') {
        const swap = await this.parseSwapEvent(event, protocol);
        if (swap) {
          swaps.push(swap);
        }
      }
    }
    
    return swaps;
  }
  
  private async parseSwapEvent(event: DecodedEvent, protocol: DEXProtocol): Promise<DEXSwap | null> {
    try {
      if (protocol.name === 'Uniswap V2') {
        return this.parseUniswapV2Swap(event);
      } else if (protocol.name === 'Uniswap V3') {
        return this.parseUniswapV3Swap(event);
      } else if (protocol.name === 'SushiSwap') {
        return this.parseSushiSwap(event);
      }
      
      return null;
    } catch (error) {
      console.error(`Failed to parse swap event: ${error.message}`);
      return null;
    }
  }
  
  private parseUniswapV2Swap(event: DecodedEvent): DEXSwap {
    const args = event.args as any;
    
    return {
      protocol: 'Uniswap V2',
      contract: event.contract,
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber,
      logIndex: event.logIndex,
      sender: args.sender,
      to: args.to,
      amount0In: args.amount0In.toString(),
      amount1In: args.amount1In.toString(),
      amount0Out: args.amount0Out.toString(),
      amount1Out: args.amount1Out.toString(),
      timestamp: new Date()
    };
  }
  
  private parseUniswapV3Swap(event: DecodedEvent): DEXSwap {
    const args = event.args as any;
    
    return {
      protocol: 'Uniswap V3',
      contract: event.contract,
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber,
      logIndex: event.logIndex,
      sender: args.sender,
      recipient: args.recipient,
      amount0: args.amount0.toString(),
      amount1: args.amount1.toString(),
      sqrtPriceX96: args.sqrtPriceX96.toString(),
      liquidity: args.liquidity.toString(),
      tick: args.tick,
      timestamp: new Date()
    };
  }
}
```

**Day 3-4: Swap Analysis Engine**
```typescript
// src/analytics/dex/swap-analyzer.ts
export class SwapAnalyzer {
  private pricingService: PricingService;
  private db: PrismaClient;
  
  async analyzeSwap(swap: DEXSwap): Promise<SwapAnalysis> {
    const [priceImpact, slippage, arbitrage] = await Promise.all([
      this.calculatePriceImpact(swap),
      this.calculateSlippage(swap),
      this.detectArbitrage(swap)
    ]);
    
    return {
      swap,
      priceImpact,
      slippage,
      arbitrage,
      timestamp: new Date()
    };
  }
  
  private async calculatePriceImpact(swap: DEXSwap): Promise<PriceImpact> {
    // Get token prices before and after swap
    const [token0Price, token1Price] = await this.getTokenPrices(swap);
    
    // Calculate price impact based on swap amounts
    const priceImpact = this.computePriceImpact(swap, token0Price, token1Price);
    
    return {
      percentage: priceImpact,
      severity: this.getImpactSeverity(priceImpact)
    };
  }
  
  private async calculateSlippage(swap: DEXSwap): Promise<Slippage> {
    // Get expected vs actual amounts
    const expectedAmount = await this.getExpectedAmount(swap);
    const actualAmount = this.getActualAmount(swap);
    
    const slippagePercentage = ((actualAmount - expectedAmount) / expectedAmount) * 100;
    
    return {
      percentage: slippagePercentage,
      expectedAmount,
      actualAmount,
      severity: this.getSlippageSeverity(slippagePercentage)
    };
  }
  
  private async detectArbitrage(swap: DEXSwap): Promise<ArbitrageOpportunity | null> {
    // Check for arbitrage opportunities across DEXs
    const opportunities = await this.findArbitrageOpportunities(swap);
    
    if (opportunities.length > 0) {
      return {
        profitable: true,
        profitUsd: opportunities[0].profitUsd,
        path: opportunities[0].path,
        gasCost: opportunities[0].gasCost
      };
    }
    
    return null;
  }
}
```

**Day 5: Swap Analytics Dashboard**
```typescript
// src/analytics/dex/swap-analytics.ts
export class SwapAnalytics {
  private db: PrismaClient;
  
  async getSwapMetrics(timeframe: string): Promise<SwapMetrics> {
    const [volume, count, topTokens, topProtocols] = await Promise.all([
      this.getSwapVolume(timeframe),
      this.getSwapCount(timeframe),
      this.getTopTokens(timeframe),
      this.getTopProtocols(timeframe)
    ]);
    
    return {
      volume,
      count,
      topTokens,
      topProtocols,
      timeframe
    };
  }
  
  async getSwapVolume(timeframe: string): Promise<SwapVolume> {
    const query = this.buildTimeframeQuery(timeframe);
    
    const result = await this.db.$queryRaw`
      SELECT 
        SUM(amount_usd) as total_volume,
        AVG(amount_usd) as avg_volume,
        COUNT(*) as swap_count
      FROM dex_swaps
      WHERE timestamp >= ${query.startDate}
    `;
    
    return result[0];
  }
  
  async getTopTokens(timeframe: string): Promise<TokenVolume[]> {
    const query = this.buildTimeframeQuery(timeframe);
    
    const result = await this.db.$queryRaw`
      SELECT 
        token_in,
        SUM(amount_in_usd) as volume_in,
        SUM(amount_out_usd) as volume_out,
        COUNT(*) as swap_count
      FROM dex_swaps
      WHERE timestamp >= ${query.startDate}
      GROUP BY token_in
      ORDER BY volume_in DESC
      LIMIT 20
    `;
    
    return result;
  }
}
```

### Week 2: Approval Monitoring
**Day 1-2: Approval Detector**
```typescript
// src/analytics/approvals/approval-detector.ts
export class ApprovalDetector {
  private db: PrismaClient;
  
  async detectApprovals(events: DecodedEvent[]): Promise<TokenApproval[]> {
    const approvals: TokenApproval[] = [];
    
    for (const event of events) {
      if (event.eventName === 'Approval') {
        const approval = this.parseApprovalEvent(event);
        if (approval) {
          approvals.push(approval);
        }
      }
    }
    
    return approvals;
  }
  
  private parseApprovalEvent(event: DecodedEvent): TokenApproval | null {
    try {
      const args = event.args as any;
      
      return {
        contract: event.contract,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        logIndex: event.logIndex,
        owner: args.owner,
        spender: args.spender,
        amount: args.value.toString(),
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Failed to parse approval event: ${error.message}`);
      return null;
    }
  }
  
  async analyzeApprovalRisk(approval: TokenApproval): Promise<ApprovalRisk> {
    const [tokenInfo, spenderInfo, amountUsd] = await Promise.all([
      this.getTokenInfo(approval.contract),
      this.getSpenderInfo(approval.spender),
      this.calculateAmountUsd(approval.contract, approval.amount)
    ]);
    
    const riskScore = this.calculateRiskScore(approval, tokenInfo, spenderInfo, amountUsd);
    
    return {
      approval,
      riskScore,
      riskLevel: this.getRiskLevel(riskScore),
      tokenInfo,
      spenderInfo,
      amountUsd,
      recommendations: this.getRecommendations(riskScore, spenderInfo)
    };
  }
  
  private calculateRiskScore(
    approval: TokenApproval,
    tokenInfo: TokenInfo,
    spenderInfo: SpenderInfo,
    amountUsd: number
  ): number {
    let score = 0;
    
    // Amount risk (higher amounts = higher risk)
    if (amountUsd > 100000) score += 30;
    else if (amountUsd > 10000) score += 20;
    else if (amountUsd > 1000) score += 10;
    
    // Spender risk (unknown spenders = higher risk)
    if (!spenderInfo.isVerified) score += 25;
    if (spenderInfo.isNew) score += 15;
    
    // Token risk (new tokens = higher risk)
    if (tokenInfo.isNew) score += 20;
    if (!tokenInfo.isVerified) score += 15;
    
    // Approval amount risk (unlimited approvals = higher risk)
    if (approval.amount === '115792089237316195423570985008687907853269984665640564039457584007913129639935') {
      score += 40;
    }
    
    return Math.min(score, 100);
  }
}
```

**Day 3-4: Approval Analytics**
```typescript
// src/analytics/approvals/approval-analytics.ts
export class ApprovalAnalytics {
  private db: PrismaClient;
  
  async getApprovalMetrics(timeframe: string): Promise<ApprovalMetrics> {
    const [totalApprovals, highRiskApprovals, topSpenders, topTokens] = await Promise.all([
      this.getTotalApprovals(timeframe),
      this.getHighRiskApprovals(timeframe),
      this.getTopSpenders(timeframe),
      this.getTopApprovedTokens(timeframe)
    ]);
    
    return {
      totalApprovals,
      highRiskApprovals,
      topSpenders,
      topTokens,
      timeframe
    };
  }
  
  async getHighRiskApprovals(timeframe: string): Promise<HighRiskApproval[]> {
    const query = this.buildTimeframeQuery(timeframe);
    
    const result = await this.db.$queryRaw`
      SELECT 
        a.*,
        t.name as token_name,
        t.symbol as token_symbol,
        s.name as spender_name,
        s.is_verified as spender_verified
      FROM token_approvals a
      JOIN token_metadata t ON a.contract = t.address
      JOIN spender_registry s ON a.spender = s.address
      WHERE a.timestamp >= ${query.startDate}
        AND a.risk_score >= 70
      ORDER BY a.risk_score DESC, a.amount_usd DESC
      LIMIT 100
    `;
    
    return result;
  }
  
  async getApprovalTrends(timeframe: string): Promise<ApprovalTrend[]> {
    const query = this.buildTimeframeQuery(timeframe);
    
    const result = await this.db.$queryRaw`
      SELECT 
        DATE_TRUNC('day', timestamp) as date,
        COUNT(*) as approval_count,
        AVG(risk_score) as avg_risk_score,
        SUM(amount_usd) as total_amount_usd
      FROM token_approvals
      WHERE timestamp >= ${query.startDate}
      GROUP BY DATE_TRUNC('day', timestamp)
      ORDER BY date
    `;
    
    return result;
  }
}
```

**Day 5: Risk Assessment Engine**
```typescript
// src/analytics/approvals/risk-assessor.ts
export class RiskAssessor {
  private db: PrismaClient;
  
  async assessWalletRisk(walletAddress: string): Promise<WalletRiskAssessment> {
    const [approvals, spending, protocols] = await Promise.all([
      this.getWalletApprovals(walletAddress),
      this.getWalletSpending(walletAddress),
      this.getWalletProtocols(walletAddress)
    ]);
    
    const riskScore = this.calculateWalletRiskScore(approvals, spending, protocols);
    
    return {
      walletAddress,
      riskScore,
      riskLevel: this.getRiskLevel(riskScore),
      approvals,
      spending,
      protocols,
      recommendations: this.getWalletRecommendations(riskScore, approvals)
    };
  }
  
  private calculateWalletRiskScore(
    approvals: TokenApproval[],
    spending: SpendingPattern[],
    protocols: ProtocolUsage[]
  ): number {
    let score = 0;
    
    // Approval risk
    const highRiskApprovals = approvals.filter(a => a.riskScore >= 70);
    score += highRiskApprovals.length * 10;
    
    // Spending risk
    const highSpending = spending.filter(s => s.amountUsd > 10000);
    score += highSpending.length * 5;
    
    // Protocol risk
    const riskyProtocols = protocols.filter(p => p.riskLevel === 'high');
    score += riskyProtocols.length * 15;
    
    return Math.min(score, 100);
  }
}
```

### Week 3: NFT Activity Analysis
**Day 1-2: NFT Activity Detector**
```typescript
// src/analytics/nft/nft-activity-detector.ts
export class NFTActivityDetector {
  private db: PrismaClient;
  
  async detectNFTActivity(events: DecodedEvent[]): Promise<NFTActivity[]> {
    const activities: NFTActivity[] = [];
    
    for (const event of events) {
      if (event.eventName === 'Transfer') {
        const activity = await this.parseTransferEvent(event);
        if (activity) {
          activities.push(activity);
        }
      }
    }
    
    return activities;
  }
  
  private async parseTransferEvent(event: DecodedEvent): Promise<NFTActivity | null> {
    try {
      const args = event.args as any;
      
      // Check if this is an NFT contract
      const isNFT = await this.isNFTContract(event.contract);
      if (!isNFT) {
        return null;
      }
      
      const activityType = this.determineActivityType(args.from, args.to);
      
      return {
        contract: event.contract,
        tokenId: args.tokenId?.toString() || '0',
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        logIndex: event.logIndex,
        from: args.from,
        to: args.to,
        activityType,
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Failed to parse NFT transfer event: ${error.message}`);
      return null;
    }
  }
  
  private determineActivityType(from: string, to: string): NFTActivityType {
    if (from === '0x0000000000000000000000000000000000000000') {
      return 'mint';
    } else if (to === '0x0000000000000000000000000000000000000000') {
      return 'burn';
    } else {
      return 'transfer';
    }
  }
  
  private async isNFTContract(contractAddress: string): Promise<boolean> {
    // Check if contract implements ERC-721 or ERC-1155
    const contract = new ethers.Contract(contractAddress, [
      'function supportsInterface(bytes4) view returns (bool)'
    ], this.provider);
    
    try {
      const [erc721, erc1155] = await Promise.all([
        contract.supportsInterface('0x80ac58cd'), // ERC-721
        contract.supportsInterface('0xd9b67a26')  // ERC-1155
      ]);
      
      return erc721 || erc1155;
    } catch (error) {
      return false;
    }
  }
}
```

**Day 3-4: NFT Analytics Engine**
```typescript
// src/analytics/nft/nft-analytics.ts
export class NFTAnalytics {
  private db: PrismaClient;
  
  async getCollectionMetrics(contractAddress: string): Promise<CollectionMetrics> {
    const [volume, floorPrice, holders, activities] = await Promise.all([
      this.getCollectionVolume(contractAddress),
      this.getFloorPrice(contractAddress),
      this.getHolderCount(contractAddress),
      this.getRecentActivities(contractAddress)
    ]);
    
    return {
      contractAddress,
      volume,
      floorPrice,
      holders,
      activities,
      timestamp: new Date()
    };
  }
  
  async getCollectionVolume(contractAddress: string): Promise<CollectionVolume> {
    const result = await this.db.$queryRaw`
      SELECT 
        SUM(price_usd) as total_volume,
        AVG(price_usd) as avg_price,
        COUNT(*) as transaction_count,
        COUNT(DISTINCT buyer) as unique_buyers,
        COUNT(DISTINCT seller) as unique_sellers
      FROM nft_sales
      WHERE contract_address = ${contractAddress}
        AND timestamp >= NOW() - INTERVAL '30 days'
    `;
    
    return result[0];
  }
  
  async getFloorPrice(contractAddress: string): Promise<FloorPrice> {
    const result = await this.db.$queryRaw`
      SELECT 
        MIN(price_usd) as floor_price,
        AVG(price_usd) as avg_price,
        MAX(price_usd) as max_price
      FROM nft_sales
      WHERE contract_address = ${contractAddress}
        AND timestamp >= NOW() - INTERVAL '7 days'
    `;
    
    return result[0];
  }
  
  async getHolderDistribution(contractAddress: string): Promise<HolderDistribution[]> {
    const result = await this.db.$queryRaw`
      SELECT 
        holder,
        COUNT(*) as token_count,
        SUM(price_usd) as total_value_usd
      FROM nft_holdings
      WHERE contract_address = ${contractAddress}
      GROUP BY holder
      ORDER BY token_count DESC
      LIMIT 100
    `;
    
    return result;
  }
}
```

**Day 5: NFT Market Analysis**
```typescript
// src/analytics/nft/nft-market-analyzer.ts
export class NFTMarketAnalyzer {
  private db: PrismaClient;
  
  async analyzeMarketTrends(): Promise<MarketTrends> {
    const [topCollections, trendingCollections, marketMetrics] = await Promise.all([
      this.getTopCollections(),
      this.getTrendingCollections(),
      this.getMarketMetrics()
    ]);
    
    return {
      topCollections,
      trendingCollections,
      marketMetrics,
      timestamp: new Date()
    };
  }
  
  async getTopCollections(): Promise<TopCollection[]> {
    const result = await this.db.$queryRaw`
      SELECT 
        contract_address,
        SUM(volume_usd) as total_volume,
        COUNT(*) as transaction_count,
        AVG(price_usd) as avg_price,
        MIN(price_usd) as floor_price
      FROM nft_sales
      WHERE timestamp >= NOW() - INTERVAL '30 days'
      GROUP BY contract_address
      ORDER BY total_volume DESC
      LIMIT 20
    `;
    
    return result;
  }
  
  async getTrendingCollections(): Promise<TrendingCollection[]> {
    const result = await this.db.$queryRaw`
      SELECT 
        contract_address,
        SUM(CASE WHEN timestamp >= NOW() - INTERVAL '7 days' THEN volume_usd ELSE 0 END) as recent_volume,
        SUM(CASE WHEN timestamp >= NOW() - INTERVAL '14 days' AND timestamp < NOW() - INTERVAL '7 days' THEN volume_usd ELSE 0 END) as previous_volume,
        COUNT(CASE WHEN timestamp >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_transactions
      FROM nft_sales
      WHERE timestamp >= NOW() - INTERVAL '14 days'
      GROUP BY contract_address
      HAVING recent_volume > 0 AND previous_volume > 0
      ORDER BY (recent_volume - previous_volume) DESC
      LIMIT 20
    `;
    
    return result.map(collection => ({
      ...collection,
      growthRate: (collection.recent_volume - collection.previous_volume) / collection.previous_volume
    }));
  }
}
```

### Week 4: Integration & Testing
**Day 1-2: DeFi Analytics Service**
```typescript
// src/analytics/defi-analytics-service.ts
export class DeFiAnalyticsService {
  private swapDetector: DEXSwapDetector;
  private approvalDetector: ApprovalDetector;
  private nftDetector: NFTActivityDetector;
  private db: PrismaClient;
  
  async processBlock(blockNumber: number, events: DecodedEvent[]): Promise<DeFiAnalytics> {
    const [swaps, approvals, nftActivities] = await Promise.all([
      this.swapDetector.detectSwaps(events),
      this.approvalDetector.detectApprovals(events),
      this.nftDetector.detectNFTActivity(events)
    ]);
    
    // Store analytics data
    await this.storeAnalyticsData(blockNumber, swaps, approvals, nftActivities);
    
    return {
      blockNumber,
      swaps,
      approvals,
      nftActivities,
      timestamp: new Date()
    };
  }
  
  async getWalletAnalytics(walletAddress: string): Promise<WalletAnalytics> {
    const [swaps, approvals, nftActivities, positions] = await Promise.all([
      this.getWalletSwaps(walletAddress),
      this.getWalletApprovals(walletAddress),
      this.getWalletNFTActivities(walletAddress),
      this.getWalletPositions(walletAddress)
    ]);
    
    return {
      walletAddress,
      swaps,
      approvals,
      nftActivities,
      positions,
      timestamp: new Date()
    };
  }
  
  async getProtocolAnalytics(protocol: string): Promise<ProtocolAnalytics> {
    const [volume, users, transactions] = await Promise.all([
      this.getProtocolVolume(protocol),
      this.getProtocolUsers(protocol),
      this.getProtocolTransactions(protocol)
    ]);
    
    return {
      protocol,
      volume,
      users,
      transactions,
      timestamp: new Date()
    };
  }
}
```

**Day 3-4: Comprehensive Testing**
```typescript
// tests/analytics/dex/swap-detector.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('DEXSwapDetector', () => {
  let detector: DEXSwapDetector;
  
  beforeEach(() => {
    detector = new DEXSwapDetector();
  });
  
  it('should detect Uniswap V2 swaps', async () => {
    const mockEvent = createMockUniswapV2SwapEvent();
    const swaps = await detector.detectSwaps([mockEvent]);
    
    expect(swaps).toHaveLength(1);
    expect(swaps[0].protocol).toBe('Uniswap V2');
    expect(swaps[0].amount0In).toBeDefined();
    expect(swaps[0].amount1Out).toBeDefined();
  });
  
  it('should detect Uniswap V3 swaps', async () => {
    const mockEvent = createMockUniswapV3SwapEvent();
    const swaps = await detector.detectSwaps([mockEvent]);
    
    expect(swaps).toHaveLength(1);
    expect(swaps[0].protocol).toBe('Uniswap V3');
    expect(swaps[0].amount0).toBeDefined();
    expect(swaps[0].amount1).toBeDefined();
  });
  
  it('should handle unknown protocols gracefully', async () => {
    const mockEvent = createMockUnknownProtocolEvent();
    const swaps = await detector.detectSwaps([mockEvent]);
    
    expect(swaps).toHaveLength(0);
  });
});
```

**Day 5: Documentation & API**
```typescript
// src/api/analytics-api.ts
export class AnalyticsAPI {
  private analyticsService: DeFiAnalyticsService;
  
  constructor(analyticsService: DeFiAnalyticsService) {
    this.analyticsService = analyticsService;
  }
  
  // DEX Analytics Endpoints
  async getSwapMetrics(req: Request, res: Response): Promise<void> {
    const { timeframe = '7d' } = req.query;
    const metrics = await this.analyticsService.getSwapMetrics(timeframe);
    res.json(metrics);
  }
  
  async getSwapAnalytics(req: Request, res: Response): Promise<void> {
    const { walletAddress } = req.params;
    const analytics = await this.analyticsService.getWalletAnalytics(walletAddress);
    res.json(analytics);
  }
  
  // Approval Analytics Endpoints
  async getApprovalMetrics(req: Request, res: Response): Promise<void> {
    const { timeframe = '7d' } = req.query;
    const metrics = await this.analyticsService.getApprovalMetrics(timeframe);
    res.json(metrics);
  }
  
  async getApprovalRisk(req: Request, res: Response): Promise<void> {
    const { walletAddress } = req.params;
    const risk = await this.analyticsService.getWalletRiskAssessment(walletAddress);
    res.json(risk);
  }
  
  // NFT Analytics Endpoints
  async getNFTMetrics(req: Request, res: Response): Promise<void> {
    const { contractAddress } = req.params;
    const metrics = await this.analyticsService.getCollectionMetrics(contractAddress);
    res.json(metrics);
  }
  
  async getMarketTrends(req: Request, res: Response): Promise<void> {
    const trends = await this.analyticsService.getMarketTrends();
    res.json(trends);
  }
}
```

## Acceptance Criteria

### Functional Requirements
- [ ] **DEX Swap Detection**: Detect swaps from major DEX protocols
- [ ] **Approval Monitoring**: Track and analyze token approvals
- [ ] **NFT Activity**: Comprehensive NFT activity tracking
- [ ] **Liquidity Positions**: LP position management and analytics
- [ ] **Protocol Analytics**: DeFi protocol interaction analysis

### Non-Functional Requirements
- [ ] **Performance**: Process 10k+ events per second
- [ ] **Accuracy**: 99%+ accuracy for event detection
- [ ] **Coverage**: Support for 20+ DeFi protocols
- [ ] **Real-time**: <5s latency for analytics updates
- [ ] **Scalability**: Handle 100M+ events per day

### Quality Requirements
- [ ] **Data Quality**: Comprehensive validation and quality checks
- [ ] **Error Handling**: Robust error handling and recovery
- [ ] **Testing**: 90%+ test coverage
- [ ] **Documentation**: Complete API and analytics documentation

## Success Metrics

- **Coverage**: Support for 20+ DeFi protocols
- **Performance**: 10k+ events/second processing capacity
- **Accuracy**: 99%+ event detection accuracy
- **Analytics**: 50+ analytics metrics and KPIs
- **API Response**: <2s response time for analytics queries

## Risk Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Protocol Changes | High | Medium | Version detection, fallback handling |
| Complex Event Parsing | High | High | Comprehensive testing, error handling |
| Performance Issues | Medium | Medium | Optimization, caching, monitoring |
| Data Quality Issues | Medium | High | Validation, quality checks, monitoring |

## Dependencies

- **Epic 002**: Core Decoding (completed)
- **Epic 003**: Data Enrichment (completed)
- **External**: DeFi protocol ABIs, market data APIs
- **Internal**: Event processing pipeline, pricing service

## Deliverables

1. **DEX Swap Detector**: Comprehensive DEX swap detection and analysis
2. **Approval Monitor**: Token approval tracking and risk assessment
3. **NFT Activity Tracker**: NFT activity detection and analytics
4. **Liquidity Position Manager**: LP position tracking and analytics
5. **DeFi Analytics Service**: Unified analytics service
6. **Analytics API**: REST API for analytics data
7. **Tests**: Comprehensive test suite
8. **Documentation**: API docs, analytics guide

## Next Steps

After completing this epic:
1. Integrate with Epic 005 (Reorg Management)
2. Prepare for Epic 006 (Multi-Chain Support)
3. Plan Epic 007 (Performance Optimization)
4. Consider advanced analytics features

---

**Estimated Effort**: 3-4 weeks  
**Team Size**: 3-4 developers  
**Priority**: High (Core DeFi analytics capabilities)
