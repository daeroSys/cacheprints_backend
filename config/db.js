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
    const conn = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, 
      // If you are seeing "certificate validation failed", you can temporarily 
      // uncomment the line below to bypass SSL checks (INSECURE - DEBUG ONLY)
      // tlsAllowInvalidCertificates: true, 
    })
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`)
    console.log(`📦 Database: ${conn.connection.name}`)
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`)
    if (error.message.includes('certificate')) {
      console.error('💡 HINT: This looks like an SSL/Certificate issue. Check your connection string and Atlas whitelisting.')
    }
  }
}

export default connectDB
