import Transaction from '../models/Transaction.js'
import ActivityLog from '../models/ActivityLog.js'
import Settings from '../models/Settings.js'

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTIONS
// ─────────────────────────────────────────────────────────────────────────────

// @route   GET /api/transactions
// @access  Private
export const getTransactions = async (req, res, next) => {
  try {
    const transactions = await Transaction.find().sort({ date: -1 })
    res.json({ ok: true, transactions })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY LOG
// ─────────────────────────────────────────────────────────────────────────────

// @route   GET /api/activity-log
// @access  Private / Admin
export const getActivityLog = async (req, res, next) => {
  try {
    const logs = await ActivityLog.find().sort({ timestamp: -1 })
    res.json({ ok: true, logs })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

// @route   GET /api/settings
// @access  Private
export const getSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne()
    // Auto-create if doesn't exist
    if (!settings) {
      settings = await Settings.create({
        shopName:   "CachePrint's",
        adminEmail: 'admin@cacheprints.com',
        version:    '5.0',
      })
    }
    res.json({ ok: true, settings })
  } catch (err) { next(err) }
}

// @route   PUT /api/settings
// @access  Private / Admin
export const updateSettings = async (req, res, next) => {
  try {
    const { shopName, adminEmail } = req.body
    let settings = await Settings.findOne()
    if (!settings) settings = new Settings()

    const before = { shopName: settings.shopName, adminEmail: settings.adminEmail }
    if (shopName)   settings.shopName   = shopName.trim()
    if (adminEmail) settings.adminEmail = adminEmail.trim().toLowerCase()
    await settings.save()

    await ActivityLog.create({
      logId:      `LOG-${Date.now()}`,
      action:     'Updated Settings',
      detail:     'Shop information was updated',
      user:       req.user.username,
      entityType: 'System',
      entityId:   'settings',
      timestamp:  new Date(),
      changes: {
        shopName:   { from: before.shopName,   to: settings.shopName   },
        adminEmail: { from: before.adminEmail, to: settings.adminEmail },
      },
    })

    res.json({ ok: true, settings })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

// @route   GET /api/dashboard
// @desc    Returns all data the Dashboard needs in one request
// @access  Private
export const getDashboardData = async (req, res, next) => {
  try {
    const { default: Order }       = await import('../models/Order.js')
    const { default: Material }    = await import('../models/Material.js')
    const { default: Purchase }    = await import('../models/Purchase.js')

    const now  = new Date()
    const y    = now.getFullYear()
    const m    = now.getMonth()
    const monthStart = new Date(y, m, 1)
    const monthEnd   = new Date(y, m + 1, 0, 23, 59, 59)

    const activeOrders  = await Order.find({ isArchived: false, isCompleted: false })
    const allOrders     = await Order.find({ isArchived: false })
    const materials     = await Material.find({ isArchived: false })
    const transactions  = await Transaction.find().sort({ date: -1 }).limit(5)
    const purchases     = await Purchase.find({ isReceived: true, receivedAt: { $gte: monthStart, $lte: monthEnd } })

    // Month-filtered orders
    const monthOrders = allOrders.filter(o => {
      const d = new Date(o.createdAt)
      return d >= monthStart && d <= monthEnd
    })

    const monthRevenue   = monthOrders.reduce((s, o) => s + (o.totalAmount || 0), 0)
    const monthCollected = monthOrders.reduce((s, o) => s + (o.paidAmount  || 0), 0)
    const monthPurchCost = purchases.reduce((s, p) => s + (p.overallCost   || 0), 0)

    const lowStockItems  = materials.filter(m => m.quantity <= m.minQty)

    // Production pipeline counts
    const STAGES = ['Order Received','Designing','Printing','Heat Press','Sewing','Quality Check','Ready for Pickup']
    const pipeline = STAGES.map(stage => ({
      stage,
      count: activeOrders.filter(o => o.status === stage).length,
    }))

    // Upcoming deadlines (top 4 by soonest)
    const upcoming = [...activeOrders]
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
      .slice(0, 4)

    res.json({
      ok: true,
      stats: {
        monthRevenue,
        monthCollected,
        monthPurchCost,
        netIncome:    monthCollected - monthPurchCost,
        activeOrders: activeOrders.length,
        completedThisMonth: allOrders.filter(o => o.isCompleted && new Date(o.completedAt) >= monthStart).length,
        totalMaterials: materials.length,
        lowStockCount:  lowStockItems.length,
      },
      pipeline,
      upcomingDeadlines: upcoming,
      lowStockItems:     lowStockItems.slice(0, 5),
      recentTransactions: transactions,
    })
  } catch (err) { next(err) }
}
