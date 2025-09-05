# 📖 Processing Architecture for Blockchain Data Platform

## 1. Purpose

This document defines the **processing layer architecture** of the in-house blockchain data aggregator. It translates raw chain data (blocks, txs, logs) into canonical, enriched datasets with strong guarantees of correctness, integrity, and performance.

---

## 2. Overview

The processing layer sits between **ingestion (raw nodes/WS/RPC)** and **storage/output (databases, APIs)**. Its responsibilities are:

* Decode raw logs/events using ABIs.
* Normalize into canonical schemas (txs, balances, swaps, NFTs, approvals).
* Handle chain reorganizations with canonical flags.
* Enrich data with metadata (tokens, NFTs), pricing, and protocol context.

---

## 3. Architecture

### 3.1 High-Level Flow

```
[Bronze Storage: raw blocks/logs] → [Decoders + ABI Registry] → [Silver: normalized facts]
                                                         │
                                                         └─► [Enrichers: tokens, prices, protocols] → [Gold: domain marts]
```

### 3.2 Layering

* **Bronze**: Immutable raw chain data (blocks, txs, logs, receipts).
* **Silver**: Canonical normalized tables (transactions, events, transfers, approvals).
* **Gold**: Opinionated data marts (dex\_swaps, lp\_positions, nft\_activity, defi\_positions, bridge\_flows).

---

## 4. Tech Stack

### 4.1 Processing & Decoding

* **Languages**: TypeScript (ethers.js/web3.js), Rust (high-throughput decoding), Go (concurrency).
* **Decoders**: ABI-driven, stateless workers consuming from Kafka/Redpanda queues.
* **Schema Registry**: Contract + ABI mapping (versioned, block-range aware).

### 4.2 Storage

* **Bronze**: Object store (S3/GCS) with Parquet.
* **Silver/Gold**: ClickHouse (ReplacingMergeTree, partitioned by chain + date).
* **Metadata**: Postgres for tokens, ABIs, registries.

### 4.3 Enrichment

* **Token metadata**: eth\_call, explorers (Etherscan API), IPFS fetch.
* **Pricing**: Chainlink oracles + fallback (CoinGecko, Kaiko).
* **Protocol labeling**: registry of known contracts, addresses, ABIs.

### 4.4 Tech Stack Rationale & Alignment

**Guiding principles**

- Consistency-first for the system of record; scale-out and eventual consistency for analytics.
- Start simple for PoC, evolve to specialized components as throughput grows.
- Prefer open standards and widely supported ecosystems.

**Why these choices**

- TypeScript + ethers.js/web3.js: rapid iteration, rich ecosystem, excellent EVM support; Rust/Go added where low-latency/high-parallelism is required (Solana, heavy decode paths).
- Kafka/Redpanda: durable event bus for decoupling ingestion/processing/serving and for backpressure handling at high TPS.
- Object Store (S3/GCS) + Parquet (Bronze): cheap, append-only, columnar format ideal for large immutable raw data; enables reproducibility.
- ClickHouse (Silver/Gold): columnar OLAP engine with ReplacingMergeTree for upserts and canonical flips; partitioning by chain/date aligns with hot-path queries.
- Postgres (Metadata/Control Plane): strong consistency for schemas/ABIs/protocol registries and operational state (cursors, jobs).
- Chainlink + CoinGecko/Kaiko: on-chain first for determinism, with resilient off-chain fallbacks.

**CAP trade-offs (at a glance)**

- Postgres for control/metadata: Consistency over Availability during partitions (effectively CP), matching reorg/canonical integrity needs.
- ClickHouse for analytics: Optimized for Availability and Partition tolerance (AP-ish) with eventual consistency acceptable for BI.
- Object store: AP characteristics; batch readers tolerate eventual consistency.

**Phase alignment**

- PoC/MVP: TypeScript workers + Postgres + minimal object storage; optional local ClickHouse.
- Production: add Kafka/Redpanda, ClickHouse cluster, S3/GCS Bronze, Rust/Go decoders for hot chains, multi-region HA for Postgres and ClickHouse.

**Operational implications**

- Reorg safety: canonical flags propagated from Postgres control plane to ClickHouse via idempotent upserts.
- Cost control: cold raw in S3/GCS (Parquet), hot aggregates in ClickHouse, small metadata in Postgres.
- Extensibility: ABI/contract registries versioned by block range to support protocol upgrades without data rewrites.

---

## 5. Cost Model

* **Compute**: Decoding workers scale with chain throughput.

  * EVM: \~16M logs/day/chain → \~20–30 vCPUs sustained.
  * Solana: 100M+ events/day → requires parallel Rust/Go workers.
* **Storage**:

  * Bronze: \~20–50 GB/day/chain compressed Parquet.
  * Silver/Gold: \~10–20 GB/day after normalization.
* **Infra estimate**: \$2k–\$5k/month for 2–3 EVM chains at production scale, excluding node costs.

---

## 6. Performance

* **Latency**: <2s added over block time.
* **Throughput**: 10k–100k events/sec decode capacity.
* **Reorg handling**: detect & resolve within 60s.
* **Decode success rate**: ≥99.5% for known contracts.

---

## 7. Outputs

* **Canonical schemas**:

  * `transactions(chain, block_number, ts, tx_hash, from, to, method, value, fee, status, canonical)`
  * `events(chain, block_number, tx_hash, log_index, contract, event_name, args_json, protocol_id, canonical)`
  * `transfers(chain, ts, tx_hash, from, to, token, amount, standard, canonical)`
  * `approvals(chain, ts, owner, spender, token, amount, canonical)`
* **Domain marts**:

  * `dex_swaps`, `lp_positions`, `nft_activity`, `defi_positions`, `bridge_flows`, `prices`.

---

## 8. Interfaces

* **APIs**:

  * GraphQL/REST for downstream apps.
  * Webhooks for event triggers (DEX swap, risky approval, liquidation alert).
* **Data Access**:

  * ClickHouse for BI/analytics queries.
  * Parquet (S3/GCS) for data science workloads.
  * Postgres for metadata + control plane.

---

## 9. Data Integrity Controls

* `canonical` flag on every row.
* Deduplication by `(chain, tx_hash, log_index)`.
* Block parity checks vs explorers.
* Decode error tracking & retries.
* Metadata refresh cycles (7 days).

---

## 10. Monitoring

* **Freshness**: ingestion lag <5m.
* **Correctness**: parity with explorers.
* **Reorgs**: monitor frequency, resolution time.
* **Coverage**: % logs decoded to known events.
* **Costs**: compute hours, storage growth, RPC usage.

---

## 11. Conclusion

The processing architecture ensures:

* **High integrity** (canonical flags, reorg safety).
* **Scalable performance** (parallel workers, partitioned storage).
* **Enrichment for insights** (token metadata, USD pricing, protocol context).
* **Interfaces for products** (APIs, BI, data science).

This layer is the **core engine** turning raw blockchain firehose data into reliable, queryable insights for the company’s wallet, DeFi, NFT, and analytics products.
