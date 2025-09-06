import { PrismaClient } from '@prisma/client';
import { IngestionService } from '../ingestion/ingestion-service';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './config.env' });

async function main() {
  console.log('🚀 Blockchain Data Ingestion CLI\n');

  const db = new PrismaClient();
  const rpcUrl = process.env.ETH_RPC_URL;
  
  if (!rpcUrl) {
    console.error('❌ ETH_RPC_URL environment variable is required');
    process.exit(1);
  }

  try {
    console.log(`📡 Using RPC endpoint: ${rpcUrl}`);
    console.log(`🗄️  Database: ${process.env.DATABASE_URL?.split('@')[1] || 'localhost'}\n`);

    const ingestionService = new IngestionService(rpcUrl, db);
    
    // Get current status
    console.log('📊 Current ingestion status:');
    const status = await ingestionService.getIngestionStatus();
    console.log(`   - Running: ${status.isRunning}`);
    console.log(`   - Last processed block: ${status.lastProcessedBlock || 'None'}`);
    console.log(`   - Total blocks: ${status.totalBlocks}`);
    console.log(`   - Total transactions: ${status.totalTransactions}\n`);
    
    // Test with 5 blocks
    console.log('🧪 Starting test ingestion with 5 blocks...');
    await ingestionService.testIngestion(5);
    
    // Show final status
    console.log('\n📊 Final ingestion status:');
    const finalStatus = await ingestionService.getIngestionStatus();
    console.log(`   - Running: ${finalStatus.isRunning}`);
    console.log(`   - Last processed block: ${finalStatus.lastProcessedBlock || 'None'}`);
    console.log(`   - Total blocks: ${finalStatus.totalBlocks}`);
    console.log(`   - Total transactions: ${finalStatus.totalTransactions}`);
    
    // Show detailed statistics
    const stats = await ingestionService.getIngestionStats();
    console.log('\n📈 Detailed statistics:');
    console.log(`   - Latest block: ${stats.latestBlock}`);
    console.log(`   - Oldest block: ${stats.oldestBlock}`);
    console.log(`   - Average transactions per block: ${stats.averageTransactionsPerBlock}`);
    
    console.log('\n🎉 Data ingestion test completed successfully!');
    
  } catch (error) {
    console.error('❌ Ingestion failed:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Blockchain Data Ingestion CLI

Usage:
  npm run ingest                    # Test with 5 blocks
  npm run ingest -- --blocks 10     # Test with 10 blocks
  npm run ingest -- --help          # Show this help

Options:
  --blocks <number>    Number of blocks to ingest (default: 5)
  --help, -h          Show this help message

Environment Variables:
  ETH_RPC_URL         Ethereum RPC endpoint URL
  DATABASE_URL        PostgreSQL database connection string
  API_PORT            API server port (default: 8082)
`);
  process.exit(0);
}

// Parse blocks argument
const blocksArg = args.find(arg => arg.startsWith('--blocks='));
const blocksValue = blocksArg ? parseInt(blocksArg.split('=')[1]) : 5;

if (blocksValue && blocksValue > 0) {
  console.log(`📝 Will ingest ${blocksValue} blocks`);
}

main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
