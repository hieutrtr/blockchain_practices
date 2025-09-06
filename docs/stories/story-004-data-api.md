# Story 004: Data API

## Story Information
- **Epic**: EPIC-001: PoC Foundation - Blockchain Data Processing
- **Story ID**: STORY-004
- **Priority**: High
- **Story Points**: 5
- **Sprint**: Week 2, Day 5

## User Story

**As a** client application  
**I want** to query processed blockchain data  
**So that** I can build applications on top of the data  

## Acceptance Criteria

### Functional Requirements
- [ ] **REST API**: Provide REST API with basic endpoints
- [ ] **Transfer Queries**: Query transfers by wallet address
- [ ] **Token Queries**: Query transfers by token contract
- [ ] **Pagination**: Support pagination for large result sets
- [ ] **Error Handling**: Provide proper error responses and status codes

### Technical Requirements
- [ ] **Express.js Server**: Implement robust API server with Express.js
- [ ] **Input Validation**: Validate all input parameters
- [ ] **Response Formatting**: Consistent JSON response format
- [ ] **Performance**: Handle queries efficiently with proper indexing
- [ ] **Documentation**: API documentation with examples

## Implementation Details

### API Server Implementation
```typescript
// src/api/server.ts
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const app = express();
const db = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// Validation schemas
const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');
const paginationSchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('10')
});

// Response helpers
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function createResponse<T>(data: T, pagination?: any): ApiResponse<T> {
  return {
    success: true,
    data,
    ...(pagination && { pagination })
  };
}

function createErrorResponse(error: string): ApiResponse<null> {
  return {
    success: false,
    error
  };
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await db.$queryRaw`SELECT 1`;
    res.json(createResponse({ status: 'healthy', database: 'connected' }));
  } catch (error) {
    res.status(500).json(createErrorResponse('Database connection failed'));
  }
});

// Get transfers by wallet address
app.get('/api/transfers/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { page, limit } = paginationSchema.parse(req.query);
    
    // Validate address
    const validatedAddress = addressSchema.parse(address);
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get transfers
    const [transfers, total] = await Promise.all([
      db.transfer.findMany({
        where: {
          OR: [
            { from: validatedAddress },
            { to: validatedAddress }
          ]
        },
        include: {
          token: true
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      db.transfer.count({
        where: {
          OR: [
            { from: validatedAddress },
            { to: validatedAddress }
          ]
        }
      })
    ]);
    
    const totalPages = Math.ceil(total / limit);
    
    res.json(createResponse(transfers, {
      page,
      limit,
      total,
      totalPages
    }));
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json(createErrorResponse('Invalid input parameters'));
    } else {
      console.error('Error fetching transfers:', error);
      res.status(500).json(createErrorResponse('Internal server error'));
    }
  }
});

// Get transfers by token contract
app.get('/api/tokens/:address/transfers', async (req, res) => {
  try {
    const { address } = req.params;
    const { page, limit } = paginationSchema.parse(req.query);
    
    // Validate address
    const validatedAddress = addressSchema.parse(address);
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get token first
    const token = await db.token.findUnique({
      where: { address: validatedAddress }
    });
    
    if (!token) {
      res.status(404).json(createErrorResponse('Token not found'));
      return;
    }
    
    // Get transfers
    const [transfers, total] = await Promise.all([
      db.transfer.findMany({
        where: { tokenId: token.id },
        include: {
          token: true
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      db.transfer.count({
        where: { tokenId: token.id }
      })
    ]);
    
    const totalPages = Math.ceil(total / limit);
    
    res.json(createResponse(transfers, {
      page,
      limit,
      total,
      totalPages
    }));
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json(createErrorResponse('Invalid input parameters'));
    } else {
      console.error('Error fetching token transfers:', error);
      res.status(500).json(createErrorResponse('Internal server error'));
    }
  }
});

// Get all tokens
app.get('/api/tokens', async (req, res) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get tokens with transfer counts
    const [tokens, total] = await Promise.all([
      db.token.findMany({
        include: {
          _count: {
            select: { transfers: true }
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      db.token.count()
    ]);
    
    const totalPages = Math.ceil(total / limit);
    
    res.json(createResponse(tokens, {
      page,
      limit,
      total,
      totalPages
    }));
    
  } catch (error) {
    console.error('Error fetching tokens:', error);
    res.status(500).json(createErrorResponse('Internal server error'));
  }
});

// Get token details
app.get('/api/tokens/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    // Validate address
    const validatedAddress = addressSchema.parse(address);
    
    // Get token with transfer count
    const token = await db.token.findUnique({
      where: { address: validatedAddress },
      include: {
        _count: {
          select: { transfers: true }
        }
      }
    });
    
    if (!token) {
      res.status(404).json(createErrorResponse('Token not found'));
      return;
    }
    
    res.json(createResponse(token));
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json(createErrorResponse('Invalid address format'));
    } else {
      console.error('Error fetching token:', error);
      res.status(500).json(createErrorResponse('Internal server error'));
    }
  }
});

// Get blocks
app.get('/api/blocks', async (req, res) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get blocks with transaction counts
    const [blocks, total] = await Promise.all([
      db.block.findMany({
        include: {
          _count: {
            select: { transactions: true }
          }
        },
        skip,
        take: limit,
        orderBy: { number: 'desc' }
      }),
      db.block.count()
    ]);
    
    const totalPages = Math.ceil(total / limit);
    
    res.json(createResponse(blocks, {
      page,
      limit,
      total,
      totalPages
    }));
    
  } catch (error) {
    console.error('Error fetching blocks:', error);
    res.status(500).json(createErrorResponse('Internal server error'));
  }
});

// Get block details
app.get('/api/blocks/:number', async (req, res) => {
  try {
    const { number } = req.params;
    const blockNumber = parseInt(number);
    
    if (isNaN(blockNumber)) {
      res.status(400).json(createErrorResponse('Invalid block number'));
      return;
    }
    
    // Get block with transactions
    const block = await db.block.findUnique({
      where: { number: BigInt(blockNumber) },
      include: {
        transactions: {
          include: {
            events: true
          }
        }
      }
    });
    
    if (!block) {
      res.status(404).json(createErrorResponse('Block not found'));
      return;
    }
    
    res.json(createResponse(block));
    
  } catch (error) {
    console.error('Error fetching block:', error);
    res.status(500).json(createErrorResponse('Internal server error'));
  }
});

// Get transaction details
app.get('/api/transactions/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    
    // Validate hash
    if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
      res.status(400).json(createErrorResponse('Invalid transaction hash'));
      return;
    }
    
    // Get transaction with events
    const transaction = await db.transaction.findUnique({
      where: { hash },
      include: {
        block: true,
        events: true
      }
    });
    
    if (!transaction) {
      res.status(404).json(createErrorResponse('Transaction not found'));
      return;
    }
    
    res.json(createResponse(transaction));
    
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json(createErrorResponse('Internal server error'));
  }
});

// Get API statistics
app.get('/api/stats', async (req, res) => {
  try {
    const [blockCount, transactionCount, eventCount, transferCount, tokenCount] = await Promise.all([
      db.block.count(),
      db.transaction.count(),
      db.event.count(),
      db.transfer.count(),
      db.token.count()
    ]);
    
    res.json(createResponse({
      blocks: blockCount,
      transactions: transactionCount,
      events: eventCount,
      transfers: transferCount,
      tokens: tokenCount
    }));
    
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json(createErrorResponse('Internal server error'));
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json(createErrorResponse('Internal server error'));
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json(createErrorResponse('Endpoint not found'));
});

const PORT = process.env.API_PORT || 3000;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

export default app;
```

