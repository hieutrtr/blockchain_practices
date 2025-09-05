# EPIC-002: Core Decoding - Event Processing Foundation

## Overview

**Goal**: Build a robust event decoding system that can process blockchain events at scale with proper error handling, ABI management, and data normalization.

**Duration**: 3-4 weeks  
**Complexity**: Medium  
**Phase**: Phase 1 (Foundation)  

## Business Value

- **Scalable Processing**: Handle high-volume event processing for production use
- **Data Quality**: Ensure accurate and complete event decoding
- **Developer Experience**: Provide clean APIs for downstream applications
- **Foundation**: Establish the core processing engine for all future features

## Epic Scope

### In Scope
- ABI registry and management system
- Multi-contract event decoding
- Data normalization and validation
- Error handling and retry mechanisms
- Performance optimization
- Comprehensive testing

### Out of Scope
- Real-time processing (handled in later epics)
- Multi-chain support (handled in Epic 006)
- Advanced DeFi analytics (handled in Epic 004)
- Production deployment (handled in Epic 008)

## Technical Requirements

### Core Components
```typescript
// ABI Registry
- Contract address mapping
- Versioned ABI storage
- Block range awareness
- Automatic ABI discovery

// Event Decoder
- Multi-contract support
- Batch processing
- Error recovery
- Performance monitoring

// Data Normalizer
- Schema validation
- Type conversion
- Data enrichment
- Quality checks
```

### Tech Stack Enhancements
```typescript
// Additional Technologies
- Redis for caching
- Bull Queue for job processing
- Joi for schema validation
- Winston for logging
- Jest for testing
```

## User Stories

### US-002-001: ABI Registry
**As a** system  
**I want** to manage contract ABIs with versioning  
**So that** I can decode events from different contract versions  

**Acceptance Criteria:**
- [ ] Store ABIs with version information
- [ ] Map contracts to ABIs by block range
- [ ] Support ABI updates and migrations
- [ ] Cache frequently used ABIs
- [ ] Handle missing ABIs gracefully

### US-002-002: Event Decoding Engine
**As a** system  
**I want** to decode events from multiple contract types  
**So that** I can process diverse blockchain activities  

**Acceptance Criteria:**
- [ ] Decode ERC-20, ERC-721, ERC-1155 events
- [ ] Support custom contract events
- [ ] Handle event parameter types correctly
- [ ] Process events in batches for efficiency
- [ ] Maintain 99.5%+ decode success rate

### US-002-003: Data Normalization
**As a** downstream system  
**I want** normalized event data  
**So that** I can build consistent applications  

**Acceptance Criteria:**
- [ ] Standardize event schemas across contracts
- [ ] Convert data types consistently
- [ ] Validate data integrity
- [ ] Handle edge cases and malformed data
- [ ] Provide data quality metrics

### US-002-004: Error Handling
**As a** system  
**I want** robust error handling and recovery  
**So that** I can maintain high reliability  

**Acceptance Criteria:**
- [ ] Retry failed decodings with exponential backoff
- [ ] Log all errors with context
- [ ] Handle network failures gracefully
- [ ] Implement circuit breakers for external calls
- [ ] Provide error metrics and alerting

### US-002-005: Performance Optimization
**As a** system  
**I want** high-performance event processing  
**So that** I can handle production volumes  

**Acceptance Criteria:**
- [ ] Process 10k+ events per second
- [ ] Use connection pooling for database
- [ ] Implement efficient caching strategies
- [ ] Optimize database queries
- [ ] Monitor performance metrics

## Implementation Plan

### Week 1: ABI Registry Foundation
**Day 1-2: Database Schema**
```sql
-- ABI Management Tables
CREATE TABLE abis (
  id SERIAL PRIMARY KEY,
  contract_address VARCHAR(42) NOT NULL,
  abi_json JSONB NOT NULL,
  version VARCHAR(50) NOT NULL,
  start_block BIGINT NOT NULL,
  end_block BIGINT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE contract_registry (
  id SERIAL PRIMARY KEY,
  address VARCHAR(42) UNIQUE NOT NULL,
  name VARCHAR(100),
  protocol VARCHAR(50),
  standard VARCHAR(20),
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_abis_contract_block ON abis(contract_address, start_block, end_block);
CREATE INDEX idx_contract_registry_address ON contract_registry(address);
```

