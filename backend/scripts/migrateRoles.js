import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const collection = mongoose.connection.collection('users');
    
    // Update directly to bypass Mongoose schema validation
    const res1 = await collection.updateMany({ role: 'admin' }, { $set: { role: 'Admin' } });
    console.log(`Updated ${res1.modifiedCount} users from 'admin' to 'Admin'`);

    const res2 = await collection.updateMany({ role: 'godown_keeper' }, { $set: { role: 'Godown keeper' } });
    console.log(`Updated ${res2.modifiedCount} users from 'godown_keeper' to 'Godown keeper'`);

    const res3 = await collection.updateMany({ role: 'purchase_dept' }, { $set: { role: 'Purchase dept' } });
    console.log(`Updated ${res3.modifiedCount} users from 'purchase_dept' to 'Purchase dept'`);

    const res4 = await collection.updateMany({ role: 'sales_dept' }, { $set: { role: 'Sales dept' } });
    console.log(`Updated ${res4.modifiedCount} users from 'sales_dept' to 'Sales dept'`);

    console.log('Migration completed');
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

migrate();
