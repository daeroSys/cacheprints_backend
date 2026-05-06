import express from 'express'
import {
  getBomProducts,
  getSizeFactors,
  getAddons,
  getFullBomConfig,
  computeSingleBom,
  computeOrderBomEndpoint,
} from '../controllers/bomController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

router.get ('/products',      protect, getBomProducts)
router.get ('/size-factors',  protect, getSizeFactors)
router.get ('/addons',        protect, getAddons)
router.get ('/config',        protect, getFullBomConfig)
router.post('/compute',       protect, computeSingleBom)
router.post('/compute-order', protect, computeOrderBomEndpoint)

export default router
