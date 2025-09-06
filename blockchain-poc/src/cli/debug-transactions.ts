import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './config.env' });

async function main() {
  console.log('🔍 Debugging transactions in database...\n');

  const db = new PrismaClient();

  try {
    // Check total counts
    const blockCount = await db.block.count();
    const transactionCount = await db.transaction.count();
    
    console.log(`📊 Database counts:`);
    console.log(`   - Total blocks: ${blockCount}`);
    console.log(`   - Total transactions: ${transactionCount}`);

    // Check the latest block
    const latestBlock = await db.block.findFirst({
      orderBy: { number: 'desc' }
    });

    if (latestBlock) {
      console.log(`\n📋 Latest block: ${latestBlock.number}`);
      
      // Check transactions for this block
      const transactions = await db.transaction.findMany({
        where: { blockNumber: latestBlock.number },
        take: 5
      });

      console.log(`📝 Transactions in block ${latestBlock.number}: ${transactions.length}`);
      
      if (transactions.length > 0) {
        console.log(`\n🔍 Sample transactions:`);
        transactions.forEach((tx, index) => {
          console.log(`   ${index + 1}. ${tx.hash.substring(0, 10)}... (from: ${tx.from.substring(0, 10)}...)`);
        });
      }
    }

    // Check all transactions
    const allTransactions = await db.transaction.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' }
    });

    console.log(`\n📋 All transactions (latest 10):`);
    allTransactions.forEach((tx, index) => {
      console.log(`   ${index + 1}. Block ${tx.blockNumber}: ${tx.hash.substring(0, 10)}...`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.$disconnect();
  }
}

main();
