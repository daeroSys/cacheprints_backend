import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import User from '../models/User.js'

// ─── protect ──────────────────────────────────────────────────────────────────
// Verifies the JWT token sent in the Authorization header.
// Attaches the full user object to req.user for downstream use.
export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, error: 'Not authorized. No token provided.' })
    }

    const token = authHeader.split(' ')[1]
    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET)
    } catch (err) {
      console.error(`[AUTH] Token Verification Error: ${err.message}`)
      return res.status(401).json({ ok: false, error: 'Not authorized. Invalid token.' })
    }

    // Attach user (without password) to request
    let user
    try {
      user = await User.findById(decoded.id).select('-password')
      if (!user && mongoose.Types.ObjectId.isValid(decoded.id)) {
        user = await User.findOne({ _id: new mongoose.Types.ObjectId(decoded.id) }).select('-password')
      }
    } catch (dbErr) {
      console.error(`[AUTH] Database Error during protection: ${dbErr.message} (ReadyState: ${mongoose.connection.readyState})`)
      return next(dbErr) // Pass to global error handler (500)
    }

    if (!user || user.isArchived) {
      console.warn(`[AUTH] Protection failed: User not found or archived. ID: ${decoded.id}`)
      return res.status(401).json({ ok: false, error: 'User no longer exists or is archived.' })
    }
    req.user = user

    next()
  } catch (err) {
    next(err)
  }
}

// ─── adminOnly ────────────────────────────────────────────────────────────────
// Must be used AFTER protect middleware.
// Blocks Staff users from Admin-only endpoints.
export const adminOnly = (req, res, next) => {
  const role = req.user?.role?.toLowerCase()
  if (role === 'admin') {
    return next()
  }
  return res.status(403).json({
    ok: false,
    error: 'Access denied. Administrators only.',
  })
}
