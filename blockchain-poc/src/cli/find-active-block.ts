import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './config.env' });

async function main() {
  console.log('🔍 Finding a block with transactions...\n');

  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
  const db = new PrismaClient();

  try {
    // Get the latest block number
    const latestBlockNumber = await provider.getBlockNumber();
    console.log(`📊 Latest block: ${latestBlockNumber}`);

    // Check the last 20 blocks for transactions
    for (let i = 0; i < 20; i++) {
      const blockNumber = Number(latestBlockNumber) - i;
      const block = await provider.getBlock(blockNumber, true);
      
      if (block && block.transactions && block.transactions.length > 0) {
        console.log(`✅ Found block ${blockNumber} with ${block.transactions.length} transactions`);
        
        // Store this block and its transactions
        await db.block.upsert({
          where: { number: BigInt(block.number) },
          update: {
            hash: block.hash || '',
            timestamp: new Date(block.timestamp * 1000),
            parentHash: block.parentHash,
            gasUsed: block.gasUsed,
            gasLimit: block.gasLimit
          },
          create: {
            number: block.number,
            hash: block.hash || '',
            timestamp: new Date(block.timestamp * 1000),
            parentHash: block.parentHash,
            gasUsed: block.gasUsed,
            gasLimit: block.gasLimit
          }
        });

        // Store transactions
        let storedCount = 0;
        console.log(`🔍 Transaction types: ${block.transactions.map(tx => typeof tx).slice(0, 5).join(', ')}`);
        
        // Limit to first 5 transactions for testing
        for (const tx of block.transactions.slice(0, 5)) {
          try {
            let txResponse: ethers.TransactionResponse;
            
            if (typeof tx === 'string') {
              // If it's a hash, fetch the full transaction
              console.log(`📝 Fetching transaction: ${tx.substring(0, 10)}...`);
              const fetchedTx = await provider.getTransaction(tx);
              if (!fetchedTx) {
                console.log(`⚠️  Transaction not found: ${tx}`);
                continue;
              }
              txResponse = fetchedTx;
            } else if (typeof tx === 'object' && tx !== null) {
              txResponse = tx as ethers.TransactionResponse;
            } else {
              console.log(`⚠️  Skipping transaction of type: ${typeof tx}`);
              continue;
            }
            
            console.log(`📝 Storing transaction: ${txResponse.hash.substring(0, 10)}...`);
            await db.transaction.upsert({
              where: { hash: txResponse.hash },
              update: {
                blockNumber: block.number,
                from: txResponse.from,
                to: txResponse.to || null,
                value: txResponse.value.toString(),
                gasUsed: txResponse.gasLimit,
                gasPrice: txResponse.gasPrice?.toString() || '0',
                status: 1
              },
              create: {
                hash: txResponse.hash,
                blockNumber: block.number,
                from: txResponse.from,
                to: txResponse.to || null,
                value: txResponse.value.toString(),
                gasUsed: txResponse.gasLimit,
                gasPrice: txResponse.gasPrice?.toString() || '0',
                status: 1
              }
            });
            storedCount++;
          } catch (error) {
            console.error(`❌ Failed to store transaction:`, error);
          }
        }
        console.log(`💾 Stored ${storedCount} transactions`);

        console.log(`💾 Stored block ${blockNumber} and ${block.transactions.length} transactions`);
        break;
      } else {
        console.log(`📝 Block ${blockNumber}: 0 transactions`);
      }
    }

    // Show final status
    const blockCount = await db.block.count();
    const transactionCount = await db.transaction.count();
    console.log(`\n📊 Database status:`);
    console.log(`   - Total blocks: ${blockCount}`);
    console.log(`   - Total transactions: ${transactionCount}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.$disconnect();
  }
}

main();
