import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cacheprints_ims'

const connectDB = async () => {
  if (process.env.MONGODB_URI) {
    console.log('📡 MONGODB_URI detected in Environment Variables.')
  } else {
    console.warn('⚠️ MONGODB_URI NOT detected. Falling back to localhost!')
  }
  try {
    const conn = await mongoose.connect(MONGODB_URI)
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`)
    console.log(`📦 Database: ${conn.connection.name}`)
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`)
    // We don't exit here so the server can at least respond with errors 
    // instead of crashing and causing "fake" CORS issues.
  }
}

export default connectDB