### API Documentation
```typescript
// src/api/docs.ts
export const API_DOCS = {
  title: 'Blockchain Data API',
  version: '1.0.0',
  description: 'REST API for querying processed blockchain data',
  baseUrl: 'http://localhost:3000',
  endpoints: [
    {
      method: 'GET',
      path: '/health',
      description: 'Health check endpoint',
      response: {
        success: true,
        data: {
          status: 'healthy',
          database: 'connected'
        }
      }
    },
    {
      method: 'GET',
      path: '/api/transfers/:address',
      description: 'Get transfers for a wallet address',
      parameters: {
        address: 'Ethereum wallet address (0x...)',
        page: 'Page number (default: 1)',
        limit: 'Items per page (default: 10)'
      },
      response: {
        success: true,
        data: [
          {
            id: 1,
            txHash: '0x...',
            from: '0x...',
            to: '0x...',
            amount: '1000000',
            token: {
              address: '0x...',
              name: 'USDT',
              symbol: 'USDT',
              decimals: 6
            },
            createdAt: '2024-01-01T00:00:00Z'
          }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 100,
          totalPages: 10
        }
      }
    },
    {
      method: 'GET',
      path: '/api/tokens',
      description: 'Get all tokens',
      parameters: {
        page: 'Page number (default: 1)',
        limit: 'Items per page (default: 10)'
      },
      response: {
        success: true,
        data: [
          {
            id: 1,
            address: '0x...',
            name: 'USDT',
            symbol: 'USDT',
            decimals: 6,
            totalSupply: '1000000000',
            _count: {
              transfers: 1000
            }
          }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 50,
          totalPages: 5
        }
      }
    },
    {
      method: 'GET',
      path: '/api/tokens/:address',
      description: 'Get token details',
      parameters: {
        address: 'Token contract address (0x...)'
      },
      response: {
        success: true,
        data: {
          id: 1,
          address: '0x...',
          name: 'USDT',
          symbol: 'USDT',
          decimals: 6,
          totalSupply: '1000000000',
          _count: {
            transfers: 1000
          }
        }
      }
    },
    {
      method: 'GET',
      path: '/api/tokens/:address/transfers',
      description: 'Get transfers for a specific token',
      parameters: {
        address: 'Token contract address (0x...)',
        page: 'Page number (default: 1)',
        limit: 'Items per page (default: 10)'
      },
      response: {
        success: true,
        data: [
          {
            id: 1,
            txHash: '0x...',
            from: '0x...',
            to: '0x...',
            amount: '1000000',
            token: {
              address: '0x...',
              name: 'USDT',
              symbol: 'USDT',
              decimals: 6
            }
          }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1000,
          totalPages: 100
        }
      }
    },
    {
      method: 'GET',
      path: '/api/blocks',
      description: 'Get all blocks',
      parameters: {
        page: 'Page number (default: 1)',
        limit: 'Items per page (default: 10)'
      },
      response: {
        success: true,
        data: [
          {
            id: 1,
            number: 12345,
            hash: '0x...',
            timestamp: '2024-01-01T00:00:00Z',
            gasUsed: 1000000,
            gasLimit: 2000000,
            _count: {
              transactions: 100
            }
          }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1000,
          totalPages: 100
        }
      }
    },
    {
      method: 'GET',
      path: '/api/blocks/:number',
      description: 'Get block details',
      parameters: {
        number: 'Block number'
      },
      response: {
        success: true,
        data: {
          id: 1,
          number: 12345,
          hash: '0x...',
          timestamp: '2024-01-01T00:00:00Z',
          gasUsed: 1000000,
          gasLimit: 2000000,
          transactions: [
            {
              id: 1,
              hash: '0x...',
              from: '0x...',
              to: '0x...',
              value: '1000000000000000000',
              gasUsed: 21000,
              gasPrice: '20000000000',
              status: 1,
              events: []
            }
          ]
        }
      }
    },
    {
      method: 'GET',
      path: '/api/transactions/:hash',
      description: 'Get transaction details',
      parameters: {
        hash: 'Transaction hash (0x...)'
      },
      response: {
        success: true,
        data: {
          id: 1,
          hash: '0x...',
          blockNumber: 12345,
          from: '0x...',
          to: '0x...',
          value: '1000000000000000000',
          gasUsed: 21000,
          gasPrice: '20000000000',
          status: 1,
          block: {
            number: 12345,
            hash: '0x...',
            timestamp: '2024-01-01T00:00:00Z'
          },
          events: [
            {
              id: 1,
              logIndex: 0,
              contract: '0x...',
              eventName: 'Transfer',
              args: {
                from: '0x...',
                to: '0x...',
                value: '1000000'
              }
            }
          ]
        }
      }
    },
    {
      method: 'GET',
      path: '/api/stats',
      description: 'Get API statistics',
      response: {
        success: true,
        data: {
          blocks: 1000,
          transactions: 10000,
          events: 50000,
          transfers: 25000,
          tokens: 50
        }
      }
    }
  ]
};
```

