import express from 'express'
import { getMessagesByOrder, postMessage } from '../controllers/messageController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

// All chat routes are protected by JWT
router.get('/:orderId', protect, getMessagesByOrder)
router.post('/', protect, postMessage)

export default router
