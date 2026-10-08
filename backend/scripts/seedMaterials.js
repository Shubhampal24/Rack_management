import 'dotenv/config'
import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Material from '../models/Material.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI)
  
  await Material.deleteMany({})
  console.log('Cleared existing materials')

  const dataPath = path.join(__dirname, 'materials.json')
  const rawData = fs.readFileSync(dataPath, 'utf-8')
  const materialsData = JSON.parse(rawData)

  const saved = await Material.insertMany(materialsData)
  
  console.log(`Successfully created ${saved.length} materials.`)
  process.exit()
}

seed().catch(err => {
  console.error(err)
  process.exit(1)
})
