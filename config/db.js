import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config()

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development and between function invocations in serverless (Vercel).
 */
let cached = globalThis.mongoose

if (!cached) {
  cached = globalThis.mongoose = { conn: null, promise: null }
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
      serverSelectionTimeoutMS: 8000, // Shorter than Vercel timeout
      connectTimeoutMS: 8000,
      family: 4,
      tlsInsecure: true, 
    }

    // Mask password in URI for logging
    const maskedURI = MONGODB_URI.replace(/:([^:@]+)@/, ':****@')
    console.log(`📡 Connecting to: ${maskedURI}`)
    
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`)
      return mongoose
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (dbErr) {
    console.error(`❌ MongoDB Connection Error: ${dbErr.message}`)
    cached.promise = null
    throw dbErr
  }

  return cached.conn
}

export default connectDB