### CLI Command for Testing
```typescript
// src/cli/test-api.ts
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000';

async function testAPI() {
  console.log('Testing Blockchain Data API...\n');
  
  try {
    // Test health check
    console.log('1. Testing health check...');
    const healthResponse = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ Health check:', healthResponse.data);
    
    // Test stats
    console.log('\n2. Testing stats endpoint...');
    const statsResponse = await axios.get(`${API_BASE_URL}/api/stats`);
    console.log('✅ Stats:', statsResponse.data);
    
    // Test tokens
    console.log('\n3. Testing tokens endpoint...');
    const tokensResponse = await axios.get(`${API_BASE_URL}/api/tokens`);
    console.log('✅ Tokens:', tokensResponse.data);
    
    // Test blocks
    console.log('\n4. Testing blocks endpoint...');
    const blocksResponse = await axios.get(`${API_BASE_URL}/api/blocks`);
    console.log('✅ Blocks:', blocksResponse.data);
    
    // Test transfers (if any exist)
    if (tokensResponse.data.data && tokensResponse.data.data.length > 0) {
      const tokenAddress = tokensResponse.data.data[0].address;
      console.log(`\n5. Testing transfers for token ${tokenAddress}...`);
      const transfersResponse = await axios.get(`${API_BASE_URL}/api/tokens/${tokenAddress}/transfers`);
      console.log('✅ Token transfers:', transfersResponse.data);
    }
    
    console.log('\n🎉 All API tests passed!');
    
  } catch (error) {
    console.error('❌ API test failed:', error.response?.data || error.message);
  }
}

testAPI();
```