**Day 3-4: ABI Registry Service**
```typescript
// src/registry/abi-registry.ts
import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';

export class ABIRegistry {
  private db: PrismaClient;
  private cache: Map<string, ethers.Interface> = new Map();
  
  constructor(db: PrismaClient) {
    this.db = db;
  }
  
  async getABI(contractAddress: string, blockNumber: number): Promise<ethers.Interface | null> {
    const cacheKey = `${contractAddress}-${blockNumber}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    // Query database
    const abi = await this.db.abi.findFirst({
      where: {
        contract_address: contractAddress,
        start_block: { lte: blockNumber },
        OR: [
          { end_block: null },
          { end_block: { gte: blockNumber } }
        ]
      },
      orderBy: { start_block: 'desc' }
    });
    
    if (abi) {
      const iface = new ethers.Interface(abi.abi_json as any);
      this.cache.set(cacheKey, iface);
      return iface;
    }
    
    return null;
  }
  
  async registerABI(
    contractAddress: string,
    abi: any[],
    version: string,
    startBlock: number,
    endBlock?: number
  ): Promise<void> {
    await this.db.abi.create({
      data: {
        contract_address: contractAddress,
        abi_json: abi,
        version,
        start_block: startBlock,
        end_block: endBlock
      }
    });
    
    // Clear cache for this contract
    this.clearContractCache(contractAddress);
  }
  
  private clearContractCache(contractAddress: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(contractAddress)) {
        this.cache.delete(key);
      }
    }
  }
}
```

**Day 5: Contract Registry**
```typescript
// src/registry/contract-registry.ts
export class ContractRegistry {
  private db: PrismaClient;
  
  async registerContract(
    address: string,
    name: string,
    protocol: string,
    standard: string,
    verified: boolean = false
  ): Promise<void> {
    await this.db.contractRegistry.upsert({
      where: { address },
      update: {
        name,
        protocol,
        standard,
        verified,
        updated_at: new Date()
      },
      create: {
        address,
        name,
        protocol,
        standard,
        verified
      }
    });
  }
  
  async getContractInfo(address: string): Promise<ContractInfo | null> {
    return await this.db.contractRegistry.findUnique({
      where: { address }
    });
  }
  
  async getContractsByProtocol(protocol: string): Promise<ContractInfo[]> {
    return await this.db.contractRegistry.findMany({
      where: { protocol }
    });
  }
}
```

### Week 2: Event Decoding Engine
**Day 1-2: Core Decoder**
```typescript
// src/decoding/event-decoder.ts
import { ethers } from 'ethers';
import { ABIRegistry } from '../registry/abi-registry';

export class EventDecoder {
  private abiRegistry: ABIRegistry;
  private logger: Logger;
  
  constructor(abiRegistry: ABIRegistry, logger: Logger) {
    this.abiRegistry = abiRegistry;
    this.logger = logger;
  }
  
  async decodeEvent(log: ethers.Log, blockNumber: number): Promise<DecodedEvent | null> {
    try {
      const iface = await this.abiRegistry.getABI(log.address, blockNumber);
      
      if (!iface) {
        this.logger.warn(`No ABI found for contract ${log.address} at block ${blockNumber}`);
        return null;
      }
      
      const decoded = iface.parseLog(log);
      
      if (!decoded) {
        this.logger.warn(`Failed to parse log for contract ${log.address}`);
        return null;
      }
      
      return {
        contract: log.address,
        eventName: decoded.name,
        args: decoded.args,
        blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
        topics: log.topics,
        data: log.data
      };
    } catch (error) {
      this.logger.error(`Error decoding event: ${error.message}`, {
        contract: log.address,
        blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex
      });
      return null;
    }
  }
  
  async decodeEvents(logs: ethers.Log[], blockNumber: number): Promise<DecodedEvent[]> {
    const results = await Promise.allSettled(
      logs.map(log => this.decodeEvent(log, blockNumber))
    );
    
    const decodedEvents: DecodedEvent[] = [];
    const errors: any[] = [];
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        decodedEvents.push(result.value);
      } else if (result.status === 'rejected') {
        errors.push({
          logIndex: index,
          error: result.reason
        });
      }
    });
    
    if (errors.length > 0) {
      this.logger.warn(`Failed to decode ${errors.length} events`, { errors });
    }
    
    return decodedEvents;
  }
}
```

**Day 3-4: Batch Processing**
```typescript
// src/processing/batch-processor.ts
import Bull from 'bull';

