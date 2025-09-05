# EPIC-001: PoC Foundation - Blockchain Data Processing

## Overview

**Goal**: Create a proof-of-concept blockchain data processing system using only free resources to demonstrate the feasibility of building a DeFi data platform.

**Duration**: 2-3 weeks  
**Complexity**: Low  
**Phase**: PoC  

## Business Value

- **Prove Concept**: Demonstrate that we can build a functional blockchain data processing system
- **Client Demonstration**: Show working prototype to potential clients
- **Technical Validation**: Validate the technical approach and architecture
- **Cost Validation**: Prove the system can work with minimal resources

## Epic Scope

### In Scope
- Basic blockchain data ingestion from free RPC endpoints
- Simple event decoding for ERC-20 transfers
- Data storage in free-tier databases
- Basic API to query processed data
- Docker-based development environment
- Documentation and setup guides

### Out of Scope
- Production-grade performance
- Multi-chain support
- Advanced DeFi analytics
- Real-time processing
- Complex reorg handling
- Message queues (Kafka/Redis) - deferred to Epic 002

## Architecture Overview

### High-Level System Architecture

```mermaid
graph TB
    subgraph "Data Sources"
        RPC1[Infura RPC<br/>Free Tier]
        RPC2[Alchemy RPC<br/>Free Tier]
        RPC3[Public RPC<br/>Endpoints]
    end
    
    subgraph "Data Processing Layer"
        BF[Blockchain<br/>Fetcher]
        ED[Event<br/>Decoder]
        PP[Processing<br/>Pipeline]
        TME[Token Metadata<br/>Enricher]
    end
    
    subgraph "Storage Layer"
        PG[(PostgreSQL<br/>Database)]
        FS[File System<br/>Logs]
    end
    
    subgraph "API Layer"
        API[REST API<br/>Express.js]
        DOCS[API<br/>Documentation]
    end
    
    subgraph "Client Applications"
        WEB[Web Interface]
        CLI[CLI Tools]
        EXT[External<br/>Applications]
    end
    
    RPC1 --> BF
    RPC2 --> BF
    RPC3 --> BF
    
    BF --> PP
    ED --> PP
    PP --> TME
    
    PP --> PG
    PP --> FS
    TME --> PG
    
    PG --> API
    API --> DOCS
    
    API --> WEB
    API --> CLI
    API --> EXT
    
    classDef dataSource fill:#e1f5fe
    classDef processing fill:#f3e5f5
    classDef storage fill:#e8f5e8
    classDef api fill:#fff3e0
    classDef client fill:#fce4ec
    
    class RPC1,RPC2,RPC3 dataSource
    class BF,ED,PP,TME processing
    class PG,FS storage
    class API,DOCS api
    class WEB,CLI,EXT client
```

### Data Flow Architecture

```mermaid
sequenceDiagram
    participant RPC as RPC Endpoint
    participant BF as Blockchain Fetcher
    participant PP as Processing Pipeline
    participant ED as Event Decoder
    participant TME as Token Enricher
    participant DB as PostgreSQL
    participant API as REST API
    participant Client as Client App
    
    Note over RPC,Client: Block Processing Flow
    
    BF->>RPC: Get latest block
    RPC->>BF: Block data + transactions
    
    BF->>PP: Raw block & transactions
    PP->>DB: Store block data
    
    loop For each transaction
        PP->>ED: Transaction logs
        ED->>ED: Decode ERC-20 events
        ED->>PP: Transfer events
        
        alt New token found
            PP->>TME: Token address
            TME->>RPC: Get token metadata
            RPC->>TME: Name, symbol, decimals
            TME->>DB: Store token metadata
        end
        
        PP->>DB: Store transfer events
    end
    
    Note over Client,API: API Query Flow
    
    Client->>API: GET /api/transfers/{address}
    API->>DB: Query transfers
    DB->>API: Transfer data + token metadata
    API->>Client: JSON response
```

### Component Architecture

