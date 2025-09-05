# EPIC-005: Reorg Management - Chain Reorganization Handling

## Overview

**Goal**: Implement robust chain reorganization (reorg) handling to ensure data integrity and consistency when blockchain networks reorganize their transaction history.

**Duration**: 2-3 weeks  
**Complexity**: High  
**Phase**: Phase 1 (Foundation)  

## Business Value

- **Data Integrity**: Ensure data consistency during chain reorganizations
- **Reliability**: Maintain high reliability even during network instability
- **Trust**: Provide trustworthy data for critical applications
- **Compliance**: Meet regulatory requirements for data accuracy
- **Competitive Advantage**: Offer superior data reliability compared to competitors

## Epic Scope

### In Scope
- Reorg detection and monitoring
- Canonical flag management
- Data rollback and recovery
- Reorg event logging and alerting
- Performance optimization for reorg handling
- Comprehensive testing and validation

### Out of Scope
- Multi-chain reorg handling (handled in Epic 006)
- Real-time reorg notifications (handled in Epic 008)
- Advanced reorg analytics (handled in Epic 008)
- Custom reorg policies (handled in Epic 008)

## Technical Requirements

### Reorg Detection
```typescript
// Reorg Detection Methods
- Block hash comparison
- Block height monitoring
- Chain head tracking
- Fork detection algorithms
- Reorg depth calculation
```

### Data Management
```typescript
// Canonical Data Management
- Canonical flag system
- Data versioning
- Rollback procedures
- Recovery mechanisms
- Consistency checks
```

### Performance Requirements
```typescript
// Performance Targets
- Reorg detection: <30 seconds
- Data rollback: <60 seconds
- Recovery time: <5 minutes
- Data consistency: 100%
- System availability: 99.9%
```

## User Stories

### US-005-001: Reorg Detection
**As a** system  
**I want** to detect chain reorganizations quickly and accurately  
**So that** I can maintain data integrity  

**Acceptance Criteria:**
- [ ] Detect reorgs within 30 seconds of occurrence
- [ ] Calculate reorg depth accurately
- [ ] Identify affected blocks and transactions
- [ ] Log reorg events with full context
- [ ] Handle multiple concurrent reorgs

### US-005-002: Canonical Flag Management
**As a** system  
**I want** to manage canonical flags for all data  
**So that** I can maintain data consistency during reorgs  

**Acceptance Criteria:**
- [ ] Mark all data with canonical flags
- [ ] Update canonical flags during reorgs
- [ ] Maintain canonical data history
- [ ] Provide canonical data queries
- [ ] Handle canonical flag conflicts

### US-005-003: Data Rollback
**As a** system  
**I want** to rollback data affected by reorgs  
**So that** I can maintain data integrity  

**Acceptance Criteria:**
- [ ] Rollback affected blocks and transactions
- [ ] Rollback related events and logs
- [ ] Rollback dependent data (swaps, approvals, etc.)
- [ ] Maintain rollback audit trail
- [ ] Handle rollback failures gracefully

### US-005-004: Data Recovery
**As a** system  
**I want** to recover from reorgs quickly  
**So that** I can maintain system availability  

**Acceptance Criteria:**
- [ ] Recover from reorgs within 5 minutes
- [ ] Restore data consistency
- [ ] Resume normal processing
- [ ] Validate recovered data
- [ ] Handle recovery failures

### US-005-005: Reorg Monitoring
**As a** system  
**I want** to monitor reorg events and performance  
**So that** I can maintain system health  

**Acceptance Criteria:**
- [ ] Track reorg frequency and depth
- [ ] Monitor reorg handling performance
- [ ] Alert on reorg anomalies
- [ ] Provide reorg analytics
- [ ] Generate reorg reports

## Implementation Plan