export class BatchProcessor {
  private eventQueue: Bull.Queue;
  private decoder: EventDecoder;
  private db: PrismaClient;
  
  constructor() {
    this.eventQueue = new Bull('event processing', {
      redis: { host: 'localhost', port: 6379 }
    });
    
    this.setupQueue();
  }
  
  private setupQueue(): void {
    this.eventQueue.process('decode-events', 10, async (job) => {
      const { logs, blockNumber } = job.data;
      
      const decodedEvents = await this.decoder.decodeEvents(logs, blockNumber);
      
      // Store decoded events
      await this.storeDecodedEvents(decodedEvents);
      
      return { processed: decodedEvents.length };
    });
    
    this.eventQueue.on('completed', (job, result) => {
      console.log(`Job ${job.id} completed: ${result.processed} events processed`);
    });
    
    this.eventQueue.on('failed', (job, err) => {
      console.error(`Job ${job.id} failed:`, err);
    });
  }
  
  async processBlock(blockNumber: number, logs: ethers.Log[]): Promise<void> {
    await this.eventQueue.add('decode-events', {
      logs,
      blockNumber
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });
  }
  
  private async storeDecodedEvents(events: DecodedEvent[]): Promise<void> {
    const eventData = events.map(event => ({
      contract: event.contract,
      event_name: event.eventName,
      args: event.args,
      block_number: event.blockNumber,
      tx_hash: event.transactionHash,
      log_index: event.logIndex,
      topics: event.topics,
      data: event.data
    }));
    
    await this.db.event.createMany({
      data: eventData,
      skipDuplicates: true
    });
  }
}
```

**Day 5: Error Handling**
```typescript
// src/error/error-handler.ts
export class ErrorHandler {
  private logger: Logger;
  private metrics: MetricsCollector;
  
  async handleDecodingError(
    error: Error,
    context: DecodingContext
  ): Promise<void> {
    this.logger.error('Event decoding failed', {
      error: error.message,
      stack: error.stack,
      context
    });
    
    this.metrics.increment('decoding.errors', {
      contract: context.contract,
      event_type: context.eventType,
      error_type: error.constructor.name
    });
    
    // Implement circuit breaker if error rate is too high
    if (await this.isErrorRateHigh(context.contract)) {
      await this.activateCircuitBreaker(context.contract);
    }
  }
  
  private async isErrorRateHigh(contract: string): Promise<boolean> {
    const errorRate = await this.metrics.getErrorRate(contract, '5m');
    return errorRate > 0.1; // 10% error rate threshold
  }
  
  private async activateCircuitBreaker(contract: string): Promise<void> {
    this.logger.warn(`Activating circuit breaker for contract ${contract}`);
    // Implementation for circuit breaker
  }
}
```

### Week 3: Data Normalization
**Day 1-2: Schema Validation**
```typescript
// src/validation/schema-validator.ts
import Joi from 'joi';

export class SchemaValidator {
  private schemas: Map<string, Joi.ObjectSchema> = new Map();
  
  constructor() {
    this.initializeSchemas();
  }
  
  private initializeSchemas(): void {
    // ERC-20 Transfer schema
    this.schemas.set('Transfer', Joi.object({
      from: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
      to: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
      value: Joi.string().pattern(/^\d+$/).required()
    }));
    
    // ERC-721 Transfer schema
    this.schemas.set('Transfer', Joi.object({
      from: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
      to: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
      tokenId: Joi.string().pattern(/^\d+$/).required()
    }));
    
    // Approval schema
    this.schemas.set('Approval', Joi.object({
      owner: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
      spender: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
      value: Joi.string().pattern(/^\d+$/).required()
    }));
  }
  
  validateEvent(eventName: string, args: any): ValidationResult {
    const schema = this.schemas.get(eventName);
    
    if (!schema) {
      return {
        valid: false,
        error: `No schema found for event: ${eventName}`
      };
    }
    
    const { error, value } = schema.validate(args);
    
    return {
      valid: !error,
      error: error?.message,
      data: value
    };
  }
}
```

**Day 3-4: Data Normalizer**
```typescript
// src/normalization/data-normalizer.ts
export class DataNormalizer {
  private validator: SchemaValidator;
  
