import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'studyguardian';

async function connectToMongoDB() {
  console.log('Connecting to MongoDB...');
  const client = await MongoClient.connect(mongoUrl);
  console.log('✓ Connected to MongoDB');
  return client.db(dbName);
}

export { connectToMongoDB };