```mermaid
graph LR
    subgraph "Core Components"
        subgraph "Ingestion"
            BF[BlockchainFetcher<br/>• RPC connection<br/>• Block fetching<br/>• Rate limiting]
        end
        
        subgraph "Processing"
            ED[EventDecoder<br/>• ABI parsing<br/>• Log decoding<br/>• Event extraction]
            PP[ProcessingPipeline<br/>• Orchestration<br/>• Error handling<br/>• Batch processing]
        end
        
        subgraph "Enrichment"
            TME[TokenMetadataEnricher<br/>• Contract calls<br/>• Metadata caching<br/>• Fallback handling]
        end
        
        subgraph "Storage"
            DM[DatabaseManager<br/>• Prisma ORM<br/>• Migrations<br/>• Transactions]
        end
        
        subgraph "API"
            RS[RESTServer<br/>• Express.js<br/>• Routing<br/>• Validation]
            QE[QueryEngine<br/>• Pagination<br/>• Filtering<br/>• Sorting]
        end
    end
    
    subgraph "Data Models"
        Block[Block Model<br/>• number, hash<br/>• timestamp<br/>• gas info]
        Transaction[Transaction Model<br/>• hash, from, to<br/>• value, gas<br/>• status]
        Event[Event Model<br/>• contract<br/>• event name<br/>• decoded args]
        Token[Token Model<br/>• address<br/>• metadata<br/>• transfers]
        Transfer[Transfer Model<br/>• from, to<br/>• amount<br/>• token reference]
    end
    
    BF --> PP
    ED --> PP
    PP --> TME
    PP --> DM
    TME --> DM
    DM --> QE
    QE --> RS
    
    DM --> Block
    DM --> Transaction
    DM --> Event
    DM --> Token
    DM --> Transfer
    
    classDef component fill:#e3f2fd
    classDef model fill:#f1f8e9
    
    class BF,ED,PP,TME,DM,RS,QE component
    class Block,Transaction,Event,Token,Transfer model
```

### Database Schema Diagram

```mermaid
erDiagram
    Block {
        int id PK
        bigint number UK
        string hash UK
        datetime timestamp
        string parentHash
        bigint gasUsed
        bigint gasLimit
        datetime createdAt
    }
    
    Transaction {
        int id PK
        string hash UK
        bigint blockNumber FK
        string from
        string to
        string value
        bigint gasUsed
        string gasPrice
        int status
        datetime createdAt
    }
    
    Event {
        int id PK
        string txHash FK
        int logIndex
        string contract
        string eventName
        json args
        datetime createdAt
    }
    
    Token {
        int id PK
        string address UK
        string name
        string symbol
        int decimals
        string totalSupply
        datetime createdAt
        datetime updatedAt
    }
    
    Transfer {
        int id PK
        string txHash
        string from
        string to
        string amount
        int tokenId FK
        datetime createdAt
    }
    
    Block ||--o{ Transaction : "contains"
    Transaction ||--o{ Event : "generates"
    Token ||--o{ Transfer : "has"
    Transaction ||--o{ Transfer : "creates"
```

## Technical Requirements

### Free Resources to Use
- **Ethereum RPC**: Public endpoints (Infura free tier, Alchemy free tier, public nodes)
- **Database**: PostgreSQL (local Docker), SQLite (for simple cases)
- **Storage**: Local filesystem, Docker volumes
- **Development**: Docker, Node.js, TypeScript
- **Monitoring**: Basic logging, simple metrics

### Tech Stack
```typescript
// Core Technologies
- Node.js + TypeScript
- ethers.js for blockchain interaction
- PostgreSQL for data storage
- Docker for containerization
- Express.js for API
- Prisma for database ORM
```

## User Stories

### US-001: Environment Setup
**As a** developer  
**I want** a complete development environment  
**So that** I can start building the PoC immediately  

**Acceptance Criteria:**
- [ ] Docker Compose setup with all services
- [ ] Database schema created and migrated
- [ ] Basic API server running
- [ ] Connection to Ethereum testnet verified
- [ ] Development documentation complete

### US-002: Basic Data Ingestion
**As a** system  
**I want** to fetch blockchain data from free RPC endpoints  
**So that** I can process real blockchain events  

