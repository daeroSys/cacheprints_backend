import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config()

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development and between function invocations in serverless (Vercel).
 */
let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

export const connectDB = async () => {
  const MONGODB_URI = process.env.MONGODB_URI
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined')
    process.exit(1)
  }

  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      family: 4,
      tlsAllowInvalidCertificates: true,
      tlsInsecure: true, // Additional fallback for certificate issues
    }

    console.log('📡 Initiating new MongoDB connection...')
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`)
      return mongoose
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    console.error(`❌ MongoDB Connection Error: ${e.message}`)
    throw e
  }

  return cached.conn
}

export default connectDB

