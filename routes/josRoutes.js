import express from 'express'
import {
  registerCustomer,
  loginCustomer,
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  createOrder,
  getCustomerOrders,
  updateCustomerProfile,
  getAdminStats,
  getAdminOrders
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

// Admin
router.get('/admin/stats', protect, adminOnly, getAdminStats)
router.get('/admin/orders', protect, adminOnly, getAdminOrders)

// Profile
router.put('/profile', protect, updateCustomerProfile)

export default router
