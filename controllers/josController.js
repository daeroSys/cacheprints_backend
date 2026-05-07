import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import Product from '../models/Product.js'
import Order from '../models/Order.js'
import ActivityLog from '../models/ActivityLog.js'

// ── Helper: generate JWT ──────────────────────────────────────────────────────
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' })

const logActivity = async (data) => {
  try { await ActivityLog.create({ logId: `LOG-${Date.now()}`, timestamp: new Date(), ...data }) }
  catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/jos/auth/register
// @desc    Register a new customer
// ─────────────────────────────────────────────────────────────────────────────
export const registerCustomer = async (req, res, next) => {
  try {
    const { email, password, name } = req.body

    if (!email || !password || !name) {
      return res.status(400).json({ ok: false, error: 'Please provide name, email, and password' })
    }

    const userExists = await User.findOne({ email: email.toLowerCase() })
    if (userExists) {
      return res.status(400).json({ ok: false, error: 'Email already registered' })
    }

    try {
      const user = await User.create({
        email: email.toLowerCase(),
        password,
        name,
        role: 'Customer'
      })

      const token = generateToken(user._id)

      res.status(201).json({
        ok: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          contact: user.contact,
          phone: user.phone
        }
      })
    } catch (createErr) {
      // Catch Mongoose validation or duplicate key errors
      if (createErr.name === 'ValidationError') {
        const message = Object.values(createErr.errors).map(val => val.message).join(', ')
        return res.status(400).json({ ok: false, error: message })
      }
      if (createErr.code === 11000) {
        return res.status(400).json({ ok: false, error: 'Account details already in use (email or username)' })
      }
      throw createErr
    }
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/jos/auth/login
// @desc    Login for customer
// ─────────────────────────────────────────────────────────────────────────────
export const loginCustomer = async (req, res, next) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password')

    if (!user) {
      console.warn(`[JOS] Failed login attempt: User not found (${email})`)
      return res.status(401).json({ ok: false, error: 'Invalid email or password' })
    }
    
    if (!(await user.matchPassword(password))) {
      console.warn(`[JOS] Failed login attempt: Incorrect password for ${email}`)
      return res.status(401).json({ ok: false, error: 'Invalid email or password' })
    }

    if (user.role !== 'Customer') {
       // Optional: Block staff from JOS login or allow them? 
       // For now let's allow anyone but JOS frontend is for customers.
    }

    const token = generateToken(user._id)

    res.json({
      ok: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        contact: user.contact,
        phone: user.phone
      }
    })
  } catch (err) { 
    console.error(`[JOS] loginCustomer Error: ${err.message}`)
    console.error(err.stack)
    next(err) 
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/jos/products
// @desc    Get all public products
// ─────────────────────────────────────────────────────────────────────────────
export const getProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ isArchived: { $ne: true } })
    res.json(products)
  } catch (err) { 
    console.error(`[JOS] getProducts Error: ${err.message}`)
    next(err) 
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/jos/orders
// @desc    Create a new job order from JOS
// ─────────────────────────────────────────────────────────────────────────────
export const createOrder = async (req, res, next) => {
  try {
    const { 
      customerName, 
      customerEmail, 
      phoneNumber, 
      orderType, 
      shippingAddress, 
      items, 
      customizationDetails, 
      totalPrice 
    } = req.body
    
    // Generate an Order ID
    const orderId = `ORD-${Date.now().toString().slice(-8).toUpperCase()}`

    const apparelType = customizationDetails?.apparelType || ''

    // Map customizationDetails to IMS structure
    const rows = (customizationDetails?.lineup || []).map(player => ({
      id: player.id,
      name: player.surname,
      surname: player.surname,
      no: player.jerseyNumber,
      jerseyNumber: player.jerseyNumber,
      upperType: apparelType, // Set the product type chosen by customer
      lowerType: apparelType,
      upperSize: player.size,
      lowerSize: player.size,
      size: player.size,
      addOn: player.addOn
    }))

    const order = await Order.create({
      orderId,
      customer: customerName.trim(),
      teamName: customizationDetails?.teamName?.trim() || customizationDetails?.customText?.trim() || '',
      contact: phoneNumber?.trim() || '',
      customerName,
      customerEmail,
      phoneNumber,
      orderType,
      shippingAddress,
      items,
      customizationDetails,
      totalAmount: totalPrice,
      totalPrice,
      paidAmount: 0,
      user: req.user ? req.user._id : null,
      status: 'Order Received', // Align with IMS starting status
      productionPhase: 'Order Received',
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days deadline
      
      // IMS Mappings
      rows,
      design: `Primary: ${customizationDetails?.primaryColor || 'N/A'} | Fabric: ${customizationDetails?.fabricName || 'N/A'}`,
      productType: apparelType,
      fabricName: customizationDetails?.fabricName || '',
      cmyk: customizationDetails?.cmyk || { c: 0.25, m: 0.25, y: 0.25, k: 0.25 },
      upperPrice: customizationDetails?.productPrice || 450,
      lowerPrice: customizationDetails?.productPrice || 450
    })

    res.status(201).json({ ok: true, order })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/jos/orders/:id/payment-receipt
// ─────────────────────────────────────────────────────────────────────────────
export const submitPaymentReceipt = async (req, res, next) => {
  try {
    const { paymentReceipt } = req.body
    let order = await Order.findOne({ _id: req.params.id })
    if (!order && mongoose.Types.ObjectId.isValid(req.params.id)) {
      order = await Order.findOne({ _id: new mongoose.Types.ObjectId(req.params.id) })
    }
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' })
    
    order.paymentReceipt = paymentReceipt
    order.paymentReceiptDate = new Date()
    await order.save()
    
    res.json({ ok: true, order })
  } catch (err) { next(err) }
}


// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/jos/my-orders
// @desc    Get orders for logged in customer
// ─────────────────────────────────────────────────────────────────────────────
export const getCustomerOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 })
    res.json(orders)
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/jos/products
// @desc    Add a new product (Admin)
// ─────────────────────────────────────────────────────────────────────────────
export const addProduct = async (req, res, next) => {
  try {
    const { name, category, price, description, image } = req.body
    
    // Generate a Product ID
    const productId = `PRD-${Date.now().toString().slice(-8).toUpperCase()}`

    const product = await Product.create({
      productId,
      name,
      category,
      price,
      description,
      image // image is base64 in JOS
    })

    res.status(201).json(product)
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/jos/products/:id
// @desc    Update a product (Admin)
// ─────────────────────────────────────────────────────────────────────────────
export const updateProduct = async (req, res, next) => {
  try {
    const { name, category, price, description, image } = req.body
    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).json({ ok: false, error: 'Product not found' })
    }

    product.name = name || product.name
    product.category = category || product.category
    product.price = price !== undefined ? price : product.price
    product.description = description || product.description
    if (image) product.image = image

    await product.save()
    res.json(product)
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   DELETE /api/jos/products/:id
// @desc    Delete a product (Admin)
// ─────────────────────────────────────────────────────────────────────────────
export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ ok: false, error: 'Product not found' })
    }
    
    // Hard delete or archive? JOS uses hard delete in its original code.
    // Let's archive to be safe, but JOS frontend expects delete.
    await product.deleteOne()
    res.json({ ok: true, message: 'Product deleted' })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/jos/profile