**Acceptance Criteria:**
- [ ] Connect to Ethereum mainnet via free RPC
- [ ] Fetch latest blocks and transactions
- [ ] Store raw block data in database
- [ ] Handle RPC rate limits gracefully
- [ ] Log all operations for debugging

### US-003: Event Decoding
**As a** system  
**I want** to decode ERC-20 Transfer events  
**So that** I can extract structured data from raw logs  

**Acceptance Criteria:**
- [ ] Decode ERC-20 Transfer events
- [ ] Extract from, to, amount from event data
- [ ] Store decoded events in normalized format
- [ ] Handle missing ABIs gracefully
- [ ] Support at least 3 popular ERC-20 tokens

### US-004: Data API
**As a** client application  
**I want** to query processed blockchain data  
**So that** I can build applications on top of the data  

**Acceptance Criteria:**
- [ ] REST API with basic endpoints
- [ ] Query transfers by wallet address
- [ ] Query transfers by token contract
- [ ] Pagination support
- [ ] Basic error handling

### US-005: Token Metadata
**As a** system  
**I want** to enrich token data with metadata  
**So that** I can provide human-readable information  

**Acceptance Criteria:**
- [ ] Fetch token name, symbol, decimals
- [ ] Store token metadata in database
- [ ] Cache metadata to avoid repeated calls
- [ ] Handle failed metadata fetches gracefully
- [ ] Support at least 10 popular tokens

## Implementation Plan

### Week 1: Foundation Setup
**Day 1-2: Environment Setup**
```bash
# Project structure
mkdir blockchain-poc
cd blockchain-poc
npm init -y
npm install typescript @types/node ts-node nodemon
npm install ethers prisma @prisma/client
npm install express @types/express cors dotenv
npm install -D @types/cors

# Docker setup
docker-compose up -d postgres
npx prisma init
npx prisma migrate dev --name init
```

**Day 3-4: Basic Ingestion**
```typescript
// src/ingestion/blockchain-fetcher.ts
import { ethers } from 'ethers';

class BlockchainFetcher {
  private provider: ethers.Provider;
  
  constructor(rpcUrl: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }
  
  async getLatestBlock(): Promise<ethers.Block> {
    return await this.provider.getBlock('latest', true);
  }
  
  async getBlockTransactions(blockNumber: number): Promise<ethers.TransactionResponse[]> {
    const block = await this.provider.getBlock(blockNumber, true);
    return block?.transactions || [];
  }
}
```

**Day 5: Database Schema**
```sql
-- prisma/schema.prisma
model Block {
  id          Int      @id @default(autoincrement())
  number      BigInt   @unique
  hash        String   @unique
  timestamp   DateTime
  parentHash  String
  gasUsed     BigInt
  gasLimit    BigInt
  createdAt   DateTime @default(now())
  
  transactions Transaction[]
}

model Transaction {
  id          Int      @id @default(autoincrement())
  hash        String   @unique
  blockNumber BigInt
  from        String
  to          String?
  value       String
  gasUsed     BigInt
  gasPrice    String
  status      Int
  createdAt   DateTime @default(now())
  
  block       Block    @relation(fields: [blockNumber], references: [number])
  events      Event[]
}

model Event {
  id            Int      @id @default(autoincrement())
  txHash        String
  logIndex      Int
  contract      String
  eventName     String
  args          Json
  createdAt     DateTime @default(now())
  
  transaction   Transaction @relation(fields: [txHash], references: [hash])
  
  @@unique([txHash, logIndex])
}

model Token {
  id          Int      @id @default(autoincrement())
  address     String   @unique
  name        String?
  symbol      String?
  decimals    Int?
  totalSupply String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  transfers   Transfer[]
}

model Transfer {
  id        Int      @id @default(autoincrement())
  txHash    String
  from      String
  to        String
  amount    String
  tokenId   Int
  createdAt DateTime @default(now())
  
  token     Token    @relation(fields: [tokenId], references: [id])
}
```

