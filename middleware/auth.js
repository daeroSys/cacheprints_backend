import jwt from 'jsonwebtoken'
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
    req.user = await User.findById(decoded.id).select('-password')
    if (!req.user || req.user.isArchived) {
      return res.status(401).json({ ok: false, error: 'User no longer exists or is archived.' })
    }

    next()
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'Not authorized. Invalid token.' })
  }
}

// ─── adminOnly ────────────────────────────────────────────────────────────────
// Must be used AFTER protect middleware.
// Blocks Staff users from Admin-only endpoints.
export const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'Admin') {
    return next()
  }
  return res.status(403).json({
    ok: false,
    error: 'Access denied. Administrators only.',
  })
}
