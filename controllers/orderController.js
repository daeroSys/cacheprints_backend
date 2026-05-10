import mongoose from 'mongoose'
import Order from '../models/Order.js'
import axios from 'axios'
import ActivityLog from '../models/ActivityLog.js'
import Material from '../models/Material.js'
import Transaction from '../models/Transaction.js'
import { computeOrderBom } from '../utils/bomCalculator.js'

const logActivity = async (data) => {
  try { await ActivityLog.create({ logId: `LOG-${Date.now()}`, timestamp: new Date(), ...data }) }
  catch (_) {}
}

const derivePayment = (paid, total) => {
  const p = Number(paid) || 0
  const t = Number(total) || 0
  if (p <= 0) return 'Unpaid'
  if (p >= t) return 'Paid'
  return 'Partial'
}

/**
 * Helper to perform automatic material deduction and log transaction.
 */
export async function performAutoDeduction(order, autoDeductions, notePrefix) {
  const txnItems = [];
  console.log(`[BOM] Calculating auto-deduction for ${order.orderId} (${notePrefix})`);

  for (const ad of autoDeductions) {
    let mat = null;
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedName = escapeRegex(ad.name);

    // 1. Try exact name match (case-insensitive)
    mat = await Material.findOne({ name: { $regex: new RegExp(`^${escapedName}$`, 'i') }, isArchived: false });

    // 2. Try category-based fallbacks if exact name fails
    if (!mat) {
      const lowerName = ad.name.toLowerCase();
      
      if (lowerName.includes('ink')) {
        const colorMatch = ad.name.match(/\((.*?)\)/);
        const color = colorMatch ? colorMatch[1] : null;
        if (color) {
          mat = await Material.findOne({ 
            name: { $regex: new RegExp(escapeRegex(color), 'i') }, 
            category: { $regex: /Ink/i }, 
            isArchived: false 
          });
        }
        if (!mat) mat = await Material.findOne({ category: { $regex: /Ink/i }, isArchived: false });
      } 
      else if (lowerName.includes('paper') || lowerName.includes(' in x ')) {
        mat = await Material.findOne({ category: { $regex: /Paper/i }, isArchived: false });
      }
      else if (lowerName.includes('fabric')) {
        mat = await Material.findOne({ category: { $regex: /Fabric/i }, isArchived: false });
      }
      else if (lowerName.includes('thread')) {
        mat = await Material.findOne({ category: { $regex: /Thread/i }, isArchived: false });
      }
    }

    if (!mat) {
      mat = await Material.findOne({ name: { $regex: new RegExp(escapedName, 'i') }, isArchived: false });
    }

    if (mat) {
      const deductQty = Math.round(ad.qty * 100) / 100;
      if (deductQty <= 0) continue;

      console.log(`[BOM] Deducting ${deductQty} ${mat.unit} from ${mat.name}`);
      mat.quantity = Math.max(0, mat.quantity - deductQty);
      await mat.save();

      txnItems.push({
        materialId: mat._id,
        materialRefId: mat.materialId,
        materialName: mat.name,
        qty: -deductQty,
        unit: mat.unit
      });
    } else {
      console.warn(`[BOM] Material not found for deduction: ${ad.name}`);
    }
  }
  return txnItems;
}

/**
 * Handles automatic material deductions based on the production stage.
 */