### Week 2: Core Processing
**Day 1-2: Event Decoding**
```typescript
// src/processing/event-decoder.ts
import { ethers } from 'ethers';

class EventDecoder {
  private erc20Abi = [
    "event Transfer(address indexed from, address indexed to, uint256 value)"
  ];
  
  decodeTransferEvent(log: ethers.Log): TransferEvent | null {
    try {
      const iface = new ethers.Interface(this.erc20Abi);
      const decoded = iface.parseLog(log);
      
      if (decoded?.name === 'Transfer') {
        return {
          from: decoded.args.from,
          to: decoded.args.to,
          amount: decoded.args.value.toString(),
          contract: log.address
        };
      }
    } catch (error) {
      console.error('Failed to decode transfer event:', error);
    }
    
    return null;
  }
}
```

**Day 3-4: Data Processing Pipeline**
```typescript
// src/processing/pipeline.ts
class ProcessingPipeline {
  private fetcher: BlockchainFetcher;
  private decoder: EventDecoder;
  private db: PrismaClient;
  
  async processLatestBlocks(count: number = 10): Promise<void> {
    const latestBlock = await this.fetcher.getLatestBlock();
    
    for (let i = 0; i < count; i++) {
      const blockNumber = latestBlock.number - BigInt(i);
      await this.processBlock(blockNumber);
    }
  }
  
  private async processBlock(blockNumber: bigint): Promise<void> {
    // Fetch block data
    const block = await this.fetcher.getBlock(blockNumber);
    const transactions = await this.fetcher.getBlockTransactions(Number(blockNumber));
    
    // Store block
    await this.db.block.upsert({
      where: { number: blockNumber },
      update: {},
      create: {
        number: blockNumber,
        hash: block.hash,
        timestamp: new Date(block.timestamp * 1000),
        parentHash: block.parentHash,
        gasUsed: block.gasUsed,
        gasLimit: block.gasLimit
      }
    });
    
    // Process transactions
    for (const tx of transactions) {
      await this.processTransaction(tx);
    }
  }
}
```

**Day 5: Basic API**
```typescript
// src/api/server.ts
import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
const db = new PrismaClient();

app.get('/api/transfers/:address', async (req, res) => {
  const { address } = req.params;
  const { page = 1, limit = 10 } = req.query;
  
  const transfers = await db.transfer.findMany({
    where: {
      OR: [
        { from: address },
        { to: address }
      ]
    },
    include: {
      token: true
    },
    skip: (Number(page) - 1) * Number(limit),
    take: Number(limit),
    orderBy: { createdAt: 'desc' }
  });
  
  res.json(transfers);
});

app.get('/api/tokens', async (req, res) => {
  const tokens = await db.token.findMany({
    orderBy: { createdAt: 'desc' }
  });
  
  res.json(tokens);
});

app.listen(3000, () => {
  console.log('API server running on port 3000');
});
```

### Week 3: Enhancement & Testing
**Day 1-2: Token Metadata Enrichment**
```typescript
// src/enrichment/token-metadata.ts
class TokenMetadataEnricher {
  private provider: ethers.Provider;
  
  async enrichToken(address: string): Promise<TokenMetadata> {
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
        address,
        name,
        symbol,
        decimals,
        totalSupply: totalSupply.toString()
      };
    } catch (error) {
      console.error(`Failed to fetch metadata for token ${address}:`, error);
      return {
        address,
        name: 'Unknown',
        symbol: 'UNK',
        decimals: 18,
        totalSupply: '0'
      };
    }
  }
}
```

**Day 3-4: Testing & Validation**
```typescript
// tests/integration.test.ts
import { describe, it, expect } from '@jest/globals';

describe('Blockchain Data Processing PoC', () => {
  it('should fetch and store blocks', async () => {
    const fetcher = new BlockchainFetcher(process.env.ETH_RPC_URL!);
    const block = await fetcher.getLatestBlock();
    
    expect(block).toBeDefined();
    expect(block.number).toBeGreaterThan(0);
  });
  
  it('should decode ERC-20 transfer events', async () => {
    const decoder = new EventDecoder();
    const mockLog = {
      address: '0xA0b86a33E6441c8C4C4C4C4C4C4C4C4C4C4C4C4C',
      topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'],
      data: '0x0000000000000000000000000000000000000000000000000000000000000001'
    };
    
    const decoded = decoder.decodeTransferEvent(mockLog);
    expect(decoded).toBeDefined();
    expect(decoded?.amount).toBe('1');
  });
  
  it('should provide API endpoints', async () => {
    const response = await fetch('http://localhost:3000/api/tokens');
    expect(response.status).toBe(200);
    
    const tokens = await response.json();
    expect(Array.isArray(tokens)).toBe(true);
  });
});
```

