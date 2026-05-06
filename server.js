import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
dotenv.config()

import connectDB from './config/db.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'

// ── Route imports ─────────────────────────────────────────────────────────────
import authRoutes     from './routes/authRoutes.js'
import userRoutes     from './routes/userRoutes.js'
import materialRoutes from './routes/materialRoutes.js'
import orderRoutes    from './routes/orderRoutes.js'
import bomRoutes      from './routes/bomRoutes.js'
import backupRoutes   from './routes/backupRoutes.js'
import { dashboardRouter, settingsRouter, activityLogRouter, transactionRouter, purchaseRouter } from './routes/otherRoutes.js'
import { startAutoBackup } from './controllers/backupController.js'
import josRoutes from './routes/josRoutes.js'

// ── Connect to MongoDB ────────────────────────────────────────────────────────
connectDB()

const app  = express()
const PORT = process.env.PORT || 5000

// ── Middleware ────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.CLIENT_URL?.replace(/\/$/, ''),
  process.env.JOS_CLIENT_URL?.replace(/\/$/, ''),
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true)
    
    // Normalize origin for comparison
    const normalizedOrigin = origin.replace(/\/$/, '')
    
    if (allowedOrigins.includes(normalizedOrigin) || process.env.NODE_ENV !== 'production') {
      callback(null, true)
    } else {
      console.error(`CORS Blocked: ${origin} not in [${allowedOrigins.join(', ')}]`)
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))   // 10mb for base64 receipt/product images
app.use(express.urlencoded({ extended: true }))

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: "CachePrint's IMS Backend is running ✅", time: new Date() })
})

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',              authRoutes)
app.use('/api/users',             userRoutes)
app.use('/api/materials',         materialRoutes)
app.use('/api/orders',            orderRoutes)
app.use('/api/bom',               bomRoutes)
app.use('/api/purchases',         purchaseRouter)
app.use('/api/transactions',      transactionRouter)
app.use('/api/activity-log',      activityLogRouter)
app.use('/api/settings',          settingsRouter)
app.use('/api/dashboard',         dashboardRouter)
app.use('/api/backups',           backupRoutes)
app.use('/api/jos',               josRoutes)

// ── 404 + Error Handlers ──────────────────────────────────────────────────────
app.use(notFound)
app.use(errorHandler)

// ── Start Server ──────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`)
    console.log(`📡 API Base URL: http://localhost:${PORT}/api`)
    console.log(`🌐 Accepting requests from: ${process.env.CLIENT_URL || 'http://localhost:5173'}\n`)

    // Start automatic backups (every 10 minutes)
    startAutoBackup(10 * 60 * 1000)
  })
}

export default app;
