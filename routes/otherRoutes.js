import express from 'express'
import { getPurchases, addPurchase, receivePurchase, archivePurchase, restorePurchase, deletePurchase } from '../controllers/purchaseController.js'
import { getTransactions, getActivityLog, getSettings, updateSettings, getDashboardData } from '../controllers/miscController.js'
import { protect, adminOnly } from '../middleware/auth.js'

// ── Purchases ─────────────────────────────────────────────────────────────────
export const purchaseRouter = express.Router()
purchaseRouter.get  ('/',              protect, getPurchases)
purchaseRouter.post ('/',              protect, addPurchase)
purchaseRouter.patch('/:id/receive',   protect, receivePurchase)
purchaseRouter.patch('/:id/archive',   protect, adminOnly, archivePurchase)
purchaseRouter.patch('/:id/restore',   protect, adminOnly, restorePurchase)
purchaseRouter.delete('/:id',          protect, adminOnly, deletePurchase)

// ── Transactions ──────────────────────────────────────────────────────────────
export const transactionRouter = express.Router()
transactionRouter.get('/', protect, getTransactions)

// ── Activity Log ──────────────────────────────────────────────────────────────
export const activityLogRouter = express.Router()
activityLogRouter.get('/', protect, adminOnly, getActivityLog)

// ── Settings ──────────────────────────────────────────────────────────────────
export const settingsRouter = express.Router()
settingsRouter.get('/',  protect, getSettings)
settingsRouter.put('/',  protect, adminOnly, updateSettings)

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardRouter = express.Router()
dashboardRouter.get('/', protect, getDashboardData)
