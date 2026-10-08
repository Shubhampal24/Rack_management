import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkRoles() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const collection = mongoose.connection.collection('users');
    const roles = await collection.distinct('role');
    const users = await collection.find({}, { projection: { userId: 1, role: 1, _id: 0 } }).toArray();
    
    console.log('--- Roles Summary ---');
    console.log('Distinct roles:', roles);
    console.log('\n--- All Users ---');
    console.table(users);
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

checkRoles();