### Week 1: Reorg Detection Foundation
**Day 1-2: Reorg Detector**
```typescript
// src/reorg/reorg-detector.ts
export class ReorgDetector {
  private provider: ethers.Provider;
  private db: PrismaClient;
  private logger: Logger;
  private lastKnownHead: BlockInfo | null = null;
  
  constructor(provider: ethers.Provider, db: PrismaClient, logger: Logger) {
    this.provider = provider;
    this.db = db;
    this.logger = logger;
  }
  
  async detectReorgs(): Promise<ReorgEvent[]> {
    const currentHead = await this.getCurrentHead();
    const reorgs: ReorgEvent[] = [];
    
    if (this.lastKnownHead) {
      const reorg = await this.checkForReorg(this.lastKnownHead, currentHead);
      if (reorg) {
        reorgs.push(reorg);
      }
    }
    
    this.lastKnownHead = currentHead;
    return reorgs;
  }
  
  private async checkForReorg(
    lastHead: BlockInfo,
    currentHead: BlockInfo
  ): Promise<ReorgEvent | null> {
    // Check if current head is different from last known head
    if (currentHead.hash === lastHead.hash) {
      return null; // No reorg
    }
    
    // Check if current head is a descendant of last known head
    if (await this.isDescendant(currentHead, lastHead)) {
      return null; // No reorg, just new blocks
    }
    
    // Find common ancestor
    const commonAncestor = await this.findCommonAncestor(currentHead, lastHead);
    if (!commonAncestor) {
      throw new Error('No common ancestor found');
    }
    
    // Calculate reorg depth
    const reorgDepth = lastHead.number - commonAncestor.number;
    
    return {
      type: 'reorg',
      depth: reorgDepth,
      oldHead: lastHead,
      newHead: currentHead,
      commonAncestor,
      affectedBlocks: await this.getAffectedBlocks(commonAncestor, lastHead),
      timestamp: new Date()
    };
  }
  
  private async isDescendant(block: BlockInfo, ancestor: BlockInfo): Promise<boolean> {
    let current = block;
    
    while (current.number > ancestor.number) {
      if (current.parentHash === ancestor.hash) {
        return true;
      }
      
      current = await this.getBlock(current.parentHash);
      if (!current) {
        return false;
      }
    }
    
    return false;
  }
  
  private async findCommonAncestor(
    block1: BlockInfo,
    block2: BlockInfo
  ): Promise<BlockInfo | null> {
    let b1 = block1;
    let b2 = block2;
    
    // Move to same height
    while (b1.number > b2.number) {
      b1 = await this.getBlock(b1.parentHash);
      if (!b1) return null;
    }
    
    while (b2.number > b1.number) {
      b2 = await this.getBlock(b2.parentHash);
      if (!b2) return null;
    }
    
    // Find common ancestor
    while (b1.hash !== b2.hash && b1.number > 0) {
      b1 = await this.getBlock(b1.parentHash);
      b2 = await this.getBlock(b2.parentHash);
      
      if (!b1 || !b2) return null;
    }
    
    return b1.hash === b2.hash ? b1 : null;
  }
  
  private async getAffectedBlocks(
    commonAncestor: BlockInfo,
    oldHead: BlockInfo
  ): Promise<BlockInfo[]> {
    const affected: BlockInfo[] = [];
    let current = oldHead;
    
    while (current.number > commonAncestor.number) {
      affected.push(current);
      current = await this.getBlock(current.parentHash);
      if (!current) break;
    }
    
    return affected;
  }
}
```

