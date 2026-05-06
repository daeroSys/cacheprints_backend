import mongoose from 'mongoose'

// ─── ActivityLog Model ────────────────────────────────────────────────────────
// Covers: Activity Log page
// Auto-created on every significant system action
// Stores a diff (before/after) for updates, or a snapshot for creates/deletes

const activityLogSchema = new mongoose.Schema(
  {
    logId: {
      type: String,
      required: true,
      unique: true,
      // Format: LOG-XXXXXXXX or timestamp-based
    },
    action: {
      type: String,
      required: true,
      trim: true,
      // e.g. "Added Material", "Updated Order", "Archived User", "Restored Order"
    },
    detail: {
      type: String,
      required: true,
      trim: true,
      // e.g. "Sublimation Fabric (White) was added to materials"
    },
    user: {
      type: String,
      required: true,
      // username of who performed the action
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      // For updates: { fieldName: { from: oldValue, to: newValue }, ... }
      // For creates: { fieldName: value, ... } snapshot
      // For deletes: null or snapshot of deleted record
    },
    entityType: {
      type: String,
      enum: [
        'User',
        'Material',
        'Order',
        'Purchase',
        'Transaction',
        'Product',
        'Stock',
        'System',
      ],
      default: 'System',
    },
    entityId: {
      type: String,
      default: '',
      // The ID of the affected record (e.g. ORD-001, MAT-002)
    },
  },
  {
    timestamps: false, // we manage timestamp ourselves
  }
)

// ── Indexes ───────────────────────────────────────────────────────────────────
activityLogSchema.index({ timestamp: -1 })
activityLogSchema.index({ user: 1 })
activityLogSchema.index({ entityType: 1 })

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema)
export default ActivityLog
