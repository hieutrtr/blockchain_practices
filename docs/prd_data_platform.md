# 📌 Product Requirements Document (PRD): Wallet Data Platform (Full-Control, In-House)

## 1. Overview

The Wallet Data Platform will be built as an **in-house, full-control data aggregator**. It directly ingests blockchain data from nodes (via RPC/WS), processes and normalizes it, and serves enriched insights. This approach minimizes reliance on external APIs, ensuring **data ownership, reliability, and flexibility** for the company’s products.

---

## 2. Goals & Objectives

* **Full Control**: Ingest raw data directly from blockchain nodes.
* **Data Integrity**: Guarantee canonical correctness, handle reorganizations, and prevent duplicates.
* **Data Quality**: Ensure accuracy, completeness, and freshness across all supported chains.
* **Multi-Chain Support**: Start with EVM chains (Ethereum, Polygon, BSC, Arbitrum, Optimism), later expand to Solana, Cosmos, Bitcoin.
* **Internal Integration**: Provide data for:

  * Wallet client (balances, tx history, NFTs, approvals).
  * Analytics & dashboards (portfolio, DeFi activity, KPIs).
  * Internal APIs and partner integrations.
* **Scalability**: Capable of indexing millions of addresses and billions of transactions.
* **Extensibility**: Modular adapters for new chains and protocols.

---

## 3. Data Types (Scope)

The platform will support the following wallet-related data domains:

1. **Identity**: Wallet addresses, derivation paths (public only).
2. **Balances**: Native token, ERC-20, NFTs.
3. **Transactions**: Hash, sender/receiver, status, receipts, logs.
4. **Token Metadata**: Name, symbol, decimals, NFT metadata.
5. **Approvals**: Allowances for token spending.
6. **DEX Swaps**: Token swaps, pools, protocols.
7. **Liquidity Positions**: LP tokens, Uniswap v3 NFT positions, fees.
8. **NFT Activity**: Mints, transfers, sales.
9. **DeFi Positions**: Lending, borrowing, staking.
10. **Bridge Flows**: Cross-chain transfers.
11. **Prices**: On-chain oracles (Chainlink), complemented by external aggregators for enrichment.

---

## 4. Functional Requirements

### 4.1 Ingestion

* Run or lease dedicated blockchain nodes (Ethereum, Polygon, etc.).
* Fetch via **JSON-RPC, WebSocket subscriptions**.
* Implement **backfill jobs** (historical data) + **real-time stream ingestion**.
* Maintain registries of protocol addresses and ABIs for decoding.

### 4.2 Processing

* Decode raw logs/events using ABIs.
* Normalize into canonical schemas (balances, txs, swaps, NFTs, approvals).
* Handle **reorgs**: track block hashes, confirmations, canonical flags.
* Enrich with token metadata, pricing, and protocol context.

### 4.3 Storage

* **Raw layer**: Parquet files in object storage (S3/GCS).
* **Hot queries**: ClickHouse for analytics, partitioned by chain + time.
* **Metadata**: Postgres for tokens, protocols, collections.

### 4.4 APIs & Access

* Internal **GraphQL/REST** APIs for wallet app, dashboards, and partners.
* **Webhooks** for real-time events (approvals, transfers, liquidations).
* SDKs in TypeScript & Python.

### 4.5 Monitoring & Quality

* Freshness SLAs: ingestion lag < X minutes.
* Data completeness checks vs on-chain block explorers.
* Reconciliation jobs for balances & positions.
* Dashboards for ingestion lag, error rates, reorg frequency.

---

## 5. Non-Functional Requirements

* **Reliability**: 99.9% uptime.
* **Scalability**: Handle >100M transactions/day.
* **Security**: Never store private keys, only public on-chain data.
* **Compliance**: GDPR-ready (address redaction, audit logs).
* **Extensibility**: Chain/protocol adapters must be plug-and-play.

---

## 6. Integration Points

* **Wallet App**: Display balances, history, NFTs, approvals.
* **Analytics Dashboards**: User KPIs, liquidity flows, portfolio metrics.
* **DeFi Risk Module**: Positions, liquidations, health factors.
* **Partner APIs**: Monetized access to selected datasets.

---

## 7. Data Integrity & Quality Controls

* Canonical block tracking and reorg handling.
* Deduplication logic for txs/logs.
* Schema validation & strict typing.
* Multi-source price validation (Chainlink on-chain + off-chain aggregator).
* Periodic metadata refresh (NFTs, tokens).

---

## 8. Roadmap (Phased Delivery)

**Phase 1 (MVP)**

* Ethereum & Polygon ingestion.
* Balances (native, ERC-20).
* Transactions & receipts.
* Token metadata.
* Price feeds (Chainlink + fallback API).

**Phase 2**

* Approvals & allowances.
* NFT activity.
* DEX swaps (Uniswap, SushiSwap).
* Liquidity positions.

**Phase 3**

* DeFi protocols (Aave, Compound).
* Bridges (Polygon Bridge, Wormhole).
* Expand to BSC, Arbitrum.

**Phase 4**

* Solana, Cosmos, Bitcoin integrations.
* Advanced analytics (PnL, behavioral metrics).
* External API monetization.

---

## 9. Success Metrics

* Ingestion lag < 5 minutes (95th percentile).
* Completeness > 99% vs explorers.
* 99.9% uptime.
* Adoption by 3+ internal products.
* API adoption by external partners.

---

## 10. Risks & Mitigation

* **Node instability** → Multiple node providers + failover.
* **High complexity** → Build modular adapters + shared decoding libraries.
* **Data volume** → Partitioning, tiered storage, pre-computed marts.
* **Protocol changes** → Maintain ABI registries, automated contract monitoring.
* **Security** → API auth, rate limits, WAF, continuous monitoring.

---

✅ This full-control PRD ensures the Wallet Data Platform becomes the **backbone of in-house blockchain data aggregation**, with maximum reliability, flexibility, and ownership of data.
