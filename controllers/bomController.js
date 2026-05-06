// ─── BOM Controller ─────────────────────────────────────────────────────────
// Exposes BOM config and computation endpoints.

import { BOM_PRODUCTS, SIZE_FACTORS, BOM_ADDONS } from '../utils/bomConfig.js'
import { computeBom, computeOrderBom, findBomProduct } from '../utils/bomCalculator.js'

// @route   GET /api/bom/products
// @desc    Get all BOM product definitions
// @access  Private
export const getBomProducts = (req, res) => {
  res.json({ ok: true, products: BOM_PRODUCTS })
}

// @route   GET /api/bom/size-factors
// @desc    Get size factor table
// @access  Private
export const getSizeFactors = (req, res) => {
  res.json({ ok: true, sizeFactors: SIZE_FACTORS })
}

// @route   GET /api/bom/addons
// @desc    Get available add-ons
// @access  Private
export const getAddons = (req, res) => {
  res.json({ ok: true, addons: BOM_ADDONS })
}

// @route   GET /api/bom/config
// @desc    Get full BOM config (products + sizes + addons) in one call
// @access  Private
export const getFullBomConfig = (req, res) => {
  res.json({
    ok: true,
    products: BOM_PRODUCTS,
    sizeFactors: SIZE_FACTORS,
    addons: BOM_ADDONS
  })
}

// @route   POST /api/bom/compute
// @desc    Compute material usage for a single piece
// @access  Private
// @body    { productName, size, coverageFactor?, addOns? }
export const computeSingleBom = (req, res) => {
  const { productName, size, coverageFactor, addOns } = req.body
  const result = computeBom({ productName, size, coverageFactor, addOns })
  if (!result) {
    return res.status(404).json({ ok: false, error: `Product "${productName}" not found in BOM.` })
  }
  res.json({ ok: true, usage: result })
}

// @route   POST /api/bom/compute-order
// @desc    Compute total material usage for an entire order
// @access  Private
// @body    { rows, productType, cmyk? }
export const computeOrderBomEndpoint = (req, res) => {
  const { rows, productType, cmyk } = req.body
  const result = computeOrderBom({ rows, productType, cmyk })
  res.json({ ok: true, ...result })
}
