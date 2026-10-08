import mongoose from 'mongoose';
import User from '../models/User.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const users = [
      { userId: 'admin', pin: 'WM@123', name: 'Admin User', role: 'Admin' },
      { userId: 'godown', pin: 'WM@123', name: 'Godown Keeper', role: 'Godown keeper' },
      { userId: 'purchase', pin: 'WM@123', name: 'Purchase Dept', role: 'Purchase dept' },
      { userId: 'sales', pin: 'WM@123', name: 'Sales Dept', role: 'Sales dept' }
    ];

    for (const u of users) {
      const existing = await User.findOne({ userId: u.userId });
      if (!existing) {
        const newUser = new User(u);
        await newUser.save();
        console.log(`Created user: ${u.userId}`);
      } else {
        console.log(`User already exists: ${u.userId}`);
      }
    }

    console.log('Seeding completed');
  } catch (err) {
    console.error('Error seeding users:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seed();
