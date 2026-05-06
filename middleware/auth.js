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
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Attach user (without password) to request
    // Since _id can be String or ObjectId, we try finding by decoded.id first,
    // and if not found and it's a valid ObjectId hex, we try as ObjectId.
    let user = await User.findById(decoded.id).select('-password')
    if (!user && mongoose.Types.ObjectId.isValid(decoded.id)) {
      user = await User.findOne({ _id: new mongoose.Types.ObjectId(decoded.id) }).select('-password')
    }

    if (!user || user.isArchived) {
      return res.status(401).json({ ok: false, error: 'User no longer exists or is archived.' })
    }
    req.user = user

    next()
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'Not authorized. Invalid token.' })
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
