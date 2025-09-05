# 📌 Product Requirements Document (PRD): Processing Layer

## 1. Overview

The **Processing Layer** is the heart of the in-house blockchain data platform. It transforms raw blockchain data (blocks, txs, logs) into normalized, enriched, and trustworthy datasets. It ensures **integrity, performance, and usability** across wallet, DeFi, NFT, and analytics use cases.

---

## 2. Goals & Objectives

* **Decode** raw logs/events into structured facts using ABIs.
* **Normalize** data into canonical schemas for transactions, transfers, approvals, NFTs, swaps, etc.
* **Ensure Integrity**: handle chain reorganizations with canonical flags and finality rules.
* **Enrich** with token metadata, NFT metadata, pricing, and protocol context.
* **Deliver Performance**: low-latency processing with high throughput.
* **Enable Interfaces**: structured outputs for APIs, dashboards, and analytics.

---

## 3. Scope

### In Scope

* Processing of EVM chains (Ethereum, Polygon, Arbitrum, BSC, Optimism).
* Decoding logs/events using contract ABIs.
* Normalization of:

  * Transactions
  * Events
  * Transfers
  * Approvals
  * Swaps (DEX)
  * NFT activity
  * DeFi positions
  * Bridge flows
* Reorg handling and canonical tracking.
* Enrichment with metadata and prices.

### Out of Scope

* Node operation (handled by ingestion layer).
* Raw block/tx ingestion (covered in ingestion PRD).

---

## 4. Prerequisites & Environment

* **Infrastructure**:

  * Access to blockchain nodes (via ingestion layer).
  * Kafka/Redpanda cluster for streaming events.
  * Object storage (S3/GCS) for bronze layer.
  * ClickHouse cluster for silver/gold analytics.
  * Postgres for metadata/registries.
* **Development Environment**:

  * Docker + Kubernetes for container orchestration.
  * CI/CD pipelines for builds, testing, deployments.
  * Secrets manager (Vault, AWS Secrets) for API keys.
* **Dependencies**:

  * ABI registry and contract address registry.
  * Token metadata service.
  * Price feeds (Chainlink, fallback APIs).
  * IPFS gateways for NFT metadata.

---

## 5. Functional Requirements

### 5.1 Decoding

* Maintain a **registry of ABIs and contracts** (versioned, block-range aware).
* Decode logs/events into structured events.
* Handle missing ABIs gracefully; retry once ABI is added.

### 5.2 Normalization

* Standardize into canonical schemas:

  * `transactions(chain, block_number, ts, tx_hash, from, to, method, value, fee, status, canonical)`
  * `events(chain, tx_hash, log_index, contract, event_name, args_json, protocol_id, canonical)`
  * `transfers(chain, tx_hash, from, to, token, amount, standard, canonical)`
  * `approvals(chain, tx_hash, owner, spender, token, amount, canonical)`
* Domain-specific marts:

  * `dex_swaps`, `lp_positions`, `nft_activity`, `defi_positions`, `bridge_flows`, `prices`.

### 5.3 Reorg Handling

* Store `(block_number, block_hash, canonical)` on every row.
* Flip rows on reorg detection; insert replacement rows.
* Mark orphaned data as `canonical=false`.

### 5.4 Enrichment

* Token metadata from chain calls and explorers.
* NFT metadata via tokenURI/IPFS.
* Pricing from Chainlink oracles + off-chain APIs.
* Protocol labeling via contract registry.

### 5.5 Interfaces

* Expose normalized and enriched data through:

  * Internal APIs (GraphQL, REST).
  * BI/analytics queries via ClickHouse.
  * Data science workloads via Parquet (S3/GCS).
  * Webhooks for real-time event triggers (swaps, approvals, liquidations).

---

## 6. Non-Functional Requirements

* **Latency**: <2s overhead beyond block time.
* **Throughput**: 10k–100k events/sec sustained.
* **Reorg resolution**: within 60s of detection.
* **Decode success rate**: ≥99.5% for known contracts.
* **Scalability**: support 100M+ events/day across chains.
* **Reliability**: 99.9% uptime.

---

## 7. Tech Stack

* **Languages**: TypeScript (ethers.js), Rust (high-performance decoding), Go (concurrent workers).
* **Queue**: Kafka or Redpanda for event distribution.
* **Storage**:

  * Bronze: Parquet on object store (S3/GCS).
  * Silver/Gold: ClickHouse (ReplacingMergeTree, partitioned).
  * Metadata: Postgres.
* **Enrichment Services**: Chainlink, Coingecko, IPFS gateways.

---

## 8. Cost & Performance Estimates

* **Compute**: 20–30 vCPUs per EVM chain; Solana requires higher parallelism.
* **Storage**:

  * Bronze: 20–50 GB/day/chain compressed.
  * Silver/Gold: 10–20 GB/day.
* **Infra estimate**: \$2k–\$5k/month for 2–3 EVM chains.

---

## 9. Data Integrity & Quality Controls

* Deduplication by `(chain, tx_hash, log_index)`.
* Canonical flags for reorg safety.
* Schema validation on ingest.
* Block/tx/log parity checks vs explorers.
* Price sanity checks across sources.
* Metadata refresh cycles (7 days).

---

## 10. Roadmap

**Phase 1 (MVP)**

* Decode transactions, events, transfers.
* Handle reorgs with canonical flags.
* Token metadata enrichment.

**Phase 2**

* Add approvals, DEX swaps, NFT activity.
* Add price enrichment.
* Introduce webhooks.

**Phase 3**

* DeFi positions, liquidity pools, bridge flows.
* Solana and Cosmos expansion.
* Advanced protocol labeling.

**Phase 4**

* Full cross-chain data unification.
* Real-time alerting.
* External API monetization.

---

## 11. Success Metrics

* Ingestion-to-availability lag <5 minutes.
* Data completeness >99% vs explorers.
* Reorg resolution within 60s.
* Adoption by 3+ internal products.
* SLA: 99.9% uptime.

---

## 12. Risks & Mitigation

* **ABI gaps** → Maintain ABI registry + fallback handling.
* **Reorg complexity** → Build Reorg Manager service.
* **High throughput chains (Solana)** → Rust/Go parallel workers, partitioned storage.
* **Metadata volatility** → Regular refresh + caching.
* **Cost overruns** → Optimize batch size, compress storage.

---

✅ This PRD ensures the processing layer provides a **reliable, scalable, and enriched data backbone** for all company blockchain data needs.
