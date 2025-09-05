# 📖 Ingestion Architecture for Blockchain Data Platform

## 1. Purpose

This document defines the **ingestion architecture** for our in-house blockchain data aggregator. It focuses on cost, performance, data size, and event throughput to ensure reliable scaling across multiple chains.

---

## 2. Ingestion Components

### 2.1 Node Layer

* **Dedicated nodes** (self-hosted or leased) per chain (Ethereum, Polygon, BSC, Arbitrum, Solana, etc.).
* **RPC (JSON-RPC)**: Used for backfill and block/tx queries.
* **WebSocket (WS)**: Used for real-time subscriptions (new blocks, logs).
* **Failover strategy**: At least 2 providers per chain.

### 2.2 Ingestion Services

* **Block Listener**: Subscribes to new heads; queues block numbers.
* **Log Listener**: Subscribes to logs by topics (swaps, approvals, transfers).
* **Backfill Orchestrator**: Manages historical data ingestion in chunks.
* **Decoder**: Translates raw logs/events into structured data using ABI registries.
* **Reorg Manager**: Marks canonical vs orphaned blocks.

### 2.3 Data Flow

```
[Node RPC/WS] → [Listeners] → [Queue (Kafka/Redpanda)] → [Decoders] → [Bronze Storage]
                                                           │
                                                           └─► [Enrichers (metadata, prices)] → [Silver/Gold Storage]
```

---

## 3. Cost Model

### 3.1 Node Costs

* **Self-hosted**:

  * \$500–\$1500/month per EVM archive node (cloud infra + storage).
  * Solana validator with Geyser plugin: \$1000–\$2000/month.
* **Leased providers**:

  * Pay-per-request or subscription.
  * Typical: \$50–\$500/month per chain depending on throughput.

### 3.2 Infra Costs

* **Message queue (Kafka/Redpanda)**: \$500–\$2000/month depending on scale.
* **ClickHouse cluster**: \$1000–\$3000/month for analytics tier.
* **Object store (S3/GCS)**: \~\$20/TB/month for raw Parquet archives.

### 3.3 Trade-off

* **Leased nodes cheaper to start**, but cost scales with requests.
* **Self-hosted more predictable long-term** if processing 100M+ tx/day.

---

## 4. Performance Metrics

### 4.1 Data Size

* **EVM Chains**:

  * Blocks/day ≈ 28k.
  * Avg tx/block ≈ 200.
  * Logs/tx ≈ 3.
  * **\~17M logs/day/chain**.
  * Storage ≈ 20–30 GB/day raw Parquet (compressed).
* **Solana**:

  * Higher slot frequency (400ms).
  * 100–500 tx/slot → 100M+ events/day.
* **Bitcoin**:

  * Lower volume but UTXO parsing required.

### 4.2 Event Speed

* **Ethereum L1**: \~12s block time.
* **L2s (Arbitrum, Optimism, Polygon PoS)**: 1–2s block time.
* **Solana**: 400ms slot.
* **Kafka ingestion target**: 10k–100k msgs/sec.

### 4.3 Latency Targets

* Ingest pipeline adds <2s over native block time.
* Reorg detection & resolution within 60s.

---

## 5. Data Integrity

* Store `(block_number, block_hash, canonical)` with every row.
* Deduplicate tx/logs by `(chain, tx_hash, log_index)`.
* Periodic reconciliation with explorers.
* Retry policies: exponential backoff, adaptive windowing for `eth_getLogs`.

---

## 6. Scalability Considerations

* Partition storage by `(chain, toDate(ts))`.
* Use **ReplacingMergeTree** in ClickHouse for reorg updates.
* Horizontal scaling of decoders & enrichers.
* Kafka consumer groups for parallelism.

---

## 7. Monitoring

* **Lag**: Node head vs ingestion head.
* **Error rates**: RPC errors, decode failures.
* **Throughput**: msgs/sec, queue lag.
* **Data gaps**: missing block/tx/log counts.
* **Cost dashboard**: node usage vs self-host cost.

---

## 8. Conclusion

This ingestion architecture balances **control, scalability, and cost**. Early stages can rely on leased providers for speed, while self-hosting becomes cost-effective at scale. By designing with queues, canonical tracking, and partitioned storage, we ensure resilience and accurate analytics across chains.