**Day 3-4: Canonical Flag Manager**
```typescript
// src/reorg/canonical-flag-manager.ts
export class CanonicalFlagManager {
  private db: PrismaClient;
  private logger: Logger;
  
  async markDataAsCanonical(
    dataType: DataType,
    blockNumber: number,
    blockHash: string
  ): Promise<void> {
    const table = this.getTableName(dataType);
    
    await this.db.$executeRaw`
      UPDATE ${table}
      SET canonical = true,
          canonical_block_hash = ${blockHash},
          canonical_updated_at = NOW()
      WHERE block_number = ${blockNumber}
        AND canonical_block_hash = ${blockHash}
    `;
  }
  
  async markDataAsNonCanonical(
    dataType: DataType,
    blockNumber: number,
    blockHash: string
  ): Promise<void> {
    const table = this.getTableName(dataType);
    
    await this.db.$executeRaw`
      UPDATE ${table}
      SET canonical = false,
          canonical_updated_at = NOW()
      WHERE block_number = ${blockNumber}
        AND canonical_block_hash = ${blockHash}
    `;
  }
  
  async rollbackCanonicalFlags(
    dataType: DataType,
    fromBlock: number,
    toBlock: number
  ): Promise<void> {
    const table = this.getTableName(dataType);
    
    await this.db.$executeRaw`
      UPDATE ${table}
      SET canonical = false,
          canonical_updated_at = NOW()
      WHERE block_number >= ${fromBlock}
        AND block_number <= ${toBlock}
    `;
  }
  
  async getCanonicalData(
    dataType: DataType,
    blockNumber: number
  ): Promise<any[]> {
    const table = this.getTableName(dataType);
    
    return await this.db.$queryRaw`
      SELECT *
      FROM ${table}
      WHERE block_number = ${blockNumber}
        AND canonical = true
    `;
  }
  
  private getTableName(dataType: DataType): string {
    const tableMap = {
      'block': 'blocks',
      'transaction': 'transactions',
      'event': 'events',
      'transfer': 'transfers',
      'approval': 'approvals',
      'swap': 'dex_swaps',
      'nft_activity': 'nft_activities'
    };
    
    return tableMap[dataType];
  }
}
```

**Day 5: Reorg Event Logger**
```typescript
// src/reorg/reorg-event-logger.ts
export class ReorgEventLogger {
  private db: PrismaClient;
  private logger: Logger;
  
  async logReorgEvent(reorg: ReorgEvent): Promise<void> {
    // Log to database
    await this.db.reorgEvent.create({
      data: {
        type: reorg.type,
        depth: reorg.depth,
        old_head_hash: reorg.oldHead.hash,
        old_head_number: reorg.oldHead.number,
        new_head_hash: reorg.newHead.hash,
        new_head_number: reorg.newHead.number,
        common_ancestor_hash: reorg.commonAncestor.hash,
        common_ancestor_number: reorg.commonAncestor.number,
        affected_blocks_count: reorg.affectedBlocks.length,
        affected_blocks: reorg.affectedBlocks.map(b => ({
          hash: b.hash,
          number: b.number
        })),
        timestamp: reorg.timestamp
      }
    });
    
    // Log to application logger
    this.logger.warn('Chain reorganization detected', {
      depth: reorg.depth,
      oldHead: reorg.oldHead,
      newHead: reorg.newHead,
      affectedBlocks: reorg.affectedBlocks.length
    });
  }
  
  async getReorgHistory(limit: number = 100): Promise<ReorgEvent[]> {
    const events = await this.db.reorgEvent.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit
    });
    
    return events.map(event => ({
      type: event.type,
      depth: event.depth,
      oldHead: {
        hash: event.old_head_hash,
        number: event.old_head_number
      },
      newHead: {
        hash: event.new_head_hash,
        number: event.new_head_number
      },
      commonAncestor: {
        hash: event.common_ancestor_hash,
        number: event.common_ancestor_number
      },
      affectedBlocks: event.affected_blocks,
      timestamp: event.timestamp
    }));
  }
}
```

