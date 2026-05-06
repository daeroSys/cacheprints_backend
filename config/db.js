import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config()

export const connectDB = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI
    if (!MONGODB_URI) {
      console.error('❌ MONGODB_URI is not defined in environment variables')
      process.exit(1)
    }

    const conn = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, 
      connectTimeoutMS: 10000,
      family: 4, // Force IPv4 to avoid serverless connection issues
      tlsAllowInvalidCertificates: true, 
    })
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`)
    console.log(`📦 Database: ${conn.connection.name}`)
    return conn
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`)
    // Don't exit process in production/serverless, just log
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1)
    }
  }
}

export default connectDB
