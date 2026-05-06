import mongoose from 'mongoose'

// ─── Transaction Model ────────────────────────────────────────────────────────
// Covers: Inventory Transactions page
// Auto-created by the system — NEVER manually created by users
// Types:
//   Stock-In    → when a Purchase is marked as Received
//   Stock-Out   → when materials are consumed during Production stages
//   Adjustment  → when stock is manually adjusted in Stock Levels page

const transactionItemSchema = new mongoose.Schema(
  {
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Material',
      required: true,
    },
    materialRefId: {
      type: String, // MAT-XXXXXXXX for display
      default: '',
    },
    materialName: {
      type: String,
      required: true,
    },
    qty: {
      type: Number,
      required: true,
      // Positive = added, Negative = consumed/removed
    },
    unit: {
      type: String,
      default: '',
    },
  },
  { _id: false }
)

const transactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      // Format: TXN-XXXXXXXX
    },
    type: {
      type: String,
      required: true,
      enum: ['Stock-In', 'Stock-Out', 'Adjustment'],
    },
    items: {
      type: [transactionItemSchema],
      required: true,
      validate: {
        validator: (v) => v.length > 0,
        message: 'At least one item is required',
      },
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    ref: {
      type: String,
      default: '',
      // Reference ID — e.g. PUR-001 for Stock-In, ORD-001 for Stock-Out
    },
    notes: {
      type: String,
      default: '',
    },
    createdBy: {
      type: String,
      default: 'System',
      // 'System' for auto-created; username for manual adjustments
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
)

// ── Pre-save: round quantities to 2 decimal places ───────────────────────────
transactionSchema.pre('save', function (next) {
  if (this.items && this.items.length > 0) {
    this.items.forEach((item) => {
      if (item.qty !== undefined) {
        item.qty = Math.round(item.qty * 100) / 100
      }
    })
  }
  next()
})

// ── Indexes ───────────────────────────────────────────────────────────────────
transactionSchema.index({ type: 1 })
transactionSchema.index({ date: -1 })
transactionSchema.index({ ref: 1 })

const Transaction = mongoose.model('Transaction', transactionSchema)
export default Transaction
