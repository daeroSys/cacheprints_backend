import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'

// All models to back up
import User        from '../models/User.js'
import Material    from '../models/Material.js'
import Order       from '../models/Order.js'
import Purchase    from '../models/Purchase.js'
import Transaction from '../models/Transaction.js'
import ActivityLog from '../models/ActivityLog.js'
import Product     from '../models/Product.js'
import Settings    from '../models/Settings.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const BACKUP_DIR = path.join(__dirname, '..', 'backups')

// Map of collection name → Mongoose Model
const COLLECTIONS = {
  users:        User,
  materials:    Material,
  orders:       Order,
  purchases:    Purchase,
  transactions: Transaction,
  activityLogs: ActivityLog,
  products:     Product,
  settings:     Settings,
}

// Ensure backup directory exists
function ensureDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE BACKUP — snapshot every collection to a single timestamped JSON file
// ─────────────────────────────────────────────────────────────────────────────
async function createBackupFile() {
  ensureDir()

  const snapshot = {}
  const counts   = {}

  for (const [name, Model] of Object.entries(COLLECTIONS)) {
    const docs = await Model.find({}).lean()
    snapshot[name] = docs
    counts[name]   = docs.length
  }

  const ts       = new Date()
  const filename = `backup_${ts.toISOString().replace(/[:.]/g, '-')}.json`
  const filepath = path.join(BACKUP_DIR, filename)

  const payload = {
    createdAt: ts.toISOString(),
    counts,
    data: snapshot,
  }

  fs.writeFileSync(filepath, JSON.stringify(payload), 'utf-8')

  console.log(`[Backup] ✅ Created: ${filename}  (${Object.values(counts).reduce((a, b) => a + b, 0)} documents)`)
  return { filename, createdAt: ts.toISOString(), counts }
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST BACKUPS — return available backup files sorted newest-first
// ─────────────────────────────────────────────────────────────────────────────
function listBackupFiles() {
  ensureDir()
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
    .sort()
    .reverse()

  return files.map(f => {
    const stat = fs.statSync(path.join(BACKUP_DIR, f))
    // Extract timestamp from filename
    const raw = f.replace('backup_', '').replace('.json', '').replace(/-/g, (m, i) => {
      // Reconstruct ISO: backup_2026-05-04T14-00-00-000Z → 2026-05-04T14:00:00.000Z
      return i > 15 ? '.' : i > 12 ? ':' : '-'
    })
    return {
      filename: f,
      createdAt: raw,
      sizeBytes: stat.size,
      sizeLabel: stat.size > 1048576
        ? `${(stat.size / 1048576).toFixed(1)} MB`
        : `${(stat.size / 1024).toFixed(0)} KB`,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// RESTORE BACKUP — drop current data and insert backup data
// ─────────────────────────────────────────────────────────────────────────────
async function restoreBackupFile(filename) {
  const filepath = path.join(BACKUP_DIR, filename)
  if (!fs.existsSync(filepath)) {
    throw new Error(`Backup file "${filename}" not found.`)
  }

  const raw     = fs.readFileSync(filepath, 'utf-8')
  const payload = JSON.parse(raw)

  if (!payload.data) {
    throw new Error('Invalid backup file format.')
  }

  const restored = {}

  for (const [name, Model] of Object.entries(COLLECTIONS)) {
    const docs = payload.data[name]
    if (!docs || !Array.isArray(docs)) {
      restored[name] = 0
      continue
    }

    // Drop existing data
    await Model.deleteMany({})

    // Insert backup data
    if (docs.length > 0) {
      await Model.insertMany(docs, { ordered: false, rawResult: false })
    }

    restored[name] = docs.length
  }

  console.log(`[Backup] 🔄 Restored from: ${filename}`)
  return { filename, restored }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLEANUP — keep only the last N backup files
// ─────────────────────────────────────────────────────────────────────────────
function cleanupOldBackups(keepCount = 48) {
  ensureDir()
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
    .sort()
    .reverse()

  if (files.length <= keepCount) return

  const toDelete = files.slice(keepCount)
  for (const f of toDelete) {
    fs.unlinkSync(path.join(BACKUP_DIR, f))
  }
  console.log(`[Backup] 🧹 Cleaned up ${toDelete.length} old backup(s)`)
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-SCHEDULE — call this once at server start to schedule hourly backups
// ─────────────────────────────────────────────────────────────────────────────
let backupInterval = null

export function startAutoBackup(intervalMs = 60 * 60 * 1000) {
  // Then every interval
  backupInterval = setInterval(async () => {
    try {
      await createBackupFile()
      cleanupOldBackups()
    } catch (err) {
      console.error('[Backup] Auto-backup error:', err.message)
    }
  }, intervalMs)

  console.log(`[Backup] ⏰ Auto-backup scheduled every ${intervalMs / 60000} minutes`)
}

export function stopAutoBackup() {
  if (backupInterval) {
    clearInterval(backupInterval)
    backupInterval = null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPRESS ROUTE HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/backups — list 4 most recent backups for UI */
export const getBackups = async (req, res) => {
  try {
    const allBackups = listBackupFiles()
    const backups = allBackups.slice(0, 4)
    res.json({ ok: true, backups })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}

/** POST /api/backups — manually trigger a new backup */
export const createBackup = async (req, res) => {
  try {
    const result = await createBackupFile()
    cleanupOldBackups()
    res.json({ ok: true, ...result })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}

/** POST /api/backups/restore — restore from a specific backup file */
export const restoreBackup = async (req, res) => {
  try {
    const { filename } = req.body
    if (!filename) {
      return res.status(400).json({ ok: false, error: 'Backup filename is required.' })
    }
    const result = await restoreBackupFile(filename)
    res.json({ ok: true, ...result })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}

/** DELETE /api/backups/:filename — delete a specific backup file */
export const deleteBackup = async (req, res) => {
  try {
    const { filename } = req.params
    const filepath = path.join(BACKUP_DIR, filename)
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ ok: false, error: 'Backup not found.' })
    }
    fs.unlinkSync(filepath)
    res.json({ ok: true, message: `Deleted ${filename}` })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}