export async function handleStageDeductions(order, nextStage, extraUpdate = {}) {
  const allTxnItems = [];
  
  // PHASE 1: Heat Press (Deduct Ink and Paper)
  if (nextStage === 'Heat Press') {
    try {
      const coverageFactor = extraUpdate?.coverageFactor !== undefined 
        ? extraUpdate.coverageFactor 
        : (order.coverageFactor !== undefined ? order.coverageFactor : 0.25); // Fallback to 25%

      const bomResult = computeOrderBom({
        rows: order.rows,
        productType: order.productType,
        cmyk: order.cmyk || { c: 0.25, m: 0.25, y: 0.25, k: 0.25 },
        coverageFactor: coverageFactor
      });

      const totalInk = bomResult.totals.ink;
      const cmyk = order.cmyk || { c: 0.25, m: 0.25, y: 0.25, k: 0.25 };
      const totalCmyk = (cmyk.c + cmyk.m + cmyk.y + cmyk.k) || 1;
      
      const autoDeductions = [
        { name: 'INK (CYAN)',    qty: (totalInk * (cmyk.c / totalCmyk)) },
        { name: 'INK (MAGENTA)', qty: (totalInk * (cmyk.m / totalCmyk)) },
        { name: 'INK (YELLOW)',  qty: (totalInk * (cmyk.y / totalCmyk)) },
        { name: 'INK (BLACK)',   qty: (totalInk * (cmyk.k / totalCmyk)) },
        { name: '36 in x 100 m', qty: bomResult.totals.paper36 },
        { name: '44 in x 100 m', qty: bomResult.totals.paper44 }
      ];
      
      const items = await performAutoDeduction(order, autoDeductions, `Ink & Paper`);
      allTxnItems.push(...items);
    } catch (bomErr) {
      console.error('[BOM] Error during Ink/Paper auto-deduction:', bomErr);
    }
  }

  // PHASE 2: Sewing (Deduct Fabric)
  if (nextStage === 'Sewing') {
    try {
      const bomResult = computeOrderBom({
        rows: order.rows,
        productType: order.productType,
        cmyk: order.cmyk || { c: 0.25, m: 0.25, y: 0.25, k: 0.25 }
      });
      const autoDeductions = [
        { name: order.fabricName || 'Fabric', qty: bomResult.totals.fabric }
      ];
      const items = await performAutoDeduction(order, autoDeductions, `Fabric`);
      allTxnItems.push(...items);
    } catch (bomErr) {
      console.error('[BOM] Error during Fabric auto-deduction:', bomErr);
    }
  }

  // PHASE 3: Quality Check (Deduct Thread)
  if (nextStage === 'Quality Check') {
    try {
      const threadName = extraUpdate?.threadName || 'Thread';
      const bomResult = computeOrderBom({
        rows: order.rows,
        productType: order.productType,
        cmyk: order.cmyk || { c: 0.25, m: 0.25, y: 0.25, k: 0.25 }
      });
      const autoDeductions = [
        { name: threadName, qty: bomResult.totals.thread },
        { name: 'WAIST CORD', qty: bomResult.totals.waistCord },
        { name: 'BUTTONS',    qty: bomResult.totals.buttons }
      ];
      const items = await performAutoDeduction(order, autoDeductions, `Others (Thread, Cord, Buttons)`);
      allTxnItems.push(...items);
    } catch (bomErr) {
      console.error('[BOM] Error during Thread auto-deduction:', bomErr);
    }
  }

  return allTxnItems;
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/orders
// @desc    Get all non-archived orders — Job Orders page
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const getOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ isArchived: false }).sort({ createdAt: -1 })
    res.json({ ok: true, orders })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/orders/archived
// @desc    Get archived orders — Archive page
// @access  Private / Admin
// ─────────────────────────────────────────────────────────────────────────────
export const getArchivedOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ isArchived: true }).sort({ archivedAt: -1 })
    res.json({ ok: true, orders })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/orders
