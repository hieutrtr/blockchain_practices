import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './config.env' });

const app = express();
const db = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await db.$queryRaw`SELECT 1`;
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ 
      status: 'unhealthy', 
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Basic endpoints
app.get('/api/blocks', async (req, res) => {
  try {
    const blocks = await db.block.findMany({
      take: 10,
      orderBy: { number: 'desc' }
    });
    
    // Convert BigInt values to strings for JSON serialization
    const serializedBlocks = blocks.map(block => ({
      ...block,
      number: block.number.toString(),
      gasUsed: block.gasUsed.toString(),
      gasLimit: block.gasLimit.toString()
    }));
    
    res.json({
      success: true,
      data: serializedBlocks,
      count: serializedBlocks.length
    });
  } catch (error) {
    console.error('Error fetching blocks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch blocks'
    });
  }
});

app.get('/api/tokens', async (req, res) => {
  try {
    const tokens = await db.token.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({
      success: true,
      data: tokens,
      count: tokens.length
    });
  } catch (error) {
    console.error('Error fetching tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tokens'
    });
  }
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Blockchain Data API',
    version: '1.0.0',
    description: 'REST API for querying processed blockchain data',
    endpoints: {
      health: '/health',
      blocks: '/api/blocks',
      tokens: '/api/tokens'
    }
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

const PORT = process.env.API_PORT || 3000;

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await db.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await db.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API info: http://localhost:${PORT}/api`);
});

export default app;
