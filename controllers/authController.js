import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import ActivityLog from '../models/ActivityLog.js'

// ── Helper: generate JWT ──────────────────────────────────────────────────────
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })

// ── Helper: log activity ──────────────────────────────────────────────────────
const logActivity = async ({ action, detail, user, entityType = 'User', entityId = '', changes = null }) => {
  try {
    await ActivityLog.create({
      logId:      `LOG-${Date.now()}`,
      action, detail, user, entityType, entityId, changes,
      timestamp:  new Date(),
    })
  } catch (_) { /* non-critical — never crash on log failure */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/login
// @desc    Login with username + password → returns JWT + user
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
export const login = async (req, res, next) => {
  try {
    const { username, password } = req.body
    if (!username || !password)
      return res.status(400).json({ ok: false, error: 'Please enter username and password.' })

    const user = await User.findOne({
      $or: [
        { username: username.trim() },
        { email: username.trim().toLowerCase() }
      ]
    }).select('+password')
    if (!user)
      return res.status(401).json({ ok: false, error: 'Invalid username or password.' })
    if (user.isArchived)
      return res.status(401).json({ ok: false, error: 'This account has been archived. Contact your administrator.' })

    const isMatch = await user.matchPassword(password)
    if (!isMatch) {
      console.warn(`[AUTH] Failed login attempt for user: ${username} (Incorrect Password)`)
      return res.status(401).json({ ok: false, error: 'Invalid username or password.' })
    }

    const token = generateToken(user._id)

    res.json({
      ok: true,
      token,
      user: {
        id:         user._id,
        username:   user.username,
        name:       user.name,
        email:      user.email,
        contact:    user.contact,
        phone:      user.phone,
        role:       user.role,
        approvedBy: user.approvedBy,
        createdAt:  user.createdAt,
      },
    })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/signup
// @desc    Create new account (requires admin approval credentials)
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
export const signup = async (req, res, next) => {
  try {
    const { username, name, email, contact, role, password, adminUsername, adminPassword } = req.body

    // ── First Admin Bypass ──
    // If no users exist yet, allow creating the first one without approval
    const userCount = await User.countDocuments()
    let finalRole = role || 'Staff'
    let approvedBy = 'Admin Approval'

    if (userCount === 0) {
      finalRole = 'Admin' // First user is always Admin
      approvedBy = 'System (Initial Setup)'
    } else {
      // Standard Admin Approval Check
      const admin = await User.findOne({ username: adminUsername, role: 'Admin', isArchived: false }).select('+password')
      if (!admin)
        return res.status(403).json({ ok: false, error: 'Admin not found or account is archived.' })
      const adminMatch = await admin.matchPassword(adminPassword)
      if (!adminMatch)
        return res.status(403).json({ ok: false, error: 'Incorrect admin password.' })
      approvedBy = admin.username
    }

    // Check username uniqueness
    const exists = await User.findOne({ username: username.trim() })
    if (exists)
      return res.status(400).json({ ok: false, error: 'Username already taken.' })

    const user = await User.create({
      username: username.trim(),
      password,
      name:       name.trim(),
      email:      email.trim().toLowerCase(),
      contact:    contact?.trim() || '',
      role:       finalRole,
      approvedBy: approvedBy,
    })

    await logActivity({
      action:     'Created User',
      detail:     `New account @${user.username} (${user.role}) approved by @${admin.username}`,
      user:       admin.username,
      entityId:   user.username,
      changes:    { username: user.username, name: user.name, role: user.role, email: user.email },
    })

    res.status(201).json({ ok: true, message: 'Account created successfully. You can now log in.' })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/verify-admin
// @desc    Verify an admin's credentials (used in Signup approval modal)
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
export const verifyAdmin = async (req, res, next) => {
  try {
    const { username, password } = req.body
    const admin = await User.findOne({ username: username?.trim(), role: 'Admin', isArchived: false }).select('+password')
    if (!admin)
      return res.status(403).json({ ok: false, error: 'Admin not found.' })
    const match = await admin.matchPassword(password)
    if (!match)
      return res.status(403).json({ ok: false, error: 'Incorrect admin password.' })
    res.json({ ok: true, admin: { username: admin.username, name: admin.name } })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/auth/me
// @desc    Get the currently logged-in user's data
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
    res.json({ ok: true, user })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/auth/update-profile
// @desc    Update name, email, contact (Account page)
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const updateProfile = async (req, res, next) => {
  try {
    const { name, email, contact, phone } = req.body
    const user = await User.findById(req.user._id)

    const before = { name: user.name, email: user.email, contact: user.contact, phone: user.phone }
    user.name    = name?.trim()    || user.name
    user.email   = email?.trim()   || user.email
    user.contact = contact?.trim() || user.contact
    user.phone   = phone?.trim()   || user.phone
    await user.save()

    await logActivity({
      action:   'Updated Profile',
      detail:   `@${user.username} updated their profile`,
      user:     user.username,
      entityId: user.username,
      changes:  {
        name:    { from: before.name,    to: user.name    },
        email:   { from: before.email,   to: user.email   },
        contact: { from: before.contact, to: user.contact },
      },
    })

    res.json({ ok: true, user })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/auth/change-password
// @desc    Change password (Account page → Change Password modal)
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body
    const user = await User.findById(req.user._id).select('+password')

    const isMatch = await user.matchPassword(oldPassword)
    if (!isMatch)
      return res.status(400).json({ ok: false, error: 'Current password is incorrect.' })
    if (newPassword.length < 6)
      return res.status(400).json({ ok: false, error: 'New password must be at least 6 characters.' })
    if (!/[A-Z]/.test(newPassword))
      return res.status(400).json({ ok: false, error: 'New password must contain at least one uppercase letter.' })
    if (!/[0-9]/.test(newPassword))
      return res.status(400).json({ ok: false, error: 'New password must contain at least one number.' })

    user.password = newPassword
    await user.save()

    await logActivity({
      action:   'Changed Password',
      detail:   `@${user.username} changed their password`,
      user:     user.username,
      entityId: user.username,
    })

    res.json({ ok: true, message: 'Password changed successfully.' })
  } catch (err) { next(err) }
}
