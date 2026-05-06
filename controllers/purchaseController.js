import Purchase from '../models/Purchase.js'
import Material from '../models/Material.js'
import Transaction from '../models/Transaction.js'
import ActivityLog from '../models/ActivityLog.js'
import { isFabricInKg, convertKgToMeters, isPaperInPacks, convertPacksToSheets, isVinylInRolls, convertRollsToMeters, isThreadInCones, convertConesToGrams } from '../utils/unitConverter.js'

const logActivity = async (data) => {
  try { await ActivityLog.create({ logId: `LOG-${Date.now()}`, timestamp: new Date(), ...data }) }
  catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/purchases
// @desc    Get all purchases — Purchases page (both tabs)
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const getPurchases = async (req, res, next) => {
  try {
    const purchases = await Purchase.find().sort({ date: -1 })
    res.json({ ok: true, purchases })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/purchases
// @desc    Record a new purchase — Purchases page Record Purchase modal
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const addPurchase = async (req, res, next) => {
  try {
    const { purchaseId, items, overallCost, date, notes, receiptImage } = req.body

    const purchase = await Purchase.create({
      purchaseId,
      items: items.map(i => ({
        materialId:    i.materialId,
        materialRefId: i.materialRefId || '',
        name:          i.name,
        unit:          i.unit || '',
        supplier:      i.supplier,
        qtyOrdered:    Number(i.qtyOrdered),
        qtyReceived:   0,
        totalCost:     Number(i.totalCost),
      })),
      overallCost: Number(overallCost),
      date:        new Date(date),
      notes:       notes || '',
      receiptImage:receiptImage || null,
      isReceived:  false,
      createdBy:   req.user.username,
    })

    await logActivity({
      action:     'Recorded Purchase',
      detail:     `Purchase ${purchase.purchaseId} recorded — ${purchase.items.map(i => i.name).join(', ')}`,
      user:       req.user.username || req.user.name || req.user.email,
      entityType: 'Purchase',
      entityId:   purchase.purchaseId,
      changes:    { items: purchase.items.map(i => ({ name: i.name, supplier: i.supplier, qtyOrdered: i.qtyOrdered, totalCost: i.totalCost })) },
    })

    res.status(201).json({ ok: true, purchase })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/purchases/:id/receive
// @desc    Mark purchase as received — updates material stock + creates Stock-In transaction
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const receivePurchase = async (req, res, next) => {
  try {
    const { receivedItems, receiptImage, receiveReason } = req.body
    const purchase = await Purchase.findById(req.params.id)
    if (!purchase) return res.status(404).json({ ok: false, error: 'Purchase not found.' })
    if (purchase.isReceived) return res.status(400).json({ ok: false, error: 'Purchase already received.' })

    // Update each item's qtyReceived
    purchase.items = purchase.items.map((item, i) => {
      const received = receivedItems?.[i]
      return { ...item.toObject(), qtyReceived: Number(received?.qtyReceived ?? item.qtyOrdered) }
    })
    purchase.isReceived    = true
    purchase.receivedAt    = new Date()
    purchase.receiveReason = receiveReason || ''
    if (receiptImage) purchase.receiptImage = receiptImage
    await purchase.save()

    // Add stock to each material + build transaction items
    const txnItems = []
    let extraNotes = []
    for (const item of purchase.items) {
      const mat = await Material.findById(item.materialId)
      if (mat) {
        let qtyToAdd = Number(item.qtyReceived)
        if (item.unit === 'KG' || isFabricInKg(mat)) {
          const meters = convertKgToMeters(mat.name, qtyToAdd)
          extraNotes.push(`(${qtyToAdd} KG of ${mat.name} converted to ${meters} Meters)`)
          qtyToAdd = meters
        } else if (item.unit === 'Packs' || isPaperInPacks(mat)) {
          const sheets = convertPacksToSheets(qtyToAdd)
          extraNotes.push(`(${qtyToAdd} Packs of ${mat.name} converted to ${sheets} Sheets)`)
          qtyToAdd = sheets
        } else if (item.unit === 'Rolls' || isVinylInRolls(mat)) {
          const meters = convertRollsToMeters(qtyToAdd)
          extraNotes.push(`(${qtyToAdd} Rolls of ${mat.name} converted to ${meters} Meters)`)
          qtyToAdd = meters
        } else if (item.unit === 'Cones' || isThreadInCones(mat)) {
          const grams = convertConesToGrams(qtyToAdd)
          extraNotes.push(`(${qtyToAdd} Cones of ${mat.name} converted to ${grams} Grams)`)
          qtyToAdd = grams
        }

        mat.quantity += qtyToAdd
        await mat.save()
        txnItems.push({
          materialId:    mat._id,
          materialRefId: mat.materialId,
          materialName:  mat.name,
          qty:           qtyToAdd,
          unit:          mat.unit,
        })
      }
    }

    const notesMsg = extraNotes.length > 0 ? ` ${extraNotes.join(' ')}` : ''

    // Create Stock-In transaction
    await Transaction.create({
      transactionId: `TXN-${Date.now()}`,
      type:      'Stock-In',
      items:     txnItems,
      date:      new Date(),
      ref:       purchase.purchaseId,
      notes:     `Purchase received — ${purchase.purchaseId}.${notesMsg}`,
      createdBy: req.user.username,
    })

    await logActivity({
      action:     'Received Purchase',
      detail:     `Purchase ${purchase.purchaseId} marked as received`,
      user:       req.user.username || req.user.name || req.user.email,
      entityType: 'Purchase',
      entityId:   purchase.purchaseId,
      changes:    { isReceived: { from: false, to: true }, receivedAt: purchase.receivedAt },
    })

    res.json({ ok: true, purchase })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/purchases/:id/archive
// @desc    Archive a purchase
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const archivePurchase = async (req, res, next) => {
  try {
    const purchase = await Purchase.findByIdAndUpdate(req.params.id, { isArchived: true, archivedAt: new Date() }, { new: true })
    if (!purchase) return res.status(404).json({ ok: false, error: 'Purchase not found.' })

    await logActivity({
      action: 'Archived Purchase',
      detail: `Purchase ${purchase.purchaseId} was archived`,
      user: req.user.username,
      entityType: 'Purchase',
      entityId: purchase.purchaseId,
      changes: { isArchived: { from: false, to: true } }
    })

    res.json({ ok: true, purchase })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/purchases/:id/restore
// @desc    Restore a purchase
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const restorePurchase = async (req, res, next) => {
  try {
    const purchase = await Purchase.findByIdAndUpdate(req.params.id, { isArchived: false, archivedAt: null }, { new: true })
    if (!purchase) return res.status(404).json({ ok: false, error: 'Purchase not found.' })

    await logActivity({
      action: 'Restored Purchase',
      detail: `Purchase ${purchase.purchaseId} was restored`,
      user: req.user.username,
      entityType: 'Purchase',
      entityId: purchase.purchaseId,
      changes: { isArchived: { from: true, to: false } }
    })

    res.json({ ok: true, purchase })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   DELETE /api/purchases/:id
// @desc    Permanently delete a purchase
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const deletePurchase = async (req, res, next) => {
  try {
    const purchase = await Purchase.findByIdAndDelete(req.params.id)
    if (!purchase) return res.status(404).json({ ok: false, error: 'Purchase not found.' })

    await logActivity({
      action: 'Deleted Purchase',
      detail: `Purchase ${purchase.purchaseId} was permanently deleted`,
      user: req.user.username,
      entityType: 'Purchase',
      entityId: purchase.purchaseId,
      changes: {}
    })

    res.json({ ok: true, id: req.params.id })
  } catch (err) { next(err) }
}
