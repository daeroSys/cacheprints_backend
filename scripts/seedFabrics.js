import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Material from '../models/Material.js'

dotenv.config()

const FABRICS = [
  // Lightweight (~130–140 GSM)
  'AIRCOOL', 'ECOFAB', 'ECOSOFT', 'LYTEX', 'MICRO-COOL',
  'MICRO DOT', 'MICRO KNIT', 'POLY LITE', 'SEMI COOL', 'SUBLI DOT',
  // Midweight (~155–170 GSM)
  'DURAMAX', 'FULLLMAX', 'HEXA TEX', 'MICRO DEX', 'MICRO SHINY',
  'POLYDEX', 'POLTYDEX AG', 'POLYMAX', 'POLYTECH', 'POLYSTRIPES',
  'POLIFIT CROSS', 'SEMI STEP', 'SPORTS MAX', 'SPUNDY', 'SQUARE KNIT', 'SUBLIDEX',
  // Heavyweight (~180–200 GSM)
  'MICROTECH COMPRESSION', 'RIBSTOPS', 'SOLAR M', 'SPANDEX', 'TRIFIT COTTON',
]

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cacheprints_ims')
    console.log('Connected to MongoDB')

    // Check which fabrics already exist (by name) to avoid duplicates
    const existing = await Material.find({ category: 'Fabric', name: { $in: FABRICS } }).select('name')
    const existingNames = new Set(existing.map(m => m.name))

    const toInsert = FABRICS.filter(name => !existingNames.has(name))

    if (toInsert.length === 0) {
      console.log('All fabric types already exist in the database. Nothing to insert.')
      await mongoose.disconnect()
      return
    }

    const now = Date.now()
    const docs = toInsert.map((name, i) => ({
      materialId: `MAT-${now}-${String(i).padStart(3, '0')}`,
      name,
      category: 'Fabric',
      unit: 'meters',
      quantity: 50,
      costPerUnit: 25,
      minQty: 30,
      maxQty: 200,
      leadTime: 5,
      reorderQuantity: 0,
      link: '',
      isArchived: false,
      archivedAt: null,
    }))

    const result = await Material.insertMany(docs)
    console.log(`✅ Inserted ${result.length} fabric materials:`)
    result.forEach(m => console.log(`   - ${m.name} (${m.materialId})`))

    await mongoose.disconnect()
    console.log('Done.')
  } catch (err) {
    console.error('Seed error:', err)
    process.exit(1)
  }
}

seed()
