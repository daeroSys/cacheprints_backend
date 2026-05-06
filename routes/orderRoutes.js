import express from 'express'
import {
  getOrders, getArchivedOrders,
  createOrder, updateOrder,
  completeOrder, advanceOrderStage,
  archiveOrder, restoreOrder, deleteOrder,
  fetchExternalOrders, syncExternalOrder, syncExternalOrderPayment, syncFinalDesign, syncCompletion
} from '../controllers/orderController.js'

import { protect, adminOnly } from '../middleware/auth.js'

const router = express.Router()

router.get   ('/',              protect, getOrders)
router.get   ('/archived',      protect, adminOnly, getArchivedOrders)
router.post  ('/fetch-external', protect, fetchExternalOrders)
router.post  ('/public/sync',   syncExternalOrder)
router.put   ('/public/sync-payment', syncExternalOrderPayment)
router.put   ('/public/sync-final-design', syncFinalDesign)
router.put   ('/public/sync-completion', syncCompletion)

router.post  ('/',              protect, createOrder)
router.put   ('/:id',           protect, updateOrder)
router.patch ('/:id/complete',  protect, completeOrder)
router.patch ('/:id/advance',   protect, advanceOrderStage)
router.patch ('/:id/archive',   protect, adminOnly, archiveOrder)
router.patch ('/:id/restore',   protect, adminOnly, restoreOrder)
router.delete('/:id',           protect, adminOnly, deleteOrder)

export default router
