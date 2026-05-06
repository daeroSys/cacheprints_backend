import Material from '../models/Material.js'
import Transaction from '../models/Transaction.js'
import Order from '../models/Order.js'
import Product from '../models/Product.js'

// Cache or memoize average daily usage? Let's just compute dynamically for now.
export const getInventoryMetrics = async () => {
  try {
    // 1. Fetch all active materials
    const materials = await Material.find({ isArchived: false }).lean()
    
    // 2. Compute Average Daily Usage (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const usageAgg = await Transaction.aggregate([
      { 
        $match: { 
          type: 'Stock-Out', 
          date: { $gte: thirtyDaysAgo } 
        } 
      },
      { $unwind: '$items' },
      { 
        $group: { 
          _id: '$items.materialId', 
          totalUsed: { $sum: { $abs: '$items.qty' } } 
        } 
      }
    ])
    
    const usageMap = {}
    usageAgg.forEach(u => {
      // average daily usage over 30 days
      usageMap[u._id.toString()] = u.totalUsed / 30 
    })

    // 3. Compute Reserved Stock
    // Fetch pending orders
    const pendingOrders = await Order.find({ 
      isCompleted: false, 
      isArchived: false 
    }).lean()

    // Fetch products to get BOM
    const products = await Product.find({ isArchived: false }).lean()
    
    // Create a map to quickly find BOM by product name or type
    // Assuming order row upperType/lowerType matches product name or type
    const productBoms = {}
    products.forEach(p => {
      productBoms[p.type] = p.bom || [] // mapping by type
      productBoms[p.name] = p.bom || [] // mapping by name just in case
    })

    const reservedMap = {}
    
    pendingOrders.forEach(order => {
      (order.rows || []).forEach(row => {
        // Handle Upper
        if (row.upperType && row.upperSize) {
          const bom = productBoms[row.upperType]
          if (bom) {
            bom.forEach(b => {
              const qty = b.usage[row.upperSize] || 0
              if (qty > 0) {
                const mid = b.materialId.toString()
                reservedMap[mid] = (reservedMap[mid] || 0) + qty
              }
            })
          }
        }
        // Handle Lower
        if (row.lowerType && row.lowerSize) {
          const bom = productBoms[row.lowerType]
          if (bom) {
            bom.forEach(b => {
              const qty = b.usage[row.lowerSize] || 0
              if (qty > 0) {
                const mid = b.materialId.toString()
                reservedMap[mid] = (reservedMap[mid] || 0) + qty
              }
            })
          }
        }
      })
    })

    // 4. Compute final metrics per material
    const metrics = materials.map(m => {
      const mid = m._id.toString()
      const avgDailyUsage = usageMap[mid] || 0
      const reservedStock = reservedMap[mid] || 0
      const effectiveStock = m.quantity - reservedStock
      
      const leadTime = m.leadTime || 7
      const reorderQty = m.reorderQuantity || 0
      
      // Dynamic Thresholds
      const reorderLevel = avgDailyUsage * leadTime
      const minLevel = m.minQty || (avgDailyUsage * (leadTime * 0.5)) // fallback buffer
      const maxLevel = m.maxQty || (reorderLevel + reorderQty - (avgDailyUsage * 0.5 * leadTime))
      
      // Status Logic
      let status = 'Healthy'
      if (effectiveStock <= minLevel) status = 'Critical'
      else if (effectiveStock <= reorderLevel) status = 'Low'
      else if (maxLevel > 0 && effectiveStock > maxLevel) status = 'Overstock'

      return {
        ...m,
        avgDailyUsage,
        reservedStock,
        effectiveStock,
        reorderLevel,
        minLevel,
        maxLevel,
        status
      }
    })

    return metrics

  } catch (error) {
    console.error('Error computing inventory metrics:', error)
    return []
  }
}