  normalizeTransferEvent(decodedEvent: DecodedEvent): NormalizedTransfer | null {
    const validation = this.validator.validateEvent('Transfer', decodedEvent.args);
    
    if (!validation.valid) {
      return null;
    }
    
    return {
      chain: 'ethereum',
      contract: decodedEvent.contract,
      from: validation.data.from,
      to: validation.data.to,
      amount: validation.data.value,
      tokenId: validation.data.tokenId, // For ERC-721
      blockNumber: decodedEvent.blockNumber,
      transactionHash: decodedEvent.transactionHash,
      logIndex: decodedEvent.logIndex,
      timestamp: new Date() // Will be enriched later
    };
  }
  
  normalizeApprovalEvent(decodedEvent: DecodedEvent): NormalizedApproval | null {
    const validation = this.validator.validateEvent('Approval', decodedEvent.args);
    
    if (!validation.valid) {
      return null;
    }
    
    return {
      chain: 'ethereum',
      contract: decodedEvent.contract,
      owner: validation.data.owner,
      spender: validation.data.spender,
      amount: validation.data.value,
      blockNumber: decodedEvent.blockNumber,
      transactionHash: decodedEvent.transactionHash,
      logIndex: decodedEvent.logIndex,
      timestamp: new Date()
    };
  }
}
```

**Day 5: Quality Checks**
```typescript
// src/quality/quality-checker.ts
export class QualityChecker {
  private db: PrismaClient;
  
  async checkDataQuality(): Promise<QualityReport> {
    const checks = await Promise.all([
      this.checkDuplicateEvents(),
      this.checkMissingABIs(),
      this.checkInvalidAddresses(),
      this.checkDataCompleteness()
    ]);
    
    return {
      timestamp: new Date(),
      checks,
      overallScore: this.calculateOverallScore(checks)
    };
  }
  
  private async checkDuplicateEvents(): Promise<QualityCheck> {
    const duplicates = await this.db.$queryRaw`
      SELECT tx_hash, log_index, COUNT(*) as count
      FROM events
      GROUP BY tx_hash, log_index
      HAVING COUNT(*) > 1
    `;
    
    return {
      name: 'duplicate_events',
      status: duplicates.length === 0 ? 'pass' : 'fail',
      message: `Found ${duplicates.length} duplicate events`,
      details: duplicates
    };
  }
  
  private async checkMissingABIs(): Promise<QualityCheck> {
    const missingABIs = await this.db.$queryRaw`
      SELECT DISTINCT contract
      FROM events e
      LEFT JOIN abis a ON e.contract = a.contract_address
      WHERE a.id IS NULL
    `;
    
    return {
      name: 'missing_abis',
      status: missingABIs.length === 0 ? 'pass' : 'warn',
      message: `Found ${missingABIs.length} contracts without ABIs`,
      details: missingABIs
    };
  }
}
```

### Week 4: Testing & Optimization
**Day 1-2: Comprehensive Testing**
```typescript
// tests/decoding/event-decoder.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('EventDecoder', () => {
  let decoder: EventDecoder;
  let abiRegistry: ABIRegistry;
  
  beforeEach(async () => {
    abiRegistry = new ABIRegistry(mockDb);
    decoder = new EventDecoder(abiRegistry, mockLogger);
  });
  
  it('should decode ERC-20 Transfer events', async () => {
    const mockLog = createMockERC20TransferLog();
    const decoded = await decoder.decodeEvent(mockLog, 18000000);
    
    expect(decoded).toBeDefined();
    expect(decoded.eventName).toBe('Transfer');
    expect(decoded.args.from).toBe('0x...');
    expect(decoded.args.to).toBe('0x...');
    expect(decoded.args.value).toBe('1000000000000000000');
  });
  
  it('should handle missing ABIs gracefully', async () => {
    const mockLog = createMockLog();
    const decoded = await decoder.decodeEvent(mockLog, 18000000);
    
    expect(decoded).toBeNull();
  });
  
  it('should process events in batches efficiently', async () => {
    const mockLogs = createMockLogs(1000);
    const decoded = await decoder.decodeEvents(mockLogs, 18000000);
    
    expect(decoded.length).toBeGreaterThan(0);
    expect(decoded.every(e => e !== null)).toBe(true);
  });
});
```

**Day 3-4: Performance Optimization**
```typescript
// src/optimization/performance-optimizer.ts
export class PerformanceOptimizer {
  private metrics: MetricsCollector;
  
