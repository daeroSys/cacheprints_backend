import express from 'express'
import { protect, adminOnly } from '../middleware/auth.js'
import {
  getBackups,
  createBackup,
  restoreBackup,
  deleteBackup,
} from '../controllers/backupController.js'

const router = express.Router()

// All backup operations require admin access
router.get   ('/',         protect, adminOnly, getBackups)
router.post  ('/',         protect, adminOnly, createBackup)
router.post  ('/restore',  protect, adminOnly, restoreBackup)
router.delete('/:filename', protect, adminOnly, deleteBackup)

export default router