### Week 2: Data Rollback & Recovery
**Day 1-2: Data Rollback Engine**
```typescript
// src/reorg/data-rollback-engine.ts
export class DataRollbackEngine {
  private db: PrismaClient;
  private canonicalManager: CanonicalFlagManager;
  private logger: Logger;
  
  async rollbackReorg(reorg: ReorgEvent): Promise<RollbackResult> {
    const startTime = Date.now();
    
    try {
      // Rollback affected blocks
      await this.rollbackBlocks(reorg.affectedBlocks);
      
      // Rollback transactions
      await this.rollbackTransactions(reorg.affectedBlocks);
      
      // Rollback events
      await this.rollbackEvents(reorg.affectedBlocks);
      
      // Rollback transfers
      await this.rollbackTransfers(reorg.affectedBlocks);
      
      // Rollback approvals
      await this.rollbackApprovals(reorg.affectedBlocks);
      
      // Rollback swaps
      await this.rollbackSwaps(reorg.affectedBlocks);
      
      // Rollback NFT activities
      await this.rollbackNFTActivities(reorg.affectedBlocks);
      
      const rollbackTime = Date.now() - startTime;
      
      this.logger.info('Reorg rollback completed', {
        reorgDepth: reorg.depth,
        affectedBlocks: reorg.affectedBlocks.length,
        rollbackTime
      });
      
      return {
        success: true,
        reorgDepth: reorg.depth,
        affectedBlocks: reorg.affectedBlocks.length,
        rollbackTime,
        timestamp: new Date()
      };
    } catch (error) {
      const rollbackTime = Date.now() - startTime;
      
      this.logger.error('Reorg rollback failed', {
        error: error.message,
        reorgDepth: reorg.depth,
        rollbackTime
      });
      
      return {
        success: false,
        error: error.message,
        reorgDepth: reorg.depth,
        rollbackTime,
        timestamp: new Date()
      };
    }
  }
  
  private async rollbackBlocks(affectedBlocks: BlockInfo[]): Promise<void> {
    for (const block of affectedBlocks) {
      await this.canonicalManager.markDataAsNonCanonical(
        'block',
        block.number,
        block.hash
      );
    }
  }
  
  private async rollbackTransactions(affectedBlocks: BlockInfo[]): Promise<void> {
    for (const block of affectedBlocks) {
      await this.canonicalManager.markDataAsNonCanonical(
        'transaction',
        block.number,
        block.hash
      );
    }
  }
  
  private async rollbackEvents(affectedBlocks: BlockInfo[]): Promise<void> {
    for (const block of affectedBlocks) {
      await this.canonicalManager.markDataAsNonCanonical(
        'event',
        block.number,
        block.hash
      );
    }
  }
  
  private async rollbackTransfers(affectedBlocks: BlockInfo[]): Promise<void> {
    for (const block of affectedBlocks) {
      await this.canonicalManager.markDataAsNonCanonical(
        'transfer',
        block.number,
        block.hash
      );
    }
  }
  
  private async rollbackApprovals(affectedBlocks: BlockInfo[]): Promise<void> {
    for (const block of affectedBlocks) {
      await this.canonicalManager.markDataAsNonCanonical(
        'approval',
        block.number,
        block.hash
      );
    }
  }
  
  private async rollbackSwaps(affectedBlocks: BlockInfo[]): Promise<void> {
    for (const block of affectedBlocks) {
      await this.canonicalManager.markDataAsNonCanonical(
        'swap',
        block.number,
        block.hash
      );
    }
  }
  
  private async rollbackNFTActivities(affectedBlocks: BlockInfo[]): Promise<void> {
    for (const block of affectedBlocks) {
      await this.canonicalManager.markDataAsNonCanonical(
        'nft_activity',
        block.number,
        block.hash
      );
    }
  }
}
```

