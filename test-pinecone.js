/**
 * Test Pinecone Connection
 * This script verifies Pinecone credentials and gets index details
 */

const fs = require('fs');
const path = require('path');

// Manually load .env.local
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1]] = match[2];
    }
  });
}

const { Pinecone } = require('@pinecone-database/pinecone');

async function testPineconeConnection() {
  console.log('🔍 Testing Pinecone Connection...\n');

  // Check environment variables
  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX_NAME || 'wordpress-archive';

  if (!apiKey) {
    console.error('❌ PINECONE_API_KEY not found in environment');
    process.exit(1);
  }

  console.log('✅ Environment Variables:');
  console.log(`   API Key: ${apiKey.substring(0, 15)}...${apiKey.substring(apiKey.length - 5)}`);
  console.log(`   Index Name: ${indexName}\n`);

  try {
    // Initialize Pinecone client
    console.log('🔗 Connecting to Pinecone...');
    const client = new Pinecone({ apiKey });

    // List all indexes
    console.log('📋 Listing indexes...');
    const indexes = await client.listIndexes();
    console.log(`   Found ${indexes.indexes?.length || 0} indexes:\n`);

    if (indexes.indexes && indexes.indexes.length > 0) {
      indexes.indexes.forEach((idx, i) => {
        console.log(`   ${i + 1}. ${idx.name}`);
        if (idx.host) {
          console.log(`      Host: ${idx.host}`);
        }
        if (idx.dimension) {
          console.log(`      Dimension: ${idx.dimension}`);
        }
        if (idx.metric) {
          console.log(`      Metric: ${idx.metric}`);
        }
        console.log('');
      });
    }

    // Check if our target index exists
    const targetIndex = indexes.indexes?.find(idx => idx.name === indexName);

    if (!targetIndex) {
      console.log(`⚠️  Index "${indexName}" not found!`);
      console.log('   Run POST /api/ingest/init to create it\n');
      return;
    }

    console.log(`✅ Target index "${indexName}" found!`);
    console.log(`   Host: ${targetIndex.host}`);
    console.log(`   Status: ${targetIndex.status?.ready ? 'Ready' : 'Not Ready'}`);

    // Get detailed index description
    console.log('\n📊 Getting index details...');
    const description = await client.describeIndex(indexName);
    console.log('   Details:', JSON.stringify(description, null, 2));

    // Get index statistics
    console.log('\n📈 Getting index statistics...');
    const index = client.index(indexName);
    const stats = await index.describeIndexStats();
    console.log('   Stats:', JSON.stringify(stats, null, 2));

    console.log('\n✅ CONNECTION SUCCESSFUL!');
    console.log('\n🔧 For Make.com Integration:');
    console.log(`   Index Host: ${targetIndex.host}`);
    console.log(`   API Key: Use the same PINECONE_API_KEY`);
    console.log(`   Note: Make.com should use the REST API endpoint, not the SDK host`);

  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the test
testPineconeConnection().catch(console.error);
