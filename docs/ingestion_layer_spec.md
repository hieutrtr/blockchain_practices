# Blockchain Data Ingestion Layer: Decision-Oriented Analysis & Implementation Spec

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Node Infrastructure Strategy](#node-infrastructure-strategy)
3. [Data Fetching Patterns](#data-fetching-patterns)
4. [Backfill & Reconciliation](#backfill--reconciliation)
5. [Protocol Registries & ABI Governance](#protocol-registries--abi-governance)
6. [Throughput & Capacity Planning](#throughput--capacity-planning)
7. [Freshness & Data Quality](#freshness--data-quality)
8. [Chain-Specific Considerations](#chain-specific-considerations)
9. [Architecture & Component Design](#architecture--component-design)
10. [Implementation Patterns](#implementation-patterns)
11. [Monitoring & Observability](#monitoring--observability)
12. [Security & Resilience](#security--resilience)
13. [Decision Summary & Recommendations](#decision-summary--recommendations)

---

## Executive Summary

This document provides a pragmatic, decision-oriented analysis of blockchain data ingestion architecture with concrete trade-offs, failure modes, SLOs, and implementation patterns. The approach balances time-to-market with operational complexity while ensuring data quality and system reliability.

**Key Principles:**
- Start with leased infrastructure, evolve to self-hosted for critical chains
- Hybrid WebSocket + JSON-RPC approach for optimal latency and reliability
- Idempotent, reorg-safe data models with canonical flagging
- Governed ABI registry for accurate protocol decoding
- Comprehensive monitoring and alerting from day one

---

## Node Infrastructure Strategy

### Decision Framework: Run vs. Lease

#### Decision Levers

| Factor | Self-Run Nodes | Leased Endpoints |
|--------|----------------|------------------|
| **Latency & Control** | ✅ Full control, canonical truth | ❌ Provider quirks, potential delays |
| **Time-to-Market** | ❌ 2-6 months setup | ✅ Immediate availability |
| **Operational Load** | ❌ High (monitoring, updates, scaling) | ✅ Managed by provider |
| **Cost Predictability** | ❌ Variable (hardware, bandwidth) | ✅ Predictable per-request |
| **Custom Features** | ✅ Full access to traces, custom RPCs | ❌ Limited to standard APIs |

#### Recommended Mix (Phaseable Approach)

**Phase 1: Foundation**
- **EVM Chains**: Leased RPC+WS from 2+ vendors (A/B testing)
- **Solana**: Geyser plugin capable provider
- **Cosmos**: Leased gRPC+Tendermint RPC from 2 vendors
- **Bitcoin**: Leased endpoints for initial development

**Phase 2: Optimization**
- **EVM**: Add self-run Erigon/Nethermind for backfill + traces
- **Solana**: Evaluate own validators if slot-level firehose needed
- **Cosmos**: Self-host once stable
- **Bitcoin**: Run pruned node + ZMQ for real-time

#### SLO Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Freshness** | P95 < 2-3 blocks (EVM) / < 2 slots (Solana) | `node_head - ingested_head` |
| **Availability** | 99.9% endpoint success | Provider health checks |
| **Data Consistency** | 0 missing blocks per canonical height | Reconciliation jobs |
| **Latency** | P95 < 500ms for head notifications | WebSocket round-trip time |

---

## Data Fetching Patterns

### WebSocket (Live Stream)

**Use Cases:**
- Real-time head notifications
- Targeted log subscriptions
- Mempool monitoring (when available)

**Implementation Pattern:**
```typescript
// EVM WebSocket subscription
const ws = new WebSocketProvider(WSS_URL, { reconnect: true });

// Head notifications
ws.on("block", (blockNumber) => {
  enqueue({
    chain: "eth",
    block: blockNumber,
    source: "ws",
    timestamp: Date.now()
  });
});

// Targeted log subscriptions
ws.on({
  address: ROUTER_ADDRESS,
  topics: [SWAP_TOPIC, ADD_LIQUIDITY_TOPIC]
}, (log) => {
  enqueueLog({
    ...log,
    source: "ws",
    provisional: true
  });
});
```

### JSON-RPC (Batch Operations)

**Use Cases:**
- Backfill operations
- Reconciliation
- Retry mechanisms
- Full block data fetching

**Best Practice Loop:**
1. **Live Path (WS)**: Enqueue block numbers + minimal metadata
2. **Batch Path (RPC)**: Workers pull full blocks/txs/logs/traces
3. **Safety Pass**: N-confirmation delay before marking canonical

**Implementation Pattern:**
```typescript
// Batch fetcher with adaptive chunking
class BatchFetcher {
  async fetchBlockRange(chain: string, from: number, to: number) {
    const chunkSize = this.getOptimalChunkSize(chain);
    
    for (let start = from; start <= to; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, to);
      
      try {
        const blocks = await this.fetchBlocks(chain, start, end);
        await this.processBlocks(blocks);
        this.increaseChunkSize(); // Success: grow window
      } catch (error) {
        this.decreaseChunkSize(); // Error: shrink window
        throw error;
      }
    }
  }
}
```

### Failure Controls

| Control | Implementation | Purpose |
|---------|----------------|---------|
| **Circuit Breaker** | Per provider, per method | Prevent cascade failures |
| **Rate Limiting** | Token bucket algorithm | Respect provider limits |
| **Exponential Backoff** | Jittered retry delays | Handle temporary failures |
| **Idempotent Writes** | Keyed on (chain, block_number, block_hash) | Handle duplicate processing |

---

## Backfill & Reconciliation

### Range Planning Strategy

**Chunk Sizing Guidelines:**
- **EVM**: 5k-20k blocks (adaptive based on provider response)
- **Solana**: 50k slots
- **Cosmos**: 10k blocks
- **Bitcoin**: 1k blocks

**Work Ledger Schema:**
```sql
CREATE TABLE backfill_tasks (
  id UUID PRIMARY KEY,
  chain VARCHAR(20) NOT NULL,
  from_block BIGINT NOT NULL,
  to_block BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL, -- pending, in_progress, completed, failed
  attempt INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE backfill_cursor (
  chain VARCHAR(20) PRIMARY KEY,
  last_complete_block BIGINT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Execution Pattern

**Priority Strategy:**
1. **Recent gaps first**: Fill holes in recent data
2. **Sweep backward**: Historical backfill
3. **FIFO by height**: For warm caches

**Reorg-Safe Schema:**
```sql
-- Every table includes these fields
CREATE TABLE transactions (
  chain VARCHAR(20) NOT NULL,
  block_number BIGINT NOT NULL,
  block_hash VARCHAR(66) NOT NULL,
  canonical BOOLEAN DEFAULT true,
  ingested_at TIMESTAMP DEFAULT NOW(),
  ingest_version INTEGER DEFAULT 1,
  -- ... other fields
  PRIMARY KEY (chain, block_number, tx_hash)
);
```

**Reorg Handling:**
```typescript
class ReorgManager {
  async handleReorg(chain: string, oldHead: number, newHead: number) {
    // Mark orphaned blocks as non-canonical
    await this.markNonCanonical(chain, oldHead, newHead);
    
    // Insert new canonical branch
    await this.insertNewBranch(chain, newHead);
    
    // Update downstream views
    await this.refreshGoldViews(chain);
  }
}
```

---

## Protocol Registries & ABI Governance

### Data Model

```sql
-- Protocol registry
CREATE TABLE protocols (
  protocol_id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  family VARCHAR(20) NOT NULL, -- dex, lending, nft, etc.
  website VARCHAR(200),
  source_ref VARCHAR(200),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Contract registry
CREATE TABLE contracts (
  chain VARCHAR(20) NOT NULL,
  address VARCHAR(42) NOT NULL,
  protocol_id VARCHAR(50) NOT NULL,
  role VARCHAR(20) NOT NULL, -- router, pool, token, oracle
  start_block BIGINT NOT NULL,
  end_block BIGINT,
  verified_source VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (chain, address)
);

-- ABI management
CREATE TABLE abis (
  abi_id UUID PRIMARY KEY,
  protocol_id VARCHAR(50) NOT NULL,
  version VARCHAR(20) NOT NULL,
  json JSONB NOT NULL,
  source_url VARCHAR(200),
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Contract-ABI mapping with versioning
CREATE TABLE contract_abi_map (
  chain VARCHAR(20) NOT NULL,
  address VARCHAR(42) NOT NULL,
  abi_id UUID NOT NULL,
  valid_from_block BIGINT NOT NULL,
  valid_to_block BIGINT,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (chain, address, abi_id)
);
```

### Governance Process

**ABI Lifecycle:**
1. **Discovery**: Auto-ingest from explorers, manual curation
2. **Review**: Code review for accuracy and completeness
3. **Versioning**: Semantic versioning with backward compatibility
4. **Deployment**: Gradual rollout with monitoring
5. **Validation**: Continuous accuracy checks

**Decoder Design:**
```typescript
interface Decoder {
  decode(chain: string, log: Log): DecodedEvent | Unknown;
}

class ProtocolDecoder implements Decoder {
  async decode(chain: string, log: Log): Promise<DecodedEvent | Unknown> {
    // Get ABI for this contract at this block
    const abi = await this.getABI(chain, log.address, log.blockNumber);
    
    if (!abi) {
      return { type: 'unknown', raw: log };
    }
    
    try {
      const decoded = this.decodeWithABI(log, abi);
      return { type: 'decoded', data: decoded, abi_version: abi.version };
    } catch (error) {
      return { type: 'decode_error', error: error.message, raw: log };
    }
  }
}
```

---

## Throughput & Capacity Planning

### First-Order Math

**EVM Chains (Ethereum L2):**
- Blocks per day: ~28,800
- Average txs per block: 200
- Average logs per tx: 3
- **Total logs/day**: 28,800 × 200 × 3 = **17.28M logs/day/chain**

**Storage Implications:**
- Raw log size: ~200 bytes
- Daily storage: 17.28M × 200 bytes = **3.46 GB/day/chain**
- Monthly storage: ~100 GB/chain
- Annual storage: ~1.2 TB/chain

### Architecture Decisions

**Storage Layer:**
- **Format**: Columnar (Parquet) for analytics
- **Database**: ClickHouse for real-time queries
- **Partitioning**: `(chain, toDate(timestamp))`
- **Ordering**: `(chain, timestamp, address, topic0)`

**Message Bus:**
- **Kafka/Redpanda**: For multiple decoders and sinks
- **Partitioning**: By chain for ordering guarantees
- **Retention**: 7 days for reprocessing

**Processing Pattern:**
```typescript
// ClickHouse table schema
CREATE TABLE raw_logs (
  chain String,
  block_number UInt64,
  block_hash String,
  tx_hash String,
  log_index UInt32,
  address String,
  topic0 String,
  data String,
  canonical UInt8,
  ingested_at DateTime,
  ingest_version UInt32
) ENGINE = ReplacingMergeTree(ingest_version)
PARTITION BY (chain, toYYYYMM(toDateTime(ingested_at)))
ORDER BY (chain, ingested_at, address, topic0);
```

---

## Freshness & Data Quality

### Live → Final Pipeline

**Confirmation Strategy:**
1. **Provisional**: Ingest on head (0 conf)
2. **Confirmed**: After 2-3 blocks (EVM) / 2 slots (Solana)
3. **Finalized**: After finality depth (15 blocks EVM) or BFT finality

**Reconciliation Jobs:**
```typescript
class ReconciliationJob {
  async run() {
    // Random sample validation
    const sampleBlocks = await this.getRandomSample(100);
    
    for (const block of sampleBlocks) {
      const ourData = await this.getOurBlock(block.number);
      const nodeData = await this.fetchFromNode(block.number);
      
      if (!this.compareBlocks(ourData, nodeData)) {
        await this.alertDiscrepancy(block.number);
      }
    }
    
    // Monotonicity check
    await this.validateMonotonicity();
  }
}
```

### Key Performance Indicators

| KPI | Target | Alert Threshold |
|-----|--------|-----------------|
| **Head Lag** | < 2 blocks | > 5 blocks |
| **Provisional %** | < 10% of total | > 20% |
| **Decode Failure Rate** | < 1% | > 5% |
| **Backfill Velocity** | > 1000 blocks/hour | < 500 blocks/hour |
| **Data Parity** | 100% match | < 99.9% match |

---

## Chain-Specific Considerations

### EVM Chains

**Challenges:**
- `eth_getLogs` provider limits
- Heavy trace operations
- Complex reorg handling

**Solutions:**
```typescript
// Binary search windowing for large log queries
async function fetchLogsWithWindowing(
  fromBlock: number, 
  toBlock: number, 
  topics: string[]
) {
  const maxWindow = 10000;
  let currentFrom = fromBlock;
  
  while (currentFrom <= toBlock) {
    const currentTo = Math.min(currentFrom + maxWindow - 1, toBlock);
    
    try {
      const logs = await provider.getLogs({
        fromBlock: currentFrom,
        toBlock: currentTo,
        topics
      });
      
      await processLogs(logs);
      currentFrom = currentTo + 1;
    } catch (error) {
      if (error.message.includes('query timeout') || 
          error.message.includes('too large')) {
        maxWindow = Math.floor(maxWindow / 2);
        continue;
      }
      throw error;
    }
  }
}
```

### Solana

**Key Considerations:**
- Geyser stream for slot/transaction logs
- Vote/duplication semantics
- Finality states: processed/confirmed/finalized

**Implementation:**
```typescript
class SolanaIngestion {
  async setupGeyserStream() {
    const stream = new GeyserStream({
      accounts: [PROGRAM_IDS],
      transactions: true,
      blocks: true
    });
    
    stream.on('transaction', (tx) => {
      if (tx.meta.err) return; // Skip failed transactions
      
      this.enqueueTransaction({
        ...tx,
        finality: 'processed' // Will be updated to confirmed/finalized
      });
    });
  }
}
```

### Cosmos

**Advantages:**
- Simpler reorg story (finalized instantly)
- Tendermint events over RPC/gRPC
- Clear finality model

### Bitcoin

**UTXO Model Handling:**
```typescript
class BitcoinIngestion {
  async deriveTransfers(block: BitcoinBlock) {
    const transfers = [];
    
    for (const tx of block.transactions) {
      // Process inputs (spending)
      for (const input of tx.inputs) {
        transfers.push({
          type: 'spend',
          address: input.address,
          amount: -input.value,
          tx_hash: tx.hash
        });
      }
      
      // Process outputs (receiving)
      for (const output of tx.outputs) {
        transfers.push({
          type: 'receive',
          address: output.address,
          amount: output.value,
          tx_hash: tx.hash
        });
      }
    }
    
    return transfers;
  }
}
```

---

## Architecture & Component Design

### System Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Node Pool A   │    │   Node Pool B   │
│   (RPC + WS)    │    │   (RPC + WS)    │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          └──────────┬───────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
    ▼                ▼                ▼
┌─────────┐    ┌─────────┐    ┌─────────┐
│Head List│    │Log Sub  │    │Backfill │
│(WS)     │    │(topics) │    │Orch.    │
└────┬────┘    └────┬────┘    └────┬────┘
     │              │              │
     ▼              ▼              ▼
┌─────────┐    ┌─────────┐    ┌─────────┐
│Block    │    │Log      │    │Range    │
│Queue    │    │Queue    │    │Tasks    │
└────┬────┘    └────┬────┘    └────┬────┘
     │              │              │
     └──────────────┼──────────────┘
                    │
                    ▼
            ┌─────────────┐
            │Batch        │
            │Fetchers     │
            │(RPC)        │
            └──────┬──────┘
                   │
                   ▼
            ┌─────────────┐
            │Decode       │
            │Workers      │
            └──────┬──────┘
                   │
                   ▼
            ┌─────────────┐
            │Bronze       │
            │Tables       │
            └──────┬──────┘
                   │
        ┌──────────┼──────────┐
        │          │          │
        ▼          ▼          ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│Reorg    │ │Token    │ │Price    │
│Manager  │ │Enricher │ │Enricher │
└────┬────┘ └────┬────┘ └────┬────┘
     │           │           │
     └───────────┼───────────┘
                 │
                 ▼
         ┌─────────────┐
         │Silver/Gold  │
         │Views        │
         └─────────────┘
```

### Component Responsibilities

| Component | Responsibility | Technology |
|-----------|----------------|------------|
| **Head Listener** | WebSocket subscriptions, head notifications | Node.js, ethers.js |
| **Log Subscriber** | Targeted log subscriptions | WebSocket, topic filters |
| **Backfill Orchestrator** | Range planning, task distribution | PostgreSQL, job queue |
| **Batch Fetchers** | RPC calls, adaptive chunking | HTTP clients, retry logic |
| **Decode Workers** | ABI decoding, protocol identification | TypeScript, ethers.js |
| **Reorg Manager** | Canonical flag management | Database triggers, jobs |
| **Enrichers** | Token metadata, price data | External APIs, caching |

---

## Implementation Patterns

### WebSocket Connection Management

```typescript
class WebSocketManager {
  private connections: Map<string, WebSocketProvider> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  
  async connect(chain: string, url: string) {
    const provider = new WebSocketProvider(url, {
      reconnect: {
        auto: true,
        delay: 5000,
        maxAttempts: 10
      }
    });
    
    provider.on('error', (error) => {
      this.handleError(chain, error);
    });
    
    provider.on('block', (blockNumber) => {
      this.handleNewBlock(chain, blockNumber);
    });
    
    this.connections.set(chain, provider);
  }
  
  private async handleError(chain: string, error: Error) {
    const attempts = this.reconnectAttempts.get(chain) || 0;
    
    if (attempts > 5) {
      await this.failoverToBackup(chain);
    }
    
    this.reconnectAttempts.set(chain, attempts + 1);
  }
}
```

### Adaptive Chunking Algorithm

```typescript
class AdaptiveChunker {
  private chunkSizes: Map<string, number> = new Map();
  private successRates: Map<string, number[]> = new Map();
  
  getOptimalChunkSize(chain: string): number {
    const current = this.chunkSizes.get(chain) || 10000;
    const recentSuccess = this.getRecentSuccessRate(chain);
    
    if (recentSuccess > 0.95) {
      // Increase chunk size
      const newSize = Math.min(current * 1.5, 50000);
      this.chunkSizes.set(chain, newSize);
    } else if (recentSuccess < 0.8) {
      // Decrease chunk size
      const newSize = Math.max(current * 0.5, 1000);
      this.chunkSizes.set(chain, newSize);
    }
    
    return this.chunkSizes.get(chain)!;
  }
  
  recordAttempt(chain: string, success: boolean) {
    const rates = this.successRates.get(chain) || [];
    rates.push(success ? 1 : 0);
    
    // Keep only last 100 attempts
    if (rates.length > 100) {
      rates.shift();
    }
    
    this.successRates.set(chain, rates);
  }
}
```

### Idempotent Upsert Pattern

```typescript
// ClickHouse ReplacingMergeTree pattern
class IdempotentUpsert {
  async upsertTransaction(tx: Transaction) {
    const query = `
      INSERT INTO transactions (
        chain, block_number, block_hash, tx_hash,
        canonical, ingested_at, ingest_version,
        from_address, to_address, value, gas_used
      ) VALUES (
        '${tx.chain}', ${tx.blockNumber}, '${tx.blockHash}', '${tx.hash}',
        ${tx.canonical ? 1 : 0}, now(), ${tx.version},
        '${tx.from}', '${tx.to}', ${tx.value}, ${tx.gasUsed}
      )
    `;
    
    await this.clickhouse.query(query);
  }
}
```

---

## Monitoring & Observability

### Essential Metrics

**Lag Monitoring:**
```typescript
class LagMonitor {
  async checkHeadLag() {
    const nodeHead = await this.getNodeHead();
    const ingestedHead = await this.getIngestedHead();
    const lag = nodeHead - ingestedHead;
    
    this.metrics.gauge('ingestion.head_lag', lag, {
      chain: this.chain
    });
    
    if (lag > 5) {
      await this.alert('High head lag detected', { lag, chain: this.chain });
    }
  }
}
```

**Error Budget Tracking:**
```typescript
class ErrorBudgetTracker {
  trackProviderError(provider: string, method: string, error: Error) {
    const errorType = this.classifyError(error);
    
    this.metrics.counter('provider.errors', 1, {
      provider,
      method,
      error_type: errorType
    });
    
    // Calculate error budget
    const totalRequests = this.getTotalRequests(provider, method);
    const errorRate = this.getErrorRate(provider, method);
    
    if (errorRate > 0.01) { // 1% error rate threshold
      await this.alert('Error budget exceeded', {
        provider,
        method,
        error_rate: errorRate
      });
    }
  }
}
```

### Data Quality Checks

```typescript
class DataQualityChecker {
  async runParityCheck() {
    // Compare block counts with explorer
    const ourBlocks = await this.getOurBlockCount();
    const explorerBlocks = await this.getExplorerBlockCount();
    
    const discrepancy = Math.abs(ourBlocks - explorerBlocks);
    
    this.metrics.gauge('data_quality.block_discrepancy', discrepancy);
    
    if (discrepancy > 10) {
      await this.alert('Block count discrepancy detected', {
        our_blocks: ourBlocks,
        explorer_blocks: explorerBlocks,
        discrepancy
      });
    }
  }
  
  async validateMonotonicity() {
    const gaps = await this.findBlockGaps();
    
    if (gaps.length > 0) {
      await this.alert('Block gaps detected', { gaps });
    }
  }
}
```

### Alerting Rules

| Alert | Condition | Severity | Action |
|-------|-----------|----------|---------|
| **High Head Lag** | `head_lag > 5 blocks` | Critical | Page on-call |
| **Provider Down** | `provider_health < 0.9` | Critical | Failover + page |
| **Data Discrepancy** | `block_discrepancy > 10` | High | Investigate |
| **Decode Failure** | `decode_failure_rate > 0.05` | Medium | Review ABIs |
| **Backfill Slow** | `backfill_velocity < 500 blocks/hour` | Medium | Scale workers |

---

## Security & Resilience

### Multi-Provider Strategy

```typescript
class ProviderManager {
  private providers: Map<string, Provider[]> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  
  async getProvider(chain: string, method: string): Promise<Provider> {
    const chainProviders = this.providers.get(chain) || [];
    
    for (const provider of chainProviders) {
      const breaker = this.circuitBreakers.get(provider.id);
      
      if (breaker && breaker.isOpen()) {
        continue; // Skip failed providers
      }
      
      try {
        return provider;
      } catch (error) {
        breaker?.recordFailure();
        continue;
      }
    }
    
    throw new Error(`No healthy providers available for ${chain}`);
  }
}
```

### Rate Limiting & Backpressure

```typescript
class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();
  
  async acquire(provider: string, method: string): Promise<boolean> {
    const key = `${provider}:${method}`;
    const bucket = this.buckets.get(key) || new TokenBucket({
      capacity: this.getCapacity(method),
      refillRate: this.getRefillRate(method)
    });
    
    const acquired = bucket.tryAcquire(1);
    
    if (!acquired) {
      this.metrics.counter('rate_limit.exceeded', 1, { provider, method });
      return false;
    }
    
    this.buckets.set(key, bucket);
    return true;
  }
}
```

### Poison Pill Handling

```typescript
class PoisonPillHandler {
  async handlePoisonPill(message: any, error: Error) {
    // Log the poison pill
    await this.logPoisonPill(message, error);
    
    // Send to dead letter queue
    await this.deadLetterQueue.send({
      original_message: message,
      error: error.message,
      timestamp: Date.now(),
      retry_count: message.retry_count || 0
    });
    
    // Alert if too many poison pills
    const recentPills = await this.getRecentPoisonPills(5 * 60 * 1000); // 5 minutes
    if (recentPills > 10) {
      await this.alert('High poison pill rate detected', { count: recentPills });
    }
  }
}
```

### Schema Registry

```typescript
// Avro schema for Kafka messages
const transactionSchema = {
  type: 'record',
  name: 'Transaction',
  fields: [
    { name: 'chain', type: 'string' },
    { name: 'block_number', type: 'long' },
    { name: 'block_hash', type: 'string' },
    { name: 'tx_hash', type: 'string' },
    { name: 'from_address', type: 'string' },
    { name: 'to_address', type: 'string' },
    { name: 'value', type: 'string' },
    { name: 'gas_used', type: 'long' },
    { name: 'canonical', type: 'boolean' },
    { name: 'ingested_at', type: 'long' }
  ]
};
```

---

## Decision Summary & Recommendations

### Recommended Default Architecture

**Phase 1: Foundation (Months 1-3)**
```
┌─────────────────────────────────────────────────────────────┐
│                    Hybrid Infrastructure                     │
├─────────────────────────────────────────────────────────────┤
│ • 2x leased node providers per chain                        │
│ • Shared connection pool with failover                      │
│ • WebSocket head notifications + RPC batch fetching         │
│ • Chunked backfill with adaptive windows                    │
│ • Raw bronze storage with canonical flags                   │
│ • Governed ABI registry for protocol decoding               │
│ • ClickHouse + Parquet storage                              │
│ • Asynchronous price & metadata enrichers                   │
└─────────────────────────────────────────────────────────────┘
```

**Phase 2: Optimization (Months 4-8)**
```
┌─────────────────────────────────────────────────────────────┐
│                    Self-Hosted Critical Chains              │
├─────────────────────────────────────────────────────────────┤
│ • Self-run Erigon/Nethermind for EVM chains                 │
│ • Custom trace APIs for advanced analytics                  │
│ • Geyser validators for Solana (if needed)                  │
│ • Enhanced monitoring and alerting                          │
│ • Multi-region deployment                                   │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Checklist

**Week 1-2: Infrastructure Setup**
- [ ] Set up 2+ node providers per chain
- [ ] Implement connection pooling and failover
- [ ] Create basic WebSocket + RPC fetchers
- [ ] Set up ClickHouse cluster

**Week 3-4: Core Ingestion**
- [ ] Implement head listener and block queue
- [ ] Build batch fetchers with adaptive chunking
- [ ] Create bronze table schemas with canonical flags
- [ ] Set up basic monitoring

**Week 5-6: Data Quality**
- [ ] Implement reconciliation jobs
- [ ] Build reorg manager
- [ ] Create data quality checks
- [ ] Set up alerting

**Week 7-8: Protocol Support**
- [ ] Build ABI registry and governance
- [ ] Implement protocol decoders
- [ ] Create token and price enrichers
- [ ] Build silver/gold views

**Week 9-12: Production Readiness**
- [ ] Comprehensive monitoring dashboard
- [ ] Load testing and optimization
- [ ] Security audit and hardening
- [ ] Documentation and runbooks

### Success Metrics

| Metric | Target | Timeline |
|--------|--------|----------|
| **Time to First Data** | < 2 weeks | Week 2 |
| **Data Freshness** | < 2 blocks lag | Week 4 |
| **Data Quality** | > 99.9% accuracy | Week 6 |
| **System Reliability** | > 99.9% uptime | Week 8 |
| **Cost Efficiency** | < $0.01 per 1M logs | Week 12 |

### Risk Mitigation

| Risk | Mitigation | Timeline |
|------|------------|----------|
| **Provider Outages** | Multi-provider + circuit breakers | Week 1 |
| **Data Inconsistency** | Reconciliation + canonical flags | Week 4 |
| **Scale Issues** | Adaptive chunking + monitoring | Week 6 |
| **Cost Overruns** | Usage tracking + optimization | Week 8 |

This specification provides a comprehensive roadmap for building a production-ready blockchain data ingestion system that balances speed, reliability, and cost-effectiveness while maintaining high data quality standards.