**Day 3-4: Data Recovery Engine**
```typescript
// src/reorg/data-recovery-engine.ts
export class DataRecoveryEngine {
  private db: PrismaClient;
  private processingPipeline: ProcessingPipeline;
  private logger: Logger;
  
  async recoverFromReorg(reorg: ReorgEvent): Promise<RecoveryResult> {
    const startTime = Date.now();
    
    try {
      // Recover blocks
      await this.recoverBlocks(reorg.newHead, reorg.commonAncestor);
      
      // Recover transactions
      await this.recoverTransactions(reorg.newHead, reorg.commonAncestor);
      
      // Recover events
      await this.recoverEvents(reorg.newHead, reorg.commonAncestor);
      
      // Recover dependent data
      await this.recoverDependentData(reorg.newHead, reorg.commonAncestor);
      
      const recoveryTime = Date.now() - startTime;
      
      this.logger.info('Reorg recovery completed', {
        reorgDepth: reorg.depth,
        recoveryTime
      });
      
      return {
        success: true,
        reorgDepth: reorg.depth,
        recoveryTime,
        timestamp: new Date()
      };
    } catch (error) {
      const recoveryTime = Date.now() - startTime;
      
      this.logger.error('Reorg recovery failed', {
        error: error.message,
        reorgDepth: reorg.depth,
        recoveryTime
      });
      
      return {
        success: false,
        error: error.message,
        reorgDepth: reorg.depth,
        recoveryTime,
        timestamp: new Date()
      };
    }
  }
  
  private async recoverBlocks(
    newHead: BlockInfo,
    commonAncestor: BlockInfo
  ): Promise<void> {
    let current = newHead;
    
    while (current.number > commonAncestor.number) {
      // Check if block already exists
      const existing = await this.db.block.findUnique({
        where: { number: current.number }
      });
      
      if (!existing) {
        // Fetch and store block
        await this.processingPipeline.processBlock(current.number);
      } else {
        // Update canonical flag
        await this.canonicalManager.markDataAsCanonical(
          'block',
          current.number,
          current.hash
        );
      }
      
      current = await this.getBlock(current.parentHash);
      if (!current) break;
    }
  }
  
  private async recoverTransactions(
    newHead: BlockInfo,
    commonAncestor: BlockInfo
  ): Promise<void> {
    let current = newHead;
    
    while (current.number > commonAncestor.number) {
      // Check if transactions already exist
      const existing = await this.db.transaction.findFirst({
        where: { blockNumber: current.number }
      });
      
      if (!existing) {
        // Fetch and store transactions
        await this.processingPipeline.processBlockTransactions(current.number);
      } else {
        // Update canonical flags
        await this.canonicalManager.markDataAsCanonical(
          'transaction',
          current.number,
          current.hash
        );
      }
      
      current = await this.getBlock(current.parentHash);
      if (!current) break;
    }
  }
  
  private async recoverEvents(
    newHead: BlockInfo,
    commonAncestor: BlockInfo
  ): Promise<void> {
    let current = newHead;
    
    while (current.number > commonAncestor.number) {
      // Check if events already exist
      const existing = await this.db.event.findFirst({
        where: { blockNumber: current.number }
      });
      
      if (!existing) {
        // Fetch and store events
        await this.processingPipeline.processBlockEvents(current.number);
      } else {
        // Update canonical flags
        await this.canonicalManager.markDataAsCanonical(
          'event',
          current.number,
          current.hash
        );
      }
      
      current = await this.getBlock(current.parentHash);
      if (!current) break;
    }
  }
  
  private async recoverDependentData(
    newHead: BlockInfo,
    commonAncestor: BlockInfo
  ): Promise<void> {
    let current = newHead;
    
    while (current.number > commonAncestor.number) {
      // Recover transfers
      await this.recoverTransfers(current.number);
      
      // Recover approvals
      await this.recoverApprovals(current.number);
      
      // Recover swaps
      await this.recoverSwaps(current.number);
      
      // Recover NFT activities
      await this.recoverNFTActivities(current.number);
      
      current = await this.getBlock(current.parentHash);
      if (!current) break;
    }
  }
}
```

