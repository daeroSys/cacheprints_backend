import mongoose from 'mongoose'

// ─── Order Model ──────────────────────────────────────────────────────────────
// Covers: Job Orders page, Production Tracking, Design Files, Dashboard
// Each order has rows (one per person in the team/customer)
// Each row has: number, name, upperType+size, lowerType+size

const orderRowSchema = new mongoose.Schema(
  {
    no: { type: String, default: '' },          // jersey number e.g. "10"
    name: { type: String, default: '' },         // player name
    surname: { type: String, default: '' },      // JOS alias for name
    jerseyNumber: { type: String, default: '' }, // JOS alias for no
    upperType: { type: String, default: '' },
    upperSize: { type: String, default: '' },
    lowerType: { type: String, default: '' },
    lowerSize: { type: String, default: '' },
    size: { type: String, default: '' },         // JOS alias for upperSize/lowerSize
    id: { type: String, default: '' },           // JOS player ID
    addOn: { type: mongoose.Schema.Types.Mixed, default: '' }, // JOS has it as object
    addOnPrice: { type: Number, default: 0 },
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
    _id: {
      type: mongoose.Schema.Types.Mixed,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    orderId: {
      type: String,
      trim: true,
      // Optional for JOS, Required for IMS
    },
    userId: {
      type: String, // Firebase UID reference for JOS
      trim: true,
    },
    customer: {
      type: String,
      trim: true,
    },
    customerName: {
      type: String, // JOS alias for customer
      trim: true,
    },
    customerEmail: {
      type: String,
      trim: true,
      lowercase: true,
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
    user: {
      type: mongoose.Schema.Types.Mixed,
      ref: 'User',
      default: null,
    },
    customizationDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    items: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    orderType: {
      type: String,
      default: 'pickup',
    },
    shippingAddress: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
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
    phoneNumber: {
      type: String, // JOS alias for contact
      trim: true,
    },
    design: {
      type: String,
      trim: true,
      default: '',
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
      min: 0,
      default: 0,
    },
    totalPrice: {
      type: Number, // JOS alias for totalAmount
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
      default: 'Unpaid',
    },

    // ── Production ─────────────────────────────────────────────────────────────
    status: {
      type: String,
      default: 'Order Received',
    },
    productionPhase: {
      type: String, // JOS specific
      default: null,
    },
    deadline: {
      type: Date,
    },
    notes: {
      type: String,
      default: '',
    },

    // ── JOS Specific Fields ───────────────────────────────────────────────────
    finalDesignUrl: { type: String, default: null },
    qrCode: { type: String, default: null },
    qrCodeLabel: { type: String, default: null },
    paymentReceipt: { type: String, default: null },
    paymentReceiptDate: { type: Date, default: null },
    finalPaymentReceipt: { type: String, default: null },
    finalPaymentReceiptDate: { type: Date, default: null },
    lastMessageAt: { type: Date, default: null },
    unreadMessages: { type: Boolean, default: false },

    // ── Design Files (IMS) ────────────────────────────────────────────────────
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
    cancellationReason: {
      type: String,
      default: '',
    },
    cancelledAt: {
      type: Date,
      default: null,
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

    // ── Inventory/IMS specific ────────────────────────────────────────────────
    coverageFactor: {
      type: Number,
      default: 0.25, // default 25%
    },
    createdBy: {
      type: String, // username
      default: '',
    },
    cancellationReason: {
      type: String,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
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
