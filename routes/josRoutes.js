import express from 'express'
import {
  registerCustomer,
  loginCustomer,
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  createOrder,
  submitPaymentReceipt,
  getCustomerOrders,
  updateCustomerProfile,
  getAdminStats,
  getAdminOrders,
  uploadQR,
  approvePayment,
  rejectPayment,
  startProduction,
  uploadFinalPayment,
  updateOrderStatus,
  cancelOrder
} from '../controllers/josController.js'
import { protect, adminOnly } from '../middleware/auth.js'

const router = express.Router()

// Auth
router.post('/auth/register', registerCustomer)
router.post('/auth/login', loginCustomer)

// Products
router.get('/products', getProducts)
router.post('/products', protect, adminOnly, addProduct)
router.put('/products/:id', protect, adminOnly, updateProduct)
router.delete('/products/:id', protect, adminOnly, deleteProduct)

// Orders
router.post('/orders', protect, createOrder)
router.get('/my-orders', protect, getCustomerOrders)
router.put('/orders/:id/payment-receipt', protect, submitPaymentReceipt)
router.put('/orders/:id/cancel', protect, cancelOrder)

// Admin
router.get('/admin/stats', protect, adminOnly, getAdminStats)
router.get('/admin/orders', protect, adminOnly, getAdminOrders)
router.put('/admin/orders/:id/upload-qr', protect, adminOnly, uploadQR)
router.put('/admin/orders/:id/approve-payment', protect, adminOnly, approvePayment)
router.put('/admin/orders/:id/reject-payment', protect, adminOnly, rejectPayment)
router.put('/admin/orders/:id/start-production', protect, adminOnly, startProduction)
router.put('/admin/orders/:id/upload-final-payment', protect, adminOnly, uploadFinalPayment)
router.put('/admin/orders/:id/status', protect, adminOnly, updateOrderStatus)

// Profile
router.put('/profile', protect, updateCustomerProfile)

export default router