**Day 5: Reorg Manager Service**
```typescript
// src/reorg/reorg-manager.ts
export class ReorgManager {
  private detector: ReorgDetector;
  private rollbackEngine: DataRollbackEngine;
  private recoveryEngine: DataRecoveryEngine;
  private eventLogger: ReorgEventLogger;
  private logger: Logger;
  
  constructor(
    detector: ReorgDetector,
    rollbackEngine: DataRollbackEngine,
    recoveryEngine: DataRecoveryEngine,
    eventLogger: ReorgEventLogger,
    logger: Logger
  ) {
    this.detector = detector;
    this.rollbackEngine = rollbackEngine;
    this.recoveryEngine = recoveryEngine;
    this.eventLogger = eventLogger;
    this.logger = logger;
  }
  
  async handleReorgs(): Promise<void> {
    try {
      const reorgs = await this.detector.detectReorgs();
      
      for (const reorg of reorgs) {
        await this.handleReorg(reorg);
      }
    } catch (error) {
      this.logger.error('Failed to handle reorgs', { error: error.message });
    }
  }
  
  private async handleReorg(reorg: ReorgEvent): Promise<void> {
    this.logger.info('Handling reorg', {
      depth: reorg.depth,
      affectedBlocks: reorg.affectedBlocks.length
    });
    
    // Log reorg event
    await this.eventLogger.logReorgEvent(reorg);
    
    // Rollback affected data
    const rollbackResult = await this.rollbackEngine.rollbackReorg(reorg);
    
    if (!rollbackResult.success) {
      this.logger.error('Rollback failed', { error: rollbackResult.error });
      return;
    }
    
    // Recover data
    const recoveryResult = await this.recoveryEngine.recoverFromReorg(reorg);
    
    if (!recoveryResult.success) {
      this.logger.error('Recovery failed', { error: recoveryResult.error });
      return;
    }
    
    this.logger.info('Reorg handled successfully', {
      depth: reorg.depth,
      rollbackTime: rollbackResult.rollbackTime,
      recoveryTime: recoveryResult.recoveryTime
    });
  }
}
```

### Week 3: Monitoring & Testing
**Day 1-2: Reorg Monitoring**
```typescript
// src/reorg/reorg-monitor.ts
export class ReorgMonitor {
  private db: PrismaClient;
  private logger: Logger;
  
  async getReorgMetrics(timeframe: string): Promise<ReorgMetrics> {
    const query = this.buildTimeframeQuery(timeframe);
    
    const [totalReorgs, avgDepth, maxDepth, avgHandlingTime] = await Promise.all([
      this.getTotalReorgs(query),
      this.getAverageDepth(query),
      this.getMaxDepth(query),
      this.getAverageHandlingTime(query)
    ]);
    
    return {
      totalReorgs,
      averageDepth: avgDepth,
      maxDepth,
      averageHandlingTime: avgHandlingTime,
      timeframe
    };
  }
  
  async getReorgTrends(timeframe: string): Promise<ReorgTrend[]> {
    const query = this.buildTimeframeQuery(timeframe);
    
    const result = await this.db.$queryRaw`
      SELECT 
        DATE_TRUNC('hour', timestamp) as hour,
        COUNT(*) as reorg_count,
        AVG(depth) as avg_depth,
        MAX(depth) as max_depth
      FROM reorg_events
      WHERE timestamp >= ${query.startDate}
      GROUP BY DATE_TRUNC('hour', timestamp)
      ORDER BY hour
    `;
    
    return result;
  }
  
  async getReorgAlerts(): Promise<ReorgAlert[]> {
    const alerts: ReorgAlert[] = [];
    
    // Check for high frequency reorgs
    const highFrequency = await this.checkHighFrequencyReorgs();
    if (highFrequency) {
      alerts.push(highFrequency);
    }
    
    // Check for deep reorgs
    const deepReorgs = await this.checkDeepReorgs();
    if (deepReorgs) {
      alerts.push(deepReorgs);
    }
    
    // Check for handling failures
    const handlingFailures = await this.checkHandlingFailures();
    if (handlingFailures) {
      alerts.push(handlingFailures);
    }
    
    return alerts;
  }
  
  private async checkHighFrequencyReorgs(): Promise<ReorgAlert | null> {
    const recentReorgs = await this.db.reorgEvent.count({
      where: {
        timestamp: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        }
      }
    });
    
    if (recentReorgs > 10) {
      return {
        type: 'high_frequency',
        severity: 'warning',
        message: `High frequency of reorgs detected: ${recentReorgs} in the last hour`,
        timestamp: new Date()
      };
    }
    
    return null;
  }
  
  private async checkDeepReorgs(): Promise<ReorgAlert | null> {
    const deepReorg = await this.db.reorgEvent.findFirst({
      where: {
        depth: { gte: 10 },
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      orderBy: { depth: 'desc' }
    });
    
    if (deepReorg) {
      return {
        type: 'deep_reorg',
        severity: 'critical',
        message: `Deep reorg detected: depth ${deepReorg.depth}`,
        timestamp: new Date()
      };
    }
    
    return null;
  }
}
```