// @desc    Update customer profile
// ─────────────────────────────────────────────────────────────────────────────
export const updateCustomerProfile = async (req, res, next) => {
  try {
    const { name, contact, phone } = req.body
    const user = await User.findById(req.user._id)
    
    user.name = name || user.name
    user.contact = contact || user.contact
    user.phone = phone || user.phone
    await user.save()

    res.json({ ok: true, user: { id: user._id, name: user.name, email: user.email, contact: user.contact, phone: user.phone } })
  } catch (err) { next(err) }
}
// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/jos/admin/stats
// @desc    Get dashboard stats for JOS admin
// ─────────────────────────────────────────────────────────────────────────────
export const getAdminStats = async (req, res, next) => {
  try {
    const totalOrders = await Order.countDocuments({ isArchived: false })
    const pendingOrders = await Order.countDocuments({ isArchived: false, status: { $nin: ['completed', 'rejected'] } })
    const completedOrders = await Order.countDocuments({ isArchived: false, status: 'completed' })
    
    const allOrders = await Order.find({ isArchived: false })
    const totalRevenue = allOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0)

    res.json({
      totalOrders,
      pendingOrders,
      completedOrders,
      totalRevenue
    })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/jos/admin/orders
// @desc    Get recent orders for JOS admin dashboard
// ─────────────────────────────────────────────────────────────────────────────
export const getAdminOrders = async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : null
    let query = Order.find({ isArchived: false }).sort({ createdAt: -1 })
    if (limit) query = query.limit(limit)
    
    const orders = await query;
    
    // Map _id to id for JOS frontend
    const mappedOrders = orders.map(o => ({
      ...o.toObject(),
      id: o._id,
      customerName: o.customer, // JOS frontend expects customerName
      totalPrice: o.totalAmount // JOS frontend expects totalPrice
    }))

    res.json(mappedOrders)
  } catch (err) { next(err) }
}
// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/jos/admin/orders/:id/upload-qr
// ─────────────────────────────────────────────────────────────────────────────
export const uploadQR = async (req, res, next) => {
  try {
    const { qrCode, qrCodeLabel } = req.body
    let order = await Order.findOne({ _id: req.params.id })
    if (!order && mongoose.Types.ObjectId.isValid(req.params.id)) {
      order = await Order.findOne({ _id: new mongoose.Types.ObjectId(req.params.id) })
    }
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' })
    
    order.qrCode = qrCode
    order.qrCodeLabel = qrCodeLabel
    await order.save()
    
    res.json({ ok: true, order })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/jos/admin/orders/:id/approve-payment
// ─────────────────────────────────────────────────────────────────────────────
export const approvePayment = async (req, res, next) => {
  try {
    let order = await Order.findOne({ _id: req.params.id })
    if (!order && mongoose.Types.ObjectId.isValid(req.params.id)) {
      order = await Order.findOne({ _id: new mongoose.Types.ObjectId(req.params.id) })
    }
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' })
    
    // Update payment amounts (JOS uses 20% downpayment)
    const downpayment = order.totalAmount * 0.20
    order.paidAmount = downpayment
    
    order.status = 'Designing' // Next step after payment
    order.productionPhase = 'Designing'
    order.payment = 'Partial' // IMS status
    await order.save()
    
    await logActivity({
      action: 'Payment Approved',
      detail: `Payment for JOS order ${order.orderId} approved by Admin. Status: Designing.`,
      user: req.user.username || req.user.name || 'Admin',
      entityType: 'Order',
      entityId: order.orderId,
      changes: { status: { from: 'pending-payment', to: 'Designing' }, paidAmount: order.paidAmount }
    })
    
    res.json({ ok: true, order })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/jos/admin/orders/:id/reject-payment
// ─────────────────────────────────────────────────────────────────────────────
export const rejectPayment = async (req, res, next) => {
  try {
    let order = await Order.findOne({ _id: req.params.id })
    if (!order && mongoose.Types.ObjectId.isValid(req.params.id)) {
      order = await Order.findOne({ _id: new mongoose.Types.ObjectId(req.params.id) })
    }
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' })
    
    order.paymentReceipt = null
    order.status = 'pending-payment'
    await order.save()
    
    res.json({ ok: true, order })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/jos/admin/orders/:id/start-production
// ─────────────────────────────────────────────────────────────────────────────
export const startProduction = async (req, res, next) => {
  try {
    const { finalDesignUrl } = req.body
    let order = await Order.findOne({ _id: req.params.id })
    if (!order && mongoose.Types.ObjectId.isValid(req.params.id)) {
      order = await Order.findOne({ _id: new mongoose.Types.ObjectId(req.params.id) })
    }
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' })
    
    order.finalDesignUrl = finalDesignUrl
    order.status = 'Printing'
    order.productionPhase = 'Printing' 
    await order.save()
    
    await logActivity({
      action: 'Production Started',
      detail: `Design uploaded for order ${order.orderId}. Status: Printing.`,
      user: req.user.username || req.user.name || 'Admin',
      entityType: 'Order',
      entityId: order.orderId,
      changes: { status: { from: 'Designing', to: 'Printing' }, finalDesignUrl: 'Uploaded' }
    })
    
    res.json({ ok: true, order })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/jos/admin/orders/:id/upload-final-payment
// ─────────────────────────────────────────────────────────────────────────────
export const uploadFinalPayment = async (req, res, next) => {
  try {
    const { finalPaymentReceipt } = req.body
    let order = await Order.findOne({ _id: req.params.id })
    if (!order && mongoose.Types.ObjectId.isValid(req.params.id)) {
      order = await Order.findOne({ _id: new mongoose.Types.ObjectId(req.params.id) })
    }
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' })
    
    order.finalPaymentReceipt = finalPaymentReceipt
    order.finalPaymentReceiptDate = new Date()
    await order.save()
    
    res.json({ ok: true, order })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/jos/admin/orders/:id/status
// ─────────────────────────────────────────────────────────────────────────────
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body
    let order = await Order.findOne({ _id: req.params.id })
    if (!order && mongoose.Types.ObjectId.isValid(req.params.id)) {
      order = await Order.findOne({ _id: new mongoose.Types.ObjectId(req.params.id) })
    }
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' })
    
    order.status = status
    if (status === 'completed' && !order.isCompleted) {
      order.isCompleted = true
      order.completedAt = new Date()
    }
    await order.save()
    
    res.json({ ok: true, order })
  } catch (err) { next(err) }
}
