import express from 'express'
import {
  getMaterials, getArchivedMaterials,
  addMaterial, updateMaterial,
  adjustStock, archiveMaterial,
  restoreMaterial, deleteMaterial,
  getPublicFabrics,
} from '../controllers/materialController.js'
import { protect, adminOnly } from '../middleware/auth.js'

const router = express.Router()

router.get   ('/public/fabrics', getPublicFabrics)
router.get   ('/',             protect, getMaterials)
router.get   ('/archived',     protect, adminOnly, getArchivedMaterials)
router.post  ('/',             protect, addMaterial)
router.put   ('/:id',          protect, updateMaterial)
router.patch ('/:id/adjust',   protect, adminOnly, adjustStock)
router.patch ('/:id/archive',  protect, adminOnly, archiveMaterial)
router.patch ('/:id/restore',  protect, adminOnly, restoreMaterial)
router.delete('/:id',          protect, adminOnly, deleteMaterial)

export default router
