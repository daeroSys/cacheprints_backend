import express from 'express'
import { getAllUsers, getActiveUsers, archiveUser, restoreUser, updateUser } from '../controllers/userController.js'
import { protect, adminOnly } from '../middleware/auth.js'

const router = express.Router()

router.get  ('/',            protect, adminOnly, getAllUsers)
router.get  ('/active',      protect, getActiveUsers)
router.patch('/:id/archive', protect, adminOnly, archiveUser)
router.patch('/:id/restore', protect, adminOnly, restoreUser)
router.put  ('/:id',         protect, adminOnly, updateUser)

export default router
