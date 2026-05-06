import User from '../models/User.js'
import ActivityLog from '../models/ActivityLog.js'

const logActivity = async (data) => {
  try { await ActivityLog.create({ logId: `LOG-${Date.now()}`, timestamp: new Date(), ...data }) }
  catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/users
// @desc    Get all users (active + archived) — Users page
// @access  Private / Admin
// ─────────────────────────────────────────────────────────────────────────────
export const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 })
    res.json({ ok: true, users })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/users/active
// @desc    Get only active (non-archived) users
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const getActiveUsers = async (req, res, next) => {
  try {
    const users = await User.find({ isArchived: false }).sort({ createdAt: -1 })
    res.json({ ok: true, users })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/users/:id/archive
// @desc    Archive a user account — Users page delete button
// @access  Private / Admin
// ─────────────────────────────────────────────────────────────────────────────
export const archiveUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ ok: false, error: 'User not found.' })
    if (user.username === 'Admin')
      return res.status(403).json({ ok: false, error: 'The default Admin account cannot be archived.' })

    user.isArchived = true
    user.archivedAt = new Date()
    await user.save()

    await logActivity({
      action:     'Archived User',
      detail:     `@${user.username} (${user.name}) was archived by @${req.user.username}`,
      user:       req.user.username,
      entityType: 'User',
      entityId:   user.username,
    })

    res.json({ ok: true, message: `@${user.username} has been archived.` })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/users/:id/restore
// @desc    Restore an archived user — Archive page
// @access  Private / Admin
// ─────────────────────────────────────────────────────────────────────────────
export const restoreUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ ok: false, error: 'User not found.' })

    user.isArchived = false
    user.archivedAt = null
    await user.save()

    await logActivity({
      action:     'Restored User',
      detail:     `@${user.username} (${user.name}) was restored by @${req.user.username}`,
      user:       req.user.username,
      entityType: 'User',
      entityId:   user.username,
    })

    res.json({ ok: true, message: `@${user.username} has been restored.` })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/users/:id
// @desc    Update a user account — Users page
// @access  Private / Admin
// ─────────────────────────────────────────────────────────────────────────────
export const updateUser = async (req, res, next) => {
  try {
    const { name, email, contact, role } = req.body
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ ok: false, error: 'User not found.' })

    user.name = name ?? user.name
    user.email = email ?? user.email
    user.contact = contact ?? user.contact
    user.role = role ?? user.role
    
    await user.save()

    await logActivity({
      action:     'Updated User',
      detail:     `@${user.username} was updated by @${req.user.username}`,
      user:       req.user.username,
      entityType: 'User',
      entityId:   user.username,
    })

    res.json({ ok: true, user })
  } catch (err) { next(err) }
}
