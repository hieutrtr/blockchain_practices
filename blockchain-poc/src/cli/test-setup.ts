import { PrismaClient } from '@prisma/client';
import { BlockchainFetcher } from '../ingestion/blockchain-fetcher';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './config.env' });

async function testEnvironmentSetup() {
  console.log('🧪 Testing Environment Setup...\n');

  // Test 1: Environment Variables
  console.log('1️⃣ Testing environment variables...');
  const requiredEnvVars = ['DATABASE_URL', 'ETH_RPC_URL', 'API_PORT'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error(`❌ Missing environment variables: ${missingVars.join(', ')}`);
    console.log('💡 Copy config.env to .env and update the values');
    return false;
  }
  console.log('✅ All required environment variables are set\n');

  // Test 2: Database Connection
  console.log('2️⃣ Testing database connection...');
  const db = new PrismaClient();
  try {
    await db.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    console.log('💡 Make sure PostgreSQL is running: docker-compose up -d postgres');
    return false;
  }

  // Test 3: Database Schema
  console.log('\n3️⃣ Testing database schema...');
  try {
    // Try to query each table to ensure schema exists
    await db.block.findMany({ take: 1 });
    await db.transaction.findMany({ take: 1 });
    await db.event.findMany({ take: 1 });
    await db.token.findMany({ take: 1 });
    await db.transfer.findMany({ take: 1 });
    console.log('✅ Database schema is properly set up');
  } catch (error) {
    console.error('❌ Database schema test failed:', error);
    console.log('💡 Run: npx prisma migrate dev --name init');
    return false;
  }

  // Test 4: Ethereum RPC Connection
  console.log('\n4️⃣ Testing Ethereum RPC connection...');
  const fetcher = new BlockchainFetcher();
  const connectionTest = await fetcher.testConnection();
  
  if (connectionTest.success) {
    console.log(`✅ Ethereum RPC connection successful`);
    console.log(`   Current block: ${connectionTest.blockNumber}`);
    console.log(`   RPC URL: ${fetcher.getProviderUrl()}`);
  } else {
    console.error('❌ Ethereum RPC connection failed:', connectionTest.error);
    console.log('💡 Check your RPC URL in config.env');
    return false;
  }

  // Test 5: Network Information
  console.log('\n5️⃣ Testing network information...');
  try {
    const networkInfo = await fetcher.getNetworkInfo();
    console.log(`✅ Network: ${networkInfo.name} (Chain ID: ${networkInfo.chainId})`);
  } catch (error) {
    console.error('❌ Failed to get network information:', error);
    return false;
  }

  // Cleanup
  await db.$disconnect();

  console.log('\n🎉 Environment setup test completed successfully!');
  console.log('\n📋 Next steps:');
  console.log('   1. Start the API server: npm run dev');
  console.log('   2. Test the API: curl http://localhost:3000/health');
  console.log('   3. Run the tests: npm test');
  
  return true;
}

// Run the test
testEnvironmentSetup().catch(error => {
  console.error('❌ Environment setup test failed:', error);
  process.exit(1);
});
