import Material from '../models/Material.js'
import ActivityLog from '../models/ActivityLog.js'
import { getInventoryMetrics } from '../services/inventoryService.js'

const logActivity = async (data) => {
  try { await ActivityLog.create({ logId: `LOG-${Date.now()}`, timestamp: new Date(), ...data }) }
  catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/materials
// @desc    Get all active materials — Materials page, Stock Levels
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const getMaterials = async (req, res, next) => {
  try {
    const materials = await getInventoryMetrics()
    // Safer sort: handle missing names or non-string values
    materials.sort((a, b) => {
      const nameA = String(a.name || '').toLowerCase()
      const nameB = String(b.name || '').toLowerCase()
      return nameA.localeCompare(nameB)
    })
    res.json({ ok: true, materials })
  } catch (err) { 
    console.error('Error in getMaterials controller:', err)
    next(err) 
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/materials/archived
// @desc    Get archived materials — Archive page
// @access  Private / Admin
// ─────────────────────────────────────────────────────────────────────────────
export const getArchivedMaterials = async (req, res, next) => {
  try {
    const materials = await Material.find({ isArchived: true }).sort({ archivedAt: -1 })
    res.json({ ok: true, materials })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/materials
// @desc    Add a new material — Materials page + Add Material modal
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const addMaterial = async (req, res, next) => {
  try {
    const { materialId, name, category, unit, quantity, costPerUnit, minQty, maxQty, leadTime, reorderQuantity, link } = req.body

    const material = await Material.create({
      materialId, name, category, unit,
      quantity:        Math.round((Number(quantity) || 0) * 100) / 100,
      costPerUnit:     Number(costPerUnit),
      minQty:          Math.round((Number(minQty) || 0) * 100) / 100,
      maxQty:          Math.round((Number(maxQty) || 0) * 100) / 100,
      leadTime:        Number(leadTime)        || 7,
      reorderQuantity: Math.round((Number(reorderQuantity) || 0) * 100) / 100,
      link:            link || '',
    })

    await logActivity({
      action:     'Added Material',
      detail:     `"${material.name}" (${material.category}) was added to materials`,
      user:       req.user.username,
      entityType: 'Material',
      entityId:   material.materialId,
      changes:    { name: material.name, category: material.category, unit: material.unit, quantity: material.quantity, costPerUnit: material.costPerUnit },
    })

    res.status(201).json({ ok: true, material })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/materials/:id
// @desc    Update material info (NOT quantity — use /adjust for that)
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const updateMaterial = async (req, res, next) => {
  try {
    const material = await Material.findById(req.params.id)
    if (!material) return res.status(404).json({ ok: false, error: 'Material not found.' })

    const before = { name: material.name, category: material.category, costPerUnit: material.costPerUnit, minQty: material.minQty, maxQty: material.maxQty, leadTime: material.leadTime, reorderQuantity: material.reorderQuantity, link: material.link }

    const { name, category, unit, costPerUnit, minQty, maxQty, leadTime, reorderQuantity, link } = req.body
    if (name)        material.name        = name
    if (category)    material.category    = category
    if (unit)        material.unit        = unit
    if (costPerUnit) material.costPerUnit = Number(costPerUnit)
    if (minQty !== undefined) material.minQty = Number(minQty)
    if (maxQty !== undefined) material.maxQty = Number(maxQty)
    if (leadTime !== undefined) material.leadTime = Number(leadTime)
    if (reorderQuantity !== undefined) material.reorderQuantity = Number(reorderQuantity)
    material.link = link || ''
    await material.save()

    // Build diff
    const changes = {}
    Object.keys(before).forEach((k) => {
      if (String(before[k]) !== String(material[k]))
        changes[k] = { from: before[k], to: material[k] }
    })

    await logActivity({
      action:     'Updated Material',
      detail:     `"${material.name}" material info was updated`,
      user:       req.user.username,
      entityType: 'Material',
      entityId:   material.materialId,
      changes,
    })

    res.json({ ok: true, material })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/materials/:id/adjust
// @desc    Adjust material stock quantity — Stock Levels page ± Adjust
// @access  Private / Admin
// ─────────────────────────────────────────────────────────────────────────────
export const adjustStock = async (req, res, next) => {
  try {
    const { qty, reason } = req.body
    if (!reason?.trim()) return res.status(400).json({ ok: false, error: 'Reason is required for stock adjustment.' })

    const material = await Material.findById(req.params.id)
    if (!material) return res.status(404).json({ ok: false, error: 'Material not found.' })

    const adjustment = Number(qty)
    if (isNaN(adjustment)) return res.status(400).json({ ok: false, error: 'Quantity must be a number.' })
    if (material.quantity + adjustment < 0)
      return res.status(400).json({ ok: false, error: `Cannot remove more than current stock (${material.quantity} ${material.unit}).` })

    const before = material.quantity
    material.quantity = material.quantity + adjustment
    await material.save()

    // Create Transaction record
    const { default: Transaction } = await import('../models/Transaction.js')
    await Transaction.create({
      transactionId: `TXN-${Date.now()}`,
      type:  'Adjustment',
      items: [{ materialId: material._id, materialRefId: material.materialId, materialName: material.name, qty: adjustment, unit: material.unit }],
      date:      new Date(),
      ref:       '',
      notes:     reason,
      createdBy: req.user.username,
    })

    await logActivity({
      action:     'Adjusted Stock',
      detail:     `"${material.name}" stock adjusted by ${adjustment > 0 ? '+' : ''}${adjustment} ${material.unit}. Reason: ${reason}`,
      user:       req.user.username,
      entityType: 'Stock',
      entityId:   material.materialId,
      changes:    { quantity: { from: before, to: material.quantity } },
    })

    res.json({ ok: true, material })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/materials/:id/archive
// @desc    Archive a material — Materials page Archive button
// @access  Private / Admin
// ─────────────────────────────────────────────────────────────────────────────
export const archiveMaterial = async (req, res, next) => {
  try {
    const material = await Material.findById(req.params.id)
    if (!material) return res.status(404).json({ ok: false, error: 'Material not found.' })

    material.isArchived = true
    material.archivedAt = new Date()
    await material.save()

    await logActivity({
      action:     'Archived Material',
      detail:     `"${material.name}" was archived`,
      user:       req.user.username,
      entityType: 'Material',
      entityId:   material.materialId,
    })

    res.json({ ok: true, message: `"${material.name}" has been archived.` })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/materials/:id/restore
// @desc    Restore archived material — Archive page
// @access  Private / Admin
// ─────────────────────────────────────────────────────────────────────────────
export const restoreMaterial = async (req, res, next) => {
  try {
    const material = await Material.findById(req.params.id)
    if (!material) return res.status(404).json({ ok: false, error: 'Material not found.' })

    material.isArchived = false
    material.archivedAt = null
    await material.save()

    await logActivity({
      action:     'Restored Material',
      detail:     `"${material.name}" was restored from archive`,
      user:       req.user.username,
      entityType: 'Material',
      entityId:   material.materialId,
    })

    res.json({ ok: true, material })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   DELETE /api/materials/:id
// @desc    Permanently delete archived material — Archive page
// @access  Private / Admin
// ─────────────────────────────────────────────────────────────────────────────
export const deleteMaterial = async (req, res, next) => {
  try {
    const material = await Material.findById(req.params.id)
    if (!material) return res.status(404).json({ ok: false, error: 'Material not found.' })
    if (!material.isArchived) return res.status(400).json({ ok: false, error: 'Only archived materials can be permanently deleted.' })

    await material.deleteOne()

    await logActivity({
      action:     'Deleted Material',
      detail:     `"${material.name}" was permanently deleted`,
      user:       req.user.username,
      entityType: 'Material',
      entityId:   material.materialId,
    })

    res.json({ ok: true, message: `"${material.name}" permanently deleted.` })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/materials/public/fabrics
// @desc    Get all active fabrics for public view (Job Order System)
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
export const getPublicFabrics = async (req, res, next) => {
  try {
    // 1. Fetch all materials with computed metrics (including status and effective stock)
    const allMetrics = await getInventoryMetrics()
    
    // 2. Filter for active fabrics that are NOT at critical level
    // We also ensure effectiveStock > 0 so we don't show items that are fully reserved
    const activeFabrics = allMetrics.filter(m => 
      m.category.toLowerCase() === 'fabric' && 
      m.status !== 'Critical' &&
      m.effectiveStock > 0
    )
    
    // 3. Map to simple format for Job Order System
    const fabrics = activeFabrics.map((m) => ({
      id: m.materialId,
      name: m.name,
    }))
    
    fabrics.sort((a, b) => a.name.localeCompare(b.name))
    res.json({ ok: true, fabrics })
  } catch (err) { next(err) }
}

