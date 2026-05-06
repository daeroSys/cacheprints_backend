import express from 'express'
import { login, signup, verifyAdmin, getMe, updateProfile, changePassword } from '../controllers/authController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

router.post('/login',           login)
router.post('/signup',          signup)
router.post('/verify-admin',    verifyAdmin)
router.get ('/me',              protect, getMe)
router.put ('/update-profile',  protect, updateProfile)
router.put ('/change-password', protect, changePassword)

export default router