**Day 3-4: Comprehensive Testing**
```typescript
// tests/reorg/reorg-detector.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('ReorgDetector', () => {
  let detector: ReorgDetector;
  let mockProvider: ethers.Provider;
  let mockDb: PrismaClient;
  
  beforeEach(() => {
    mockProvider = createMockProvider();
    mockDb = createMockDb();
    detector = new ReorgDetector(mockProvider, mockDb, mockLogger);
  });
  
  it('should detect reorg when block hash changes', async () => {
    const mockReorg = createMockReorg();
    jest.spyOn(detector, 'getCurrentHead').mockResolvedValue(mockReorg.newHead);
    jest.spyOn(detector, 'getBlock').mockResolvedValue(mockReorg.oldHead);
    
    const reorgs = await detector.detectReorgs();
    
    expect(reorgs).toHaveLength(1);
    expect(reorgs[0].depth).toBe(mockReorg.depth);
    expect(reorgs[0].oldHead.hash).toBe(mockReorg.oldHead.hash);
    expect(reorgs[0].newHead.hash).toBe(mockReorg.newHead.hash);
  });
  
  it('should not detect reorg when no change', async () => {
    const mockHead = createMockBlock();
    jest.spyOn(detector, 'getCurrentHead').mockResolvedValue(mockHead);
    
    const reorgs = await detector.detectReorgs();
    
    expect(reorgs).toHaveLength(0);
  });
  
  it('should handle multiple concurrent reorgs', async () => {
    const mockReorgs = createMockMultipleReorgs();
    jest.spyOn(detector, 'getCurrentHead').mockResolvedValue(mockReorgs[0].newHead);
    
    const reorgs = await detector.detectReorgs();
    
    expect(reorgs).toHaveLength(mockReorgs.length);
  });
});

// tests/reorg/data-rollback-engine.test.ts
describe('DataRollbackEngine', () => {
  let rollbackEngine: DataRollbackEngine;
  let mockDb: PrismaClient;
  let mockCanonicalManager: CanonicalFlagManager;
  
  beforeEach(() => {
    mockDb = createMockDb();
    mockCanonicalManager = createMockCanonicalManager();
    rollbackEngine = new DataRollbackEngine(mockDb, mockCanonicalManager, mockLogger);
  });
  
  it('should rollback affected blocks', async () => {
    const mockReorg = createMockReorg();
    
    const result = await rollbackEngine.rollbackReorg(mockReorg);
    
    expect(result.success).toBe(true);
    expect(result.affectedBlocks).toBe(mockReorg.affectedBlocks.length);
    expect(mockCanonicalManager.markDataAsNonCanonical).toHaveBeenCalled();
  });
  
  it('should handle rollback failures gracefully', async () => {
    const mockReorg = createMockReorg();
    jest.spyOn(mockCanonicalManager, 'markDataAsNonCanonical').mockRejectedValue(new Error('Database error'));
    
    const result = await rollbackEngine.rollbackReorg(mockReorg);
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('Database error');
  });
});
```

