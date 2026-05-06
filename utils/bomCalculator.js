// ─── BOM Calculator ─────────────────────────────────────────────────────────
// Computes actual material usage for a single piece given:
//   - product name (must match BOM_PRODUCTS)
//   - size (must match SIZE_FACTORS)
//   - coverageFactor (0-1, derived from CMYK ink coverage)
//   - addOns (array of add-on names from BOM_ADDONS)

import { BOM_PRODUCTS, SIZE_FACTORS, BOM_ADDONS } from './bomConfig.js'

/**
 * Look up the base BOM entry for a product name (case-insensitive).
 * Returns null if not found.
 */
export function findBomProduct(productName) {
  if (!productName) return null
  const needle = productName.trim().toLowerCase()
  
  // 1. Try exact (after trim/lowercase)
  let found = BOM_PRODUCTS.find(p => p.name.toLowerCase() === needle)
  if (found) return found

  // 2. Try partial match (needle contains product name or vice versa)
  // Sort by length descending to match more specific names first (e.g. "Basketball Jersey Set" before "Basketball Jersey")
  const sortedByLength = [...BOM_PRODUCTS].sort((a, b) => b.name.length - a.name.length)
  found = sortedByLength.find(p => {
    const pName = p.name.toLowerCase()
    return needle.includes(pName) || pName.includes(needle)
  })
  if (found) return found

  // 3. Try stripping parentheses e.g. "Volleyball Jersey Set (Sleeveless)" -> "Volleyball Jersey Set"
  const stripped = needle.replace(/\s*\(.*?\)\s*/g, '').trim()
  if (stripped && stripped !== needle) {
    found = BOM_PRODUCTS.find(p => p.name.toLowerCase() === stripped)
    if (found) return found
  }

  return null
}

/**
 * Compute the material usage for ONE piece.
 *
 * @param {Object}   opts
 * @param {string}   opts.productName    – must match a BOM_PRODUCTS entry
 * @param {string}   opts.size           – e.g. "M", "XL", "3XL"
 * @param {number}   [opts.coverageFactor=1] – ink coverage multiplier (0‑1)
 * @param {string[]} [opts.addOns=[]]    – names from BOM_ADDONS
 *
 * @returns {{ fabric: number, ink: number, thread: number, paper: number } | null}
 */
export function computeBom({ productName, size, coverageFactor = 1, addOns = [] }) {
  const product = findBomProduct(productName)
  if (!product) return null

  const sf = SIZE_FACTORS[size] ?? SIZE_FACTORS['M']  // default to M if unknown size
  const cf = Number(coverageFactor) || 1

  // Sum flat add-on contributions
  let addFabric = 0
  let addThread = 0
  let addPaper  = 0
  for (const name of addOns) {
    const ao = BOM_ADDONS[name]
    if (!ao) continue
    addFabric += ao.fabric
    addThread += ao.thread
    addPaper  += ao.paper
  }

  const baseFabric = product.fabric * sf
  const basePaper  = baseFabric
  const addOnPaper = addPaper

  const fabric = baseFabric + addFabric
  const ink    = product.ink * sf * cf
  const thread = (product.thread * sf) + addThread
  const paper  = fabric  // paper always equals computed fabric

  // --- Discrete items (Others category) ---
  const lowerName = productName.toLowerCase()
  let waistCord = 0
  if (lowerName.includes('set') || lowerName.includes('shorts')) {
    waistCord = 1
  }

  let buttons = 0
  if (lowerName.includes('poloshirt')) {
    buttons = 3
  } else if (lowerName.includes('chinese collar longsleeve')) {
    buttons = 12
  } else if (lowerName.includes('chinese collar')) {
    buttons = 8
  }

  return {
    fabric: Math.round(fabric * 1000) / 1000,
    ink:    Math.round(ink * 1000) / 1000,
    thread: Math.round(thread * 1000) / 1000,
    paper:  Math.round(paper * 1000) / 1000,
    basePaper: Math.round(basePaper * 1000) / 1000,
    addOnPaper: Math.round(addOnPaper * 1000) / 1000,
    waistCord,
    buttons
  }
}


/**
 * Compute total material usage for an entire order.
 * Accepts the order's `rows` array plus the order-level productType & cmyk.
 *
 * @param {Object}   opts
 * @param {Array}    opts.rows           – order rows (each has upperType, upperSize, addOn)
 * @param {string}   opts.productType    – fallback product type from order level
 * @param {Object}   [opts.cmyk]         – { c, m, y, k } each 0‑1
 * @param {number}   [opts.coverageFactor] – Optional override for ink coverage
 *
 * @returns {{ totals: { fabric, ink, thread, paper }, perRow: Array }}
 */
export function computeOrderBom({ rows = [], productType = '', cmyk = {}, coverageFactor: overrideCF }) {
  // Derive coverage factor from CMYK if not overridden
  const { c = 0.25, m = 0.25, y = 0.25, k = 0.25 } = cmyk
  const coverageFactor = overrideCF !== undefined ? overrideCF : (c + m + y + k) / 4

  const totals = { fabric: 0, ink: 0, thread: 0, paper: 0, paper36: 0, paper44: 0, waistCord: 0, buttons: 0 }
  const perRow = []

  for (const row of rows) {
    const name = row.upperType || productType
    const size = row.upperSize || 'M'
    const addOns = row.addOn ? [row.addOn] : []

    const usage = computeBom({ productName: name, size, coverageFactor, addOns })

    perRow.push({
      no: row.no,
      name: row.name,
      product: name,
      size,
      addOns,
      usage  // null if product not found in BOM
    })

    if (usage) {
      totals.fabric += usage.fabric
      totals.ink    += usage.ink
      totals.thread += usage.thread
      totals.paper  += usage.paper
      totals.waistCord += usage.waistCord
      totals.buttons   += usage.buttons


      // Determine paper width (36in vs 44in)
      // Shorts and ALL Add-ons -> 36in
      // Jersey or Jersey Set -> 44in
      const lowerName = name.toLowerCase()
      
      // Always put add-ons in 36in category
      totals.paper36 += usage.addOnPaper

      // Base product category depends on name
      if (lowerName.includes('shorts')) {
        totals.paper36 += usage.basePaper
      } else if (lowerName.includes('jersey')) {
        totals.paper44 += usage.basePaper
      } else {
        // Fallback: Default to 44in for unknown large items
        totals.paper44 += usage.basePaper 
      }
    }
  }

  // Round totals
  totals.fabric  = Math.round(totals.fabric * 1000) / 1000
  totals.ink     = Math.round(totals.ink * 1000) / 1000
  totals.thread  = Math.round(totals.thread * 1000) / 1000
  totals.paper   = Math.round(totals.paper * 1000) / 1000
  totals.paper36 = Math.round(totals.paper36 * 1000) / 1000
  totals.paper44 = Math.round(totals.paper44 * 1000) / 1000

  return { totals, perRow }
}
