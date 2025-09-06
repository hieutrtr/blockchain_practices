import { PrismaClient } from '@prisma/client';
import { EventProcessor } from '../processing/event-processor';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './config.env' });

async function main() {
  console.log('🚀 Blockchain Event Decoding CLI\n');

  const db = new PrismaClient();
  const rpcUrl = process.env.ETH_RPC_URL;
  
  if (!rpcUrl) {
    console.error('❌ ETH_RPC_URL environment variable is required');
    process.exit(1);
  }

  try {
    console.log(`📡 Using RPC endpoint: ${rpcUrl}`);
    console.log(`🗄️  Database: ${process.env.DATABASE_URL?.split('@')[1] || 'localhost'}\n`);

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const processor = new EventProcessor(provider, db);
    
    // Get current status
    console.log('📊 Current event processing status:');
    const stats = await processor.getEventStatistics();
    console.log(`   - Total events: ${stats.totalEvents}`);
    console.log(`   - Total transfers: ${stats.totalTransfers}`);
    console.log(`   - Events by contract: ${Object.keys(stats.eventsByContract).length} contracts`);
    console.log(`   - Transfers by token: ${Object.keys(stats.transfersByToken).length} tokens\n`);
    
    // Process events for the last 5 blocks
    console.log('🧪 Starting event processing for 5 latest blocks...');
    await processor.processLatestBlocks(5);
    
    // Show final statistics
    console.log('\n📊 Final event processing statistics:');
    const finalStats = await processor.getEventStatistics();
    console.log(`   - Total events: ${finalStats.totalEvents}`);
    console.log(`   - Total transfers: ${finalStats.totalTransfers}`);
    
    if (Object.keys(finalStats.eventsByContract).length > 0) {
      console.log('\n📋 Events by contract:');
      Object.entries(finalStats.eventsByContract).forEach(([contract, count]) => {
        console.log(`   - ${contract}: ${count} events`);
      });
    }
    
    if (Object.keys(finalStats.transfersByToken).length > 0) {
      console.log('\n💰 Transfers by token:');
      Object.entries(finalStats.transfersByToken).forEach(([token, count]) => {
        console.log(`   - ${token}: ${count} transfers`);
      });
    }
    
    console.log('\n🎉 Event decoding test completed successfully!');
    
  } catch (error) {
    console.error('❌ Event processing failed:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Blockchain Event Decoding CLI

Usage:
  npm run decode-events                    # Process 5 latest blocks
  npm run decode-events -- --blocks 10     # Process 10 latest blocks
  npm run decode-events -- --help          # Show this help

Options:
  --blocks <number>    Number of blocks to process (default: 5)
  --help, -h          Show this help message

Environment Variables:
  ETH_RPC_URL         Ethereum RPC endpoint URL
  DATABASE_URL        PostgreSQL database connection string

Prerequisites:
  - Run data ingestion first (npm run ingest)
  - Ensure blocks and transactions are stored in database
`);
  process.exit(0);
}

// Parse blocks argument
const blocksArg = args.find(arg => arg.startsWith('--blocks='));
const blocksValue = blocksArg ? parseInt(blocksArg.split('=')[1]) : 5;

if (blocksValue && blocksValue > 0) {
  console.log(`📝 Will process ${blocksValue} blocks`);
}

main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