**Day 5: Integration & Documentation**
```typescript
// src/reorg/reorg-service.ts
export class ReorgService {
  private manager: ReorgManager;
  private monitor: ReorgMonitor;
  private logger: Logger;
  
  constructor() {
    this.manager = new ReorgManager(
      new ReorgDetector(provider, db, logger),
      new DataRollbackEngine(db, canonicalManager, logger),
      new DataRecoveryEngine(db, processingPipeline, logger),
      new ReorgEventLogger(db, logger),
      logger
    );
    
    this.monitor = new ReorgMonitor(db, logger);
  }
  
  async start(): Promise<void> {
    // Start reorg detection loop
    setInterval(async () => {
      try {
        await this.manager.handleReorgs();
      } catch (error) {
        this.logger.error('Reorg handling failed', { error: error.message });
      }
    }, 30000); // Check every 30 seconds
    
    this.logger.info('Reorg service started');
  }
  
  async getReorgStatus(): Promise<ReorgStatus> {
    const [metrics, alerts] = await Promise.all([
      this.monitor.getReorgMetrics('24h'),
      this.monitor.getReorgAlerts()
    ]);
    
    return {
      metrics,
      alerts,
      status: alerts.length > 0 ? 'warning' : 'healthy',
      timestamp: new Date()
    };
  }
}
```

## Acceptance Criteria

### Functional Requirements
- [ ] **Reorg Detection**: Detect reorgs within 30 seconds
- [ ] **Canonical Management**: Manage canonical flags for all data
- [ ] **Data Rollback**: Rollback affected data during reorgs
- [ ] **Data Recovery**: Recover from reorgs within 5 minutes
- [ ] **Reorg Monitoring**: Monitor reorg events and performance

### Non-Functional Requirements
- [ ] **Performance**: <60s total reorg handling time
- [ ] **Reliability**: 99.9% reorg handling success rate
- [ ] **Data Integrity**: 100% data consistency after reorgs
- [ ] **Monitoring**: Comprehensive reorg metrics and alerts
- [ ] **Testing**: 90%+ test coverage

### Quality Requirements
- [ ] **Data Consistency**: Maintain data consistency during reorgs
- [ ] **Error Handling**: Robust error handling and recovery
- [ ] **Audit Trail**: Complete audit trail of reorg events
- [ ] **Performance**: Optimized reorg handling performance

## Success Metrics

- **Detection Time**: <30s reorg detection
- **Handling Time**: <60s total reorg handling
- **Recovery Time**: <5min data recovery
- **Success Rate**: 99.9% reorg handling success
- **Data Integrity**: 100% data consistency

## Risk Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Deep Reorgs | High | Low | Handle up to 100 block reorgs |
| Concurrent Reorgs | Medium | Medium | Queue and process sequentially |
| Data Corruption | High | Low | Validation and consistency checks |
| Performance Issues | Medium | Medium | Optimization and monitoring |

## Dependencies

- **Epic 002**: Core Decoding (completed)
- **External**: Blockchain node access, database
- **Internal**: Processing pipeline, canonical flag system

## Deliverables

1. **Reorg Detector**: Comprehensive reorg detection system
2. **Canonical Flag Manager**: Canonical data management
3. **Data Rollback Engine**: Data rollback and recovery
4. **Reorg Monitor**: Reorg monitoring and alerting
5. **Reorg Service**: Unified reorg management service
6. **Tests**: Comprehensive test suite
7. **Documentation**: Reorg handling guide

## Next Steps

After completing this epic:
1. Integrate with Epic 006 (Multi-Chain Support)
2. Prepare for Epic 007 (Performance Optimization)
3. Plan Epic 008 (Production Readiness)
4. Consider advanced reorg analytics

---

**Estimated Effort**: 2-3 weeks  
**Team Size**: 2-3 developers  
**Priority**: High (Critical for data integrity)