// @desc    Create new job order — Job Orders page New Order modal
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const createOrder = async (req, res, next) => {
  try {
    const { orderId, customer, teamName, contact, design, rows, upperPrice, lowerPrice, totalAmount, paidAmount, deadline, notes } = req.body

    const order = await Order.create({
      orderId,
      customer: customer.trim(),
      teamName: teamName?.trim() || '',
      contact:  contact?.trim() || '',
      design:   design?.trim()  || '',
      rows:     rows || [],
      upperPrice: Number(upperPrice) || 450,
      lowerPrice: Number(lowerPrice) || 450,
      totalAmount: Number(totalAmount) || 0,
      paidAmount:  Number(paidAmount)  || 0,
      payment:     derivePayment(paidAmount, totalAmount),
      status:      'Order Received',
      deadline:    new Date(deadline),
      notes:       notes || '',
      designFiles: [],
      isCompleted: false,
      isArchived:  false,
      createdBy:   req.user.username,
    })

    await logActivity({
      action:     'Created Order',
      detail:     `Job order ${order.orderId} created for ${order.customer}`,
      user:       req.user.username || req.user.name || req.user.email,
      entityType: 'Order',
      entityId:   order.orderId,
      changes:    { customer: order.customer, design: order.design, totalAmount: order.totalAmount, deadline: order.deadline },
    })

    res.status(201).json({ ok: true, order })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/orders/:id
// @desc    Update order details — Job Orders Update modal
// @access  Private (Admin fields locked for Staff on frontend)
// ─────────────────────────────────────────────────────────────────────────────
export const updateOrder = async (req, res, next) => {
  try {
    let order = await Order.findOne({ _id: req.params.id })
    if (!order && mongoose.Types.ObjectId.isValid(req.params.id)) {
      order = await Order.findOne({ _id: new mongoose.Types.ObjectId(req.params.id) })
    }
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found.' })

    const before = {
      customer: order.customer, design: order.design, deadline: order.deadline,
      status: order.status, paidAmount: order.paidAmount, notes: order.notes,
    }

    const { customer, teamName, contact, design, deadline, status, paidAmount, notes, rows, upperPrice, lowerPrice, totalAmount, designFiles, designFileUrl, designFileName } = req.body

    // Staff can only update paidAmount and notes
    if (req.user.role?.toLowerCase() === 'admin') {
      if (customer)   order.customer   = customer.trim()
      if (teamName !== undefined) order.teamName = teamName.trim()
      if (contact)    order.contact    = contact.trim()
      if (design)     order.design     = design.trim()
      if (deadline)   order.deadline   = new Date(deadline)
      if (status) {
        const oldStatus = order.status
        order.status = status
        if (status === 'completed' && !order.isCompleted) {
          order.isCompleted = true
          order.completedAt = new Date()
        }
        
        // Trigger auto-deduction if moving to a production stage
        if (status !== oldStatus) {
           const items = await handleStageDeductions(order, status)
           if (items.length > 0) {
             await Transaction.create({
               transactionId: `TXN-${Date.now()}`,
               type: 'Stock-Out',
               items,
               date: new Date(),
               ref: order.orderId,
               notes: `Auto-deducted on status change to ${status}`,
               createdBy: req.user.username || 'Admin',
             });
           }
        }
      }
      if (upperPrice) order.upperPrice = Number(upperPrice)
      if (lowerPrice) order.lowerPrice = Number(lowerPrice)
      if (totalAmount !== undefined) order.totalAmount = Number(totalAmount)
      if (rows)       order.rows       = rows
    }

    if (paidAmount !== undefined) {
      order.paidAmount = Number(paidAmount)
      order.payment    = derivePayment(order.paidAmount, order.totalAmount)
    }
    if (notes !== undefined) order.notes = notes

    if (designFiles)    order.designFiles    = designFiles
    if (designFileUrl)  order.designFileUrl  = designFileUrl
    if (designFileName) order.designFileName = designFileName

    await order.save()

    // Build diff
    const changes = {}
    const after = { customer: order.customer, design: order.design, deadline: order.deadline, status: order.status, paidAmount: order.paidAmount, notes: order.notes }
    Object.keys(before).forEach((k) => {
      if (String(before[k]) !== String(after[k]))
        changes[k] = { from: before[k], to: after[k] }
    })

    await logActivity({
      action:     'Updated Order',
      detail:     `Order ${order.orderId} (${order.customer}) was updated`,
      user:       req.user.username || req.user.name || req.user.email,
      entityType: 'Order',
      entityId:   order.orderId,
      changes,
    })

    res.json({ ok: true, order })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/orders/:id/complete
// @desc    Mark order as complete — Job Orders / Production complete button
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const completeOrder = async (req, res, next) => {
  try {
    const { extraPayment } = req.body
    let order = await Order.findOne({ _id: req.params.id })
    if (!order && mongoose.Types.ObjectId.isValid(req.params.id)) {
      order = await Order.findOne({ _id: new mongoose.Types.ObjectId(req.params.id) })
    }
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found.' })
    if (order.isCompleted) return res.status(400).json({ ok: false, error: 'Order is already completed.' })

    const extra = Number(extraPayment) || 0
    order.paidAmount  += extra
    order.payment      = derivePayment(order.paidAmount, order.totalAmount)
    order.isCompleted  = true
    order.completedAt  = new Date()
    await order.save()

    await logActivity({
      action:     'Completed Order',
      detail:     `Order ${order.orderId} (${order.customer}) was marked as complete`,
      user:       req.user.username || req.user.name || req.user.email,
      entityType: 'Order',
      entityId:   order.orderId,
      changes:    { paidAmount: order.paidAmount, payment: order.payment, completedAt: order.completedAt },
    })

    res.json({ ok: true, order })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/orders/:id/advance
// @desc    Advance order to next production stage — Production Tracking
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const advanceOrderStage = async (req, res, next) => {
  try {
    const { nextStage, consumedMaterials, note, extraUpdate } = req.body
    let order = await Order.findOne({ _id: req.params.id })
    if (!order && mongoose.Types.ObjectId.isValid(req.params.id)) {
      order = await Order.findOne({ _id: new mongoose.Types.ObjectId(req.params.id) })
    }
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found.' })

    const prevStage = order.status
    
    // Enforce: Only JOS (via sync-payment webhook) can advance from Order Received to Designing
    if (prevStage === 'Order Received' && nextStage === 'Designing') {
      return res.status(403).json({ ok: false, error: 'Manual transition from "Order Received" to "Designing" is disabled. Please confirm payment in PrintSync.' })
    }

    // Enforce: Only JOS (via sync-final-design webhook) can advance from Designing to Printing
    if (prevStage === 'Designing' && nextStage === 'Printing') {
      return res.status(403).json({ ok: false, error: 'Manual transition from "Designing" to "Printing" is disabled. Please upload the final design in PrintSync.' })
    }

    order.status = nextStage
    if (nextStage === 'completed' && !order.isCompleted) {
      order.isCompleted = true
      order.completedAt = new Date()
    }
    if (note) order.notes = (order.notes ? order.notes + '\n' : '') + `[${nextStage}] ${note}`
    if (extraUpdate?.designFiles)    order.designFiles    = extraUpdate.designFiles
    if (extraUpdate?.designFileUrl)  order.designFileUrl  = extraUpdate.designFileUrl
    if (extraUpdate?.designFileName) order.designFileName = extraUpdate.designFileName
    if (extraUpdate?.paidAmount !== undefined) order.paidAmount = extraUpdate.paidAmount
    
    // Store coverageFactor if provided
    if (extraUpdate?.coverageFactor !== undefined) {
      order.coverageFactor = extraUpdate.coverageFactor
    }

    await order.save()

    const allTxnItems = await handleStageDeductions(order, nextStage, extraUpdate);
    
    // Deduct consumed materials manually (passed from the modal)
    if (consumedMaterials && consumedMaterials.length > 0) {
      for (const cm of consumedMaterials) {
        if (!cm.materialId || !cm.qty) continue;
        const mat = await Material.findById(cm.materialId);
        if (!mat) continue;
        
        const deductQty = Number(cm.qty);
        mat.quantity = Math.max(0, mat.quantity - deductQty);
        await mat.save();
        allTxnItems.push({
          materialId: mat._id,
          materialRefId: mat.materialId,
          materialName: mat.name,
          qty: -deductQty,
          unit: mat.unit
        });
      }
    }

    // Create a single consolidated transaction
    if (allTxnItems.length > 0) {
      await Transaction.create({
        transactionId: `TXN-${Date.now()}`,
        type: 'Stock-Out',
        items: allTxnItems,
        date: new Date(),
        ref: order.orderId,
        notes: note || `Used in ${prevStage} – ${order.orderId}`,
        createdBy: req.user.username,
      });
      console.log(`[BOM] Created consolidated transaction for ${order.orderId} (Status: ${nextStage})`);
    }

    await logActivity({
      action:     'Advanced Production Stage',
      detail:     `Order ${order.orderId} advanced from "${prevStage}" to "${nextStage}"`,
      user:       req.user.username || req.user.name || req.user.email,
      entityType: 'Order',
      entityId:   order.orderId,
      changes:    { status: { from: prevStage, to: nextStage } },
    })

    // Notify JOS of stage update
    if (order.externalRef) {
      try {
        const josBaseUrl = process.env.JOS_API_URL || 'http://localhost:5000/api';
        await axios.put(`${josBaseUrl}/orders/public/sync-production-stage`, {
          jobOrderId: order.externalRef,
          nextStage: nextStage
        })
        console.log(`[IMS] Synced stage update "${nextStage}" to JOS for ${order.externalRef}`)
      } catch (syncErr) {
        console.error('[IMS] Failed to sync stage update to JOS:', syncErr.message)
      }
    }

    res.json({ ok: true, order })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/orders/:id/archive
// @desc    Archive an order
// @access  Private / Admin
// ─────────────────────────────────────────────────────────────────────────────
export const archiveOrder = async (req, res, next) => {
  try {
    let order = await Order.findOne({ _id: req.params.id })
    if (!order && mongoose.Types.ObjectId.isValid(req.params.id)) {
      order = await Order.findOne({ _id: new mongoose.Types.ObjectId(req.params.id) })
    }
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found.' })

    order.isArchived = true
    order.archivedAt = new Date()
    await order.save()

    await logActivity({
      action:     'Archived Order',
      detail:     `Order ${order.orderId} (${order.customer}) was archived`,
      user:       req.user.username || req.user.name || req.user.email,
      entityType: 'Order',
      entityId:   order.orderId,
    })

    res.json({ ok: true, message: `Order ${order.orderId} archived.` })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/orders/:id/restore
// @desc    Restore archived order — Archive page
// @access  Private / Admin
// ─────────────────────────────────────────────────────────────────────────────
export const restoreOrder = async (req, res, next) => {
  try {
    let order = await Order.findOne({ _id: req.params.id })
    if (!order && mongoose.Types.ObjectId.isValid(req.params.id)) {
      order = await Order.findOne({ _id: new mongoose.Types.ObjectId(req.params.id) })
    }
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found.' })

    order.isArchived = false
    order.archivedAt = null
    await order.save()

    await logActivity({
      action:     'Restored Order',
      detail:     `Order ${order.orderId} (${order.customer}) was restored from archive`,
      user:       req.user.username || req.user.name || req.user.email,
      entityType: 'Order',
      entityId:   order.orderId,
    })

    res.json({ ok: true, order })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   DELETE /api/orders/:id
// @desc    Permanently delete archived order — Archive page
// @access  Private / Admin
// ─────────────────────────────────────────────────────────────────────────────
export const deleteOrder = async (req, res, next) => {
  try {
    let order = await Order.findOne({ _id: req.params.id })
    if (!order && mongoose.Types.ObjectId.isValid(req.params.id)) {
      order = await Order.findOne({ _id: new mongoose.Types.ObjectId(req.params.id) })
    }
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found.' })
    if (!order.isArchived) return res.status(400).json({ ok: false, error: 'Only archived orders can be permanently deleted.' })

    await order.deleteOne()

    await logActivity({
      action:     'Deleted Order',
      detail:     `Order ${order.orderId} (${order.customer}) was permanently deleted`,
      user:       req.user.username || req.user.name || req.user.email,
      entityType: 'Order',
      entityId:   order.orderId,
    })

    res.json({ ok: true, message: `Order ${order.orderId} permanently deleted.` })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/orders/fetch-external
// @desc    Mock fetch job orders from external system
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const fetchExternalOrders = async (req, res, next) => {
  try {
    const mockOrder = await Order.create({
      orderId: `EXT-${Date.now()}`,
      customer: 'External Team ' + Math.floor(Math.random() * 1000),
      contact: '09123456789',
      design: 'Imported External Design',
      rows: [
        { no: '01', name: 'Mock Player A', upperType: 'Sleeveless Jersey', upperSize: 'M', lowerType: 'Shorts', lowerSize: 'M' },
        { no: '02', name: 'Mock Player B', upperType: 'Tshirt Jersey', upperSize: 'L', lowerType: 'Shorts', lowerSize: 'L' }
      ],
      upperPrice: 450,
      lowerPrice: 450,
      totalAmount: 1800,
      paidAmount: 0,
      payment: 'Unpaid',
      status: 'Order Received',
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      notes: 'Fetched from external system integration',
      designFiles: [],
      isCompleted: false,
      isArchived: false,
      createdBy: 'System (External API)',
    })

    await logActivity({
      action: 'Fetched External Order',
      detail: `Job order ${mockOrder.orderId} fetched from external system`,
      user: req.user.username,
      entityType: 'Order',
      entityId: mockOrder.orderId,
    })

    res.status(201).json({ ok: true, order: mockOrder })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/orders/public/sync
// @desc    Webhook to receive orders from Job Order System
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
export const syncExternalOrder = async (req, res, next) => {
  try {
    const { 
      jobOrderId,
      customerName, 
      phoneNumber, 
      items, 
      customizationDetails, 
      totalPrice 
    } = req.body;

    const orderId = String(jobOrderId);
    
    const teamName = customizationDetails?.customText || customerName || 'Online Customer';
    const productType = customizationDetails?.apparelType || customizationDetails?.productName || items?.[0]?.productName || 'Custom Apparel';

    const lineup = customizationDetails?.lineup || items || [];
    
    // Map lineup to rows
    const rows = lineup.map((player, idx) => ({
      no: player.jerseyNumber || player.number || String(idx + 1).padStart(2, '0'),
      name: player.surname || player.name || `Player ${idx + 1}`,
      upperType: productType,
      upperSize: player.size || player.variant || 'M',
      addOn: player.addOn?.name || player.addOns?.[0]?.name || (typeof player.addOn === 'string' ? player.addOn : ''),
      addOnPrice: player.addOn?.price || player.addOns?.[0]?.price || 0,
      lowerType: productType,
      lowerSize: player.size || player.variant || 'M'
    }));

    const designStr = [
      customizationDetails?.primaryColor ? `Primary: ${customizationDetails.primaryColor}` : '',
      customizationDetails?.fabricName ? `Fabric: ${customizationDetails.fabricName}` : (customizationDetails?.fabricType ? `Fabric: ${customizationDetails.fabricType}` : '')
    ].filter(Boolean).join(' | ');

    // Deadline: 7 days from now
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);

    const basePrice = Number(items?.[0]?.price) || Number(customizationDetails?.productPrice) || 650;
    
    const order = await Order.create({
      orderId,
      customer: customerName || 'Online Customer',
      teamName,
      productType,
      externalRef: jobOrderId,
      fabricName: customizationDetails?.fabricName || customizationDetails?.fabricType || '',
      contact: phoneNumber || '',
      design: designStr,
      rows: rows,
      upperPrice: basePrice,
      lowerPrice: 0,
      totalAmount: Number(totalPrice) || 0,
      paidAmount: 0,
      payment: 'Unpaid',
      status: 'Order Received',
      deadline: deadline,
      notes: `Auto-synced from PrintSync Job Order system (Ref: ${jobOrderId})`,
      designFiles: customizationDetails?.logoImage ? [{
        fileId: `df-logo-${Date.now()}`,
        name: 'Customer Logo',
        url: customizationDetails.logoImage,
        notes: 'Automatically attached from JOS customization.',
        uploadedAt: new Date()
      }] : [],
      cmyk: customizationDetails?.cmyk || { c: 0.25, m: 0.25, y: 0.25, k: 0.25 },
      isCompleted: false,
      isArchived: false,
      createdBy: 'System (Sync)',
    });

    await logActivity({
      action: 'Synced External Order',
      detail: `Job order ${order.orderId} synced from PrintSync`,
      user: 'System',
      entityType: 'Order',
      entityId: order.orderId,
      changes: { customer: order.customer, totalAmount: order.totalAmount },
    });

    res.status(201).json({ ok: true, order });
  } catch (err) { 
    console.error('Error syncing external order:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/orders/public/sync-payment
// @desc    Webhook to receive payment updates from Job Order System
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
export const syncExternalOrderPayment = async (req, res, next) => {
  try {
    const { jobOrderId, amountPaid, paymentReceipt } = req.body;
    console.log(`[IMS Sync] Received payment sync for jobOrderId: ${jobOrderId}, amount: ${amountPaid}`);

    // Try searching by orderId (which now matches jobOrderId) or externalRef
    let order = await Order.findOne({ $or: [{ orderId: jobOrderId }, { externalRef: jobOrderId }] });

    // Fallback: Search in notes if not found (for orders synced before externalRef field was added)
    if (!order) {
      console.log(`[IMS Sync] Order not found by externalRef. Searching in notes...`);
      order = await Order.findOne({ 
        notes: { $regex: new RegExp(`Ref: ${jobOrderId}`, 'i') } 
      });
    }

    if (!order) {
      console.error(`[IMS Sync] Order not found for jobOrderId: ${jobOrderId}`);
      return res.status(404).json({ 
        ok: false, 
        error: `Order with reference ${jobOrderId} not found in IMS.` 
      });
    }

    console.log(`[IMS Sync] Found order ${order.orderId}. Updating payment...`);

    order.paidAmount = amountPaid;
    order.payment = derivePayment(order.paidAmount, order.totalAmount);
    // Since payment is confirmed, advance status if it's still 'Order Received'
    if (order.status === 'Order Received') {
      order.status = 'Designing';
    }
    
    await order.save();

    // If there's a receipt, add it to Design Files module if not already present
    if (paymentReceipt) {
      const alreadyHasReceipt = order.designFiles.some(f => f.name === 'Payment Receipt (Downpayment)');
      if (!alreadyHasReceipt) {
        console.log(`[IMS Sync] Attaching payment receipt to designFiles for ${order.orderId}`);
        order.designFiles.push({
          fileId: `df-receipt-${Date.now()}`,
          name: 'Payment Receipt (Downpayment)',
          url: paymentReceipt,
          notes: `Automatically attached from customer payment in PrintSync.`,
          uploadedAt: new Date()
        });
        await order.save();
      }
    }

    await logActivity({
      action: 'Synced Payment',
      detail: `Downpayment of ${amountPaid} received from PrintSync for ${order.orderId}`,
      user: 'System',
      entityType: 'Order',
      entityId: order.orderId,
      changes: { paidAmount: order.paidAmount, payment: order.payment },
    });

    res.json({ ok: true, order });
  } catch (err) {
    console.error('Failed to sync payment to IMS:', err.response?.data || err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/orders/public/sync-final-design
// @desc    Webhook to receive final design from Job Order System
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
export const syncFinalDesign = async (req, res, next) => {
  try {
    const { jobOrderId, designFileUrl, designFileName } = req.body;
    console.log(`[IMS Sync] Received final design for jobOrderId: ${jobOrderId}`);

    let order = await Order.findOne({ $or: [{ orderId: jobOrderId }, { externalRef: jobOrderId }] });
    if (!order) {
      order = await Order.findOne({ notes: { $regex: new RegExp(`Ref: ${jobOrderId}`, 'i') } });
    }

    if (!order) {
      return res.status(404).json({ ok: false, error: `Order with reference ${jobOrderId} not found.` });
    }

    // 1. Set production file links
    order.designFileUrl = designFileUrl;
    order.designFileName = designFileName || 'Final Design File';

    // 2. Add to Design Files attachments
    order.designFiles.push({
      fileId: `df-final-${Date.now()}`,
      name: designFileName || 'Final Design Mockup',
      url: designFileUrl,
      notes: 'Final approved design synced from PrintSync.',
      uploadedAt: new Date()
    });

    // 3. Advance status to Printing
    if (order.status === 'Designing') {
      order.status = 'Printing';
    }

    await order.save();

    await logActivity({
      action: 'Synced Final Design',
      detail: `Final design file synced from PrintSync for ${order.orderId}. Status advanced to Printing.`,
      user: 'System',
      entityType: 'Order',
      entityId: order.orderId,
    });

    res.json({ ok: true, order });
  } catch (err) {
    console.error('Failed to sync final design to IMS:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/orders/public/sync-completion
// @desc    Webhook to receive completion status and final payment proof from JOS
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
export const syncCompletion = async (req, res, next) => {
  try {
    const { jobOrderId, finalPaymentReceipt } = req.body;
    console.log(`[IMS Sync] Received completion sync for jobOrderId: ${jobOrderId}`);

    let order = await Order.findOne({ $or: [{ orderId: jobOrderId }, { externalRef: jobOrderId }] });
    if (!order) {
      order = await Order.findOne({ notes: { $regex: new RegExp(`Ref: ${jobOrderId}`, 'i') } });
    }

    if (!order) {
      return res.status(404).json({ ok: false, error: `Order with reference ${jobOrderId} not found.` });
    }

    // 1. Mark as completed and fully paid
    order.isCompleted = true;
    order.completedAt = new Date();
    order.status = 'Completed';
    order.paidAmount = order.totalAmount;
    order.payment = 'Paid';


    // 2. Attach final payment receipt if provided
    if (finalPaymentReceipt) {
      order.designFiles.push({
        fileId: `df-final-payment-${Date.now()}`,
        name: 'Final Payment Proof (Remaining Balance)',
        url: finalPaymentReceipt,
        notes: 'Final payment proof synced from JOS.',
        uploadedAt: new Date()
      });
    }

    await order.save();

    await logActivity({
      action: 'Synced Completion',
      detail: `Order completion and final payment proof synced from JOS for ${order.orderId}.`,
      user: 'System',
      entityType: 'Order',
      entityId: order.orderId,
    });

    res.json({ ok: true, order });
  } catch (err) {
    console.error('Failed to sync completion to IMS:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}

