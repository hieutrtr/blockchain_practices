# Story 001: Environment Setup

## Story Information
- **Epic**: EPIC-001: PoC Foundation - Blockchain Data Processing
- **Story ID**: STORY-001
- **Priority**: High
- **Story Points**: 5
- **Sprint**: Week 1, Day 1-2

## User Story

**As a** developer  
**I want** a complete development environment  
**So that** I can start building the PoC immediately  

## Acceptance Criteria

### Functional Requirements
- [ ] **Docker Compose Setup**: Complete Docker Compose configuration with PostgreSQL service
- [ ] **Database Schema**: Prisma schema created and migrated successfully
- [ ] **Basic API Server**: Express.js server running and responding to health checks
- [ ] **Ethereum Connection**: Connection to Ethereum testnet verified and working
- [ ] **Development Documentation**: Complete setup guide with step-by-step instructions

### Technical Requirements
- [ ] **Project Structure**: Proper TypeScript project structure with src/, tests/, docs/ directories
- [ ] **Dependencies**: All required packages installed and configured
- [ ] **Environment Variables**: .env file with all necessary configuration
- [ ] **Database Connection**: PostgreSQL connection established and tested
- [ ] **RPC Endpoint**: At least one working Ethereum RPC endpoint configured

## Implementation Details

### Project Structure
```
blockchain-poc/
├── src/
│   ├── ingestion/
│   ├── processing/
│   ├── api/
│   └── types/
├── tests/
├── docs/
├── prisma/
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── .env
```

### Dependencies to Install
```bash
# Core dependencies
npm install typescript @types/node ts-node nodemon
npm install ethers prisma @prisma/client
npm install express @types/express cors dotenv
npm install -D @types/cors jest @types/jest ts-jest
```

### Docker Configuration
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
NODE_ENV=development
```

### Prisma Schema
```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

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

### Basic API Server
```typescript
// src/api/server.ts
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const app = express();
const db = new PrismaClient();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await db.$queryRaw`SELECT 1`;
    res.json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', database: 'disconnected' });
  }
});

// Basic endpoints
app.get('/api/blocks', async (req, res) => {
  const blocks = await db.block.findMany({
    take: 10,
    orderBy: { number: 'desc' }
  });
  res.json(blocks);
});

app.get('/api/tokens', async (req, res) => {
  const tokens = await db.token.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.json(tokens);
});

const PORT = process.env.API_PORT || 3000;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
```

## Definition of Done

### Code Quality
- [ ] All code follows TypeScript best practices
- [ ] Proper error handling implemented
- [ ] Code is properly documented with JSDoc comments
- [ ] No console.log statements in production code

### Testing
- [ ] Health check endpoint tested
- [ ] Database connection tested
- [ ] RPC endpoint connectivity tested
- [ ] Basic API endpoints return expected responses

### Documentation
- [ ] README.md with setup instructions
- [ ] API documentation for basic endpoints
- [ ] Environment variable documentation
- [ ] Troubleshooting guide for common issues

### Deployment
- [ ] Docker containers start successfully
- [ ] Database migrations run without errors
- [ ] API server starts and responds to requests
- [ ] All environment variables properly configured

## Testing Strategy

### Unit Tests
```typescript
// tests/setup.test.ts
import { describe, it, expect } from '@jest/globals';
import { PrismaClient } from '@prisma/client';

describe('Environment Setup', () => {
  it('should connect to database', async () => {
    const db = new PrismaClient();
    const result = await db.$queryRaw`SELECT 1 as test`;
    expect(result).toBeDefined();
    await db.$disconnect();
  });

  it('should have required environment variables', () => {
    expect(process.env.DATABASE_URL).toBeDefined();
    expect(process.env.ETH_RPC_URL).toBeDefined();
    expect(process.env.API_PORT).toBeDefined();
  });
});
```

### Integration Tests
```typescript
// tests/api.test.ts
import request from 'supertest';
import app from '../src/api/server';

describe('API Endpoints', () => {
  it('should return health status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
  });

  it('should return blocks list', async () => {
    const response = await request(app).get('/api/blocks');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});
```

## Dependencies

### External Dependencies
- Docker and Docker Compose
- Node.js (v18 or higher)
- npm or yarn package manager

### Internal Dependencies
- None (this is the foundation story)

## Risks and Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Docker setup issues | High | Medium | Provide detailed Docker troubleshooting guide |
| Database connection failures | High | Low | Test connection with multiple PostgreSQL versions |
| RPC endpoint unavailability | Medium | Medium | Configure multiple RPC endpoints as fallbacks |
| Environment variable misconfiguration | Medium | Low | Provide .env.example file with all required variables |

## Notes

- This story establishes the foundation for all subsequent development
- Focus on simplicity and reliability over advanced features
- Ensure all team members can successfully set up the environment
- Document any platform-specific setup requirements (Windows, macOS, Linux)

## Related Stories
- STORY-002: Basic Data Ingestion
- STORY-003: Event Decoding
- STORY-004: Data API
- STORY-005: Token Metadata