## Definition of Done

### Code Quality
- [ ] Express.js server implemented with proper middleware
- [ ] Input validation using Zod schemas
- [ ] Consistent error handling and response format
- [ ] All endpoints properly documented
- [ ] TypeScript types properly defined

### Testing
- [ ] Unit tests for API endpoints
- [ ] Integration tests for database queries
- [ ] Error handling scenarios tested
- [ ] Pagination functionality tested
- [ ] Input validation tested

### Performance
- [ ] API responds within 500ms for simple queries
- [ ] Pagination works correctly for large datasets
- [ ] Database queries are optimized
- [ ] Memory usage remains stable

### Documentation
- [ ] API documentation with examples
- [ ] Error response documentation
- [ ] Setup and deployment instructions
- [ ] Testing guide

## Testing Strategy

### Unit Tests
```typescript
// tests/api.test.ts
import request from 'supertest';
import app from '../src/api/server';

describe('API Endpoints', () => {
  it('should return health status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('healthy');
  });

  it('should return tokens list', async () => {
    const response = await request(app).get('/api/tokens');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('should validate address format', async () => {
    const response = await request(app).get('/api/transfers/invalid-address');
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Invalid input parameters');
  });

  it('should handle pagination', async () => {
    const response = await request(app).get('/api/tokens?page=1&limit=5');
    expect(response.status).toBe(200);
    expect(response.body.pagination).toBeDefined();
    expect(response.body.pagination.page).toBe(1);
    expect(response.body.pagination.limit).toBe(5);
  });
});
```

### Integration Tests
```typescript
// tests/api-integration.test.ts
import { describe, it, expect } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import app from '../src/api/server';

describe('API Integration Tests', () => {
  let db: PrismaClient;

  beforeAll(async () => {
    db = new PrismaClient();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('should return transfers for a wallet address', async () => {
    // Create test data
    const testToken = await db.token.create({
      data: {
        address: '0xTestToken',
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 18,
        totalSupply: '1000000'
      }
    });

    const testTransfer = await db.transfer.create({
      data: {
        txHash: '0xTestTx',
        from: '0xTestFrom',
        to: '0xTestTo',
        amount: '1000',
        tokenId: testToken.id
      }
    });

    // Test API
    const response = await request(app).get('/api/transfers/0xTestFrom');
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].from).toBe('0xTestFrom');

    // Cleanup
    await db.transfer.delete({ where: { id: testTransfer.id } });
    await db.token.delete({ where: { id: testToken.id } });
  });
});
```

## Dependencies

### External Dependencies
- STORY-001: Environment Setup (PostgreSQL, Prisma)
- STORY-002: Basic Data Ingestion (blocks and transactions)
- STORY-003: Event Decoding (transfers and events)

### Internal Dependencies
- Express.js for API server
- Zod for input validation
- Prisma for database queries

## Risks and Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| API performance issues | Medium | Medium | Implement proper indexing, query optimization |
| Input validation failures | Medium | Low | Comprehensive validation with Zod schemas |
| Database connection issues | High | Low | Implement connection pooling, error handling |
| Memory issues with large queries | Medium | Low | Implement pagination, query limits |
| Security vulnerabilities | High | Low | Input validation, CORS configuration |

## Notes

- Focus on RESTful API design principles
- Implement proper error handling and status codes
- Use consistent response format across all endpoints
- Consider implementing rate limiting for production use

## Related Stories
- STORY-001: Environment Setup (dependency)
- STORY-002: Basic Data Ingestion (dependency)
- STORY-003: Event Decoding (dependency)
- STORY-005: Token Metadata (enhances API responses)
