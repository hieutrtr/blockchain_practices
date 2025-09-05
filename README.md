# Blockchain Practices Knowledge Base

A curated, developer-focused knowledge base for building an in-house blockchain data platform. Use this README to navigate core concepts, PRDs, architectures, specifications, and implementation epics.

## Quick Start

- New here? Start with Concepts to ground terminology and mental models.
- Evaluating feasibility? Read the PRDs, then the Architecture docs.
- Building a PoC? Jump straight to Processing Epics (Epic-001).

## Contents

### Concepts & Orientation
- [docs/concepts.md](docs/concepts.md) — Developer guide to chains, wallets, DEXs, pools, bridges.
- [docs/wallet_data_specs.md](docs/wallet_data_specs.md) — Comprehensive wallet data types, sources, and implementation patterns.

### Product Requirements
- [docs/prd_data_platform.md](docs/prd_data_platform.md) — Full-control wallet data platform PRD (end-to-end vision).
- [docs/processing_layer_prd.md](docs/processing_layer_prd.md) — Processing layer PRD (decode, normalize, enrich, integrity).

### Architectures
- [docs/ingestion_layer_architecture.md](docs/ingestion_layer_architecture.md) — Ingestion architecture (nodes, listeners, queues, bronze → gold).
- [docs/processing_layer_architecture.md](docs/processing_layer_architecture.md) — Processing layer architecture with tech stack rationale.

### Specifications (Decision-Oriented)
- [docs/ingestion_layer_spec.md](docs/ingestion_layer_spec.md) — Decision-oriented ingestion spec: run vs lease, fetch patterns, SLOs.
- [docs/event_data_spec.md](docs/event_data_spec.md) — Event speed/scale proofs, storage math, and implementation patterns.

### Delivery Plan (Epics)
- [docs/processing_epics/README.md](docs/processing_epics/README.md) — Epic index and phase plan.
  - [EPIC-001: PoC Foundation](docs/processing_epics/epic-001-poc-foundation.md) — Free-tier PoC from scratch; end-to-end demo.
  - [EPIC-002: Core Decoding](docs/processing_epics/epic-002-core-decoding.md) — ABI registry, batch decoding, normalization, retries.
  - [EPIC-003: Data Enrichment](docs/processing_epics/epic-003-data-enrichment.md) — Token/NFT metadata, pricing, protocol labeling.
  - [EPIC-004: DeFi Analytics](docs/processing_epics/epic-004-defi-analytics.md) — Swaps, approvals, NFT activity, LP analytics.
  - [EPIC-005: Reorg Management](docs/processing_epics/epic-005-reorg-management.md) — Canonical flags, rollback/recovery, monitoring.

## How to Use This Repo

- Prototype: Follow EPIC-001 step-by-step to get a working PoC with free resources.
- Scale: Read ingestion/processing architecture and specs; progress through Epics 002–005.
- Decide: Use decision sections (SLOs, trade-offs, CAP notes) to justify vendor/infra choices.

## Key Design Principles

- Consistency-first system of record (Postgres) with CP trade-offs; AP-friendly analytics (ClickHouse, Parquet).
- Layered storage: Bronze (object store/Parquet) → Silver/Gold (ClickHouse) with canonical flips.
- Idempotency and reorg safety on every row; versioned ABIs and protocol registries.
- Start simple; optimize with Kafka/Redpanda, Rust/Go workers as throughput grows.

## Useful Entry Points

- Event throughput and storage sizing math: [docs/event_data_spec.md](docs/event_data_spec.md)
- Ingestion run-vs-lease decisions: [docs/ingestion_layer_spec.md](docs/ingestion_layer_spec.md)
- Processing tech stack rationale: [docs/processing_layer_architecture.md](docs/processing_layer_architecture.md)

## License

This repository is a knowledge base for internal and client-facing proposals and PoCs. Add a license here if distributing externally.