**Day 5: Documentation & Demo**
- Complete setup documentation
- Create demo script
- Prepare client presentation
- Document lessons learned

## Free Resources Configuration

### Ethereum RPC Endpoints
```typescript
// config/rpc-endpoints.ts
export const RPC_ENDPOINTS = {
  // Free tier limits: 100k requests/day
  infura: 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
  
  // Free tier limits: 300M requests/month
  alchemy: 'https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
  
  // Public endpoints (unreliable but free)
  public: [
    'https://cloudflare-eth.com',
    'https://rpc.ankr.com/eth',
    'https://ethereum.publicnode.com'
  ]
};
```

### Database Setup
```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: blockchain_poc
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Environment Variables
```bash
# .env
DATABASE_URL="postgresql://postgres:password@localhost:5432/blockchain_poc"
ETH_RPC_URL="https://mainnet.infura.io/v3/YOUR_PROJECT_ID"
API_PORT=3000
LOG_LEVEL=info
```

## Acceptance Criteria

### Functional Requirements
- [ ] **Data Ingestion**: Successfully fetch blocks from Ethereum mainnet
- [ ] **Event Decoding**: Decode ERC-20 Transfer events correctly
- [ ] **Data Storage**: Store processed data in PostgreSQL
- [ ] **API Endpoints**: Provide REST API for querying data
- [ ] **Token Metadata**: Enrich tokens with name, symbol, decimals
- [ ] **Error Handling**: Gracefully handle RPC failures and missing data

### Non-Functional Requirements
- [ ] **Performance**: Process at least 100 blocks without errors
- [ ] **Reliability**: Handle RPC rate limits and timeouts
- [ ] **Usability**: Complete setup documentation
- [ ] **Maintainability**: Clean, documented code
- [ ] **Testability**: Basic test coverage

### Demo Requirements
- [ ] **Live Demo**: Show real-time data processing
- [ ] **API Demo**: Demonstrate API endpoints with real data
- [ ] **Client Presentation**: 15-minute presentation showing capabilities
- [ ] **Technical Documentation**: Complete setup and architecture docs

## Success Metrics

- **Technical**: Successfully process 1000+ ERC-20 transfers
- **Performance**: Process blocks within 30 seconds of block time
- **Reliability**: 95%+ success rate for data processing
- **Client**: Positive feedback on demo and capabilities
- **Cost**: Total cost under $10 for the entire PoC

## Risk Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| RPC Rate Limits | High | Medium | Use multiple free endpoints, implement backoff |
| Database Performance | Medium | Low | Use simple queries, limit data volume |
| Free Tier Limits | High | Medium | Monitor usage, have backup endpoints |
| Development Time | Medium | Medium | Focus on core features, defer nice-to-haves |

## Dependencies

- **External**: Free RPC endpoints, Docker, Node.js
- **Internal**: Development environment setup
- **Technical**: Database schema design, API design

## Deliverables

1. **Working PoC**: Complete system that processes real blockchain data
2. **Source Code**: Well-documented, tested codebase
3. **Documentation**: Setup guide, architecture overview, API docs
4. **Demo**: Live demonstration for clients
5. **Lessons Learned**: Document what worked and what didn't

## Next Steps

After completing this epic:
1. Gather feedback from demo
2. Identify areas for improvement  
3. Plan Epic 002 (Core Decoding) based on learnings
4. Consider scaling to production resources if PoC is successful

**Note on Architecture Evolution**: This PoC uses direct processing (RPC → Processing → Database) for simplicity. The production architecture described in `processing_layer_architecture.md` introduces message queues (Kafka/Redpanda) for decoupling and scalability, which will be implemented in Epic 002.

---

**Estimated Effort**: 2-3 weeks  
**Team Size**: 1-2 developers  
**Priority**: High (Foundation for all other epics)