  async optimizeDecodingPerformance(): Promise<OptimizationReport> {
    const currentMetrics = await this.metrics.getDecodingMetrics();
    
    const optimizations = [
      await this.optimizeABICaching(),
      await this.optimizeBatchSizes(),
      await this.optimizeDatabaseQueries(),
      await this.optimizeMemoryUsage()
    ];
    
    return {
      timestamp: new Date(),
      currentMetrics,
      optimizations,
      expectedImprovement: this.calculateExpectedImprovement(optimizations)
    };
  }
  
  private async optimizeABICaching(): Promise<Optimization> {
    // Implement ABI caching optimization
    return {
      type: 'abi_caching',
      description: 'Optimize ABI caching strategy',
      impact: 'high',
      effort: 'medium'
    };
  }
  
  private async optimizeBatchSizes(): Promise<Optimization> {
    // Implement batch size optimization
    return {
      type: 'batch_sizing',
      description: 'Optimize batch processing sizes',
      impact: 'medium',
      effort: 'low'
    };
  }
}
```

**Day 5: Documentation & Integration**
```typescript
// src/integration/decoding-service.ts
export class DecodingService {
  private processor: BatchProcessor;
  private normalizer: DataNormalizer;
  private qualityChecker: QualityChecker;
  
  async processBlock(blockNumber: number, logs: ethers.Log[]): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Process events
      await this.processor.processBlock(blockNumber, logs);
      
      // Run quality checks
      const qualityReport = await this.qualityChecker.checkDataQuality();
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        blockNumber,
        eventsProcessed: logs.length,
        processingTime,
        qualityReport
      };
    } catch (error) {
      return {
        success: false,
        blockNumber,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }
}
```

## Acceptance Criteria

### Functional Requirements
- [ ] **ABI Registry**: Store and retrieve ABIs with versioning
- [ ] **Event Decoding**: Decode events from multiple contract types
- [ ] **Data Normalization**: Standardize event data across contracts
- [ ] **Error Handling**: Robust error handling with retry mechanisms
- [ ] **Performance**: Process 10k+ events per second

### Non-Functional Requirements
- [ ] **Reliability**: 99.5%+ decode success rate
- [ ] **Performance**: <2s processing time per block
- [ ] **Scalability**: Handle 100M+ events per day
- [ ] **Maintainability**: Clean, documented code
- [ ] **Testability**: 90%+ test coverage

### Quality Requirements
- [ ] **Data Quality**: Comprehensive quality checks
- [ ] **Error Recovery**: Automatic retry and recovery
- [ ] **Monitoring**: Performance and error metrics
- [ ] **Documentation**: Complete API and architecture docs

## Success Metrics

- **Performance**: 10k+ events/second processing capacity
- **Reliability**: 99.5%+ decode success rate
- **Quality**: <1% data quality issues
- **Coverage**: Support for 50+ contract types
- **Efficiency**: <2s processing time per block

## Risk Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| ABI Complexity | High | Medium | Comprehensive testing, fallback handling |
| Performance Issues | High | Medium | Load testing, optimization |
| Data Quality Issues | Medium | High | Validation, quality checks |
| Memory Usage | Medium | Medium | Monitoring, optimization |

## Dependencies

- **Epic 001**: PoC Foundation (completed)
- **External**: Redis, PostgreSQL, Node.js
- **Internal**: ABI registry, contract registry

## Deliverables

1. **ABI Registry**: Complete ABI management system
2. **Event Decoder**: High-performance event decoding engine
3. **Data Normalizer**: Schema validation and normalization
4. **Error Handler**: Robust error handling and recovery
5. **Performance Optimizer**: Performance monitoring and optimization
6. **Tests**: Comprehensive test suite
7. **Documentation**: API docs, architecture guide

## Next Steps

After completing this epic:
1. Integrate with Epic 003 (Data Enrichment)
2. Prepare for Epic 004 (DeFi Analytics)
3. Plan Epic 005 (Reorg Management)
4. Consider performance optimizations

---

**Estimated Effort**: 3-4 weeks  
**Team Size**: 2-3 developers  
**Priority**: High (Core foundation for all processing)
