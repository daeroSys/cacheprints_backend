import mongoose from 'mongoose'

// ─── Purchase Model ───────────────────────────────────────────────────────────
// Covers: Purchases page
// A purchase can have multiple items (materials) from different suppliers
// Two states: To Receive (isReceived: false) | Completed (isReceived: true)

const purchaseItemSchema = new mongoose.Schema(
  {
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Material',
      required: true,
    },
    materialRefId: {
      type: String, // stores the MAT-XXXXXXXX string ID for display
      default: '',
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    unit: {
      type: String,
      default: '',
    },
    supplier: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
    },
    qtyOrdered: {
      type: Number,
      required: true,
      min: [1, 'Quantity ordered must be at least 1'],
    },
    qtyReceived: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCost: {
      type: Number,
      required: true,
      min: [0, 'Total cost cannot be negative'],
    },
  },
  { _id: false }
)

const purchaseSchema = new mongoose.Schema(
  {
    purchaseId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      // Format: PUR-XXXXXXXX
    },
    items: {
      type: [purchaseItemSchema],
      required: true,
      validate: {
        validator: (v) => v.length > 0,
        message: 'At least one item is required',
      },
    },
    overallCost: {
      type: Number,
      required: true,
      min: 0,
      // Sum of all item totalCost values
    },
    date: {
      type: Date,
      required: [true, 'Purchase date is required'],
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    receiptImage: {
      type: String, // base64 data URI
      default: null,
    },

    // ── Receive fields ─────────────────────────────────────────────────────────
    isReceived: {
      type: Boolean,
      default: false,
    },
    receivedAt: {
      type: Date,
      default: null,
    },
    receiveReason: {
      type: String,
      default: '',
      // Notes entered when marking as received
    },

    // ── Created by ─────────────────────────────────────────────────────────────
    createdBy: {
      type: String, // username
      default: '',
    },

    // ── Archive fields ─────────────────────────────────────────────────────────
    isArchived: {
      type: Boolean,
      default: false,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
)

// ── Indexes ───────────────────────────────────────────────────────────────────
purchaseSchema.index({ isReceived: 1 })
purchaseSchema.index({ date: -1 })
purchaseSchema.index({ receivedAt: -1 })

const Purchase = mongoose.model('Purchase', purchaseSchema)
export default Purchase
