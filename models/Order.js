import mongoose from 'mongoose'

// ─── Order Model ──────────────────────────────────────────────────────────────
// Covers: Job Orders page, Production Tracking, Design Files, Dashboard
// Each order has rows (one per person in the team/customer)
// Each row has: number, name, upperType+size, lowerType+size

const orderRowSchema = new mongoose.Schema(
  {
    no: { type: String, default: '' },          // jersey number e.g. "10"
    name: { type: String, default: '' },         // player name
    upperType: { type: String, default: '' },    // T-Shirt, Jersey, Long-sleeved Jersey, etc.
    upperSize: { type: String, default: '' },    // XS, S, M, L, XL, XXL
    addOn: { type: String, default: '' },        // Add-Ons like 'Pocket'
    addOnPrice: { type: Number, default: 0 },
    lowerType: { type: String, default: '' },    // Jersey Short, Jogging Pants
    lowerSize: { type: String, default: '' },    // XS, S, M, L, XL, XXL
  },
  { _id: false }
)

const designFileSchema = new mongoose.Schema(
  {
    fileId: { type: String, required: true },    // df-<timestamp>
    name: { type: String, required: true },
    url: { type: String, default: '' },
    notes: { type: String, default: '' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      // Format: ORD-XXXXXXXX
    },
    customer: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    teamName: {
      type: String,
      trim: true,
      default: '',
    },
    productType: {
      type: String,
      trim: true,
      default: '',
    },
    externalRef: {
      type: String,
      trim: true,
      default: '',
    },
    fabricName: {
      type: String,
      trim: true,
      default: '',
    },
    contact: {
      type: String,
      trim: true,
      default: '',
    },
    design: {
      type: String,
      trim: true,
      default: '',
      // e.g. "Home Kit – Red & White Stripes"
    },
    cmyk: {
      c: { type: Number, default: 0.25 },
      m: { type: Number, default: 0.25 },
      y: { type: Number, default: 0.25 },
      k: { type: Number, default: 0.25 }
    },

    // ── Pricing ────────────────────────────────────────────────────────────────
    upperPrice: {
      type: Number,
      default: 450,
      min: 0,
    },
    lowerPrice: {
      type: Number,
      default: 450,
      min: 0,
    },

    // ── Rows (one per person/jersey) ───────────────────────────────────────────
    rows: {
      type: [orderRowSchema],
      default: [],
    },

    // ── Amounts ────────────────────────────────────────────────────────────────
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    payment: {
      type: String,
      enum: ['Paid', 'Partial', 'Unpaid'],
      default: 'Unpaid',
    },

    // ── Production ─────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: [
        'Order Received',
        'Designing',
        'Printing',
        'Heat Press',
        'Sewing',
        'Quality Check',
        'Ready for Pickup',
        'Completed',
      ],

      default: 'Order Received',
    },
    deadline: {
      type: Date,
      required: [true, 'Deadline is required'],
    },
    notes: {
      type: String,
      default: '',
    },

    // ── Design Files ───────────────────────────────────────────────────────────
    designFiles: {
      type: [designFileSchema],
      default: [],
    },
    designFileUrl: {
      type: String,
      default: '',
    },
    designFileName: {
      type: String,
      default: '',
    },

    // ── Completion ─────────────────────────────────────────────────────────────
    isCompleted: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },

    // ── Archive ────────────────────────────────────────────────────────────────
    isArchived: {
      type: Boolean,
      default: false,
    },
    archivedAt: {
      type: Date,
      default: null,
    },

    // ── Created by ─────────────────────────────────────────────────────────────
    coverageFactor: {
      type: Number,
      default: 0.25, // default 25%
    },
    createdBy: {
      type: String, // username
      default: '',
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
)

// ── Virtual: balance ──────────────────────────────────────────────────────────
orderSchema.virtual('balance').get(function () {
  return Math.max(0, this.totalAmount - this.paidAmount)
})

// ── Virtual: totalPieces ──────────────────────────────────────────────────────
orderSchema.virtual('totalPieces').get(function () {
  return this.rows.filter(r => r.upperType || r.lowerType).length
})

// ── Indexes ───────────────────────────────────────────────────────────────────
orderSchema.index({ isArchived: 1, isCompleted: 1 })
orderSchema.index({ status: 1 })
orderSchema.index({ deadline: 1 })
orderSchema.index({ customer: 'text', design: 'text', orderId: 'text' })

const Order = mongoose.model('Order', orderSchema)
export default Order
