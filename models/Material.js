import mongoose from 'mongoose'

// ─── Material Model ───────────────────────────────────────────────────────────
// Covers: Materials page, Stock Levels page, Purchases page, Production page
// Categories: Fabric, Paper, Ink, Thread, Jersey, Packaging, Vinyl, Other (+ custom)

const materialSchema = new mongoose.Schema(
  {
    materialId: {
      type: String,
      unique: true,
      trim: true,
      // Optional: if missing, we generate one in pre-save or controller
    },
    name: {
      type: String,
      required: [true, 'Material name is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    unit: {
      type: String,
      required: true,
      enum: ['pcs', 'meters', 'ml', 'liters', 'sheets', 'spools', 'kg', 'grams'],
      default: 'pcs',
    },
    quantity: {
      type: Number,
      required: true,
      min: [0, 'Quantity cannot be negative'],
      default: 0,
    },
    costPerUnit: {
      type: Number,
      required: [true, 'Cost per unit is required'],
      min: [0, 'Cost cannot be negative'],
    },
    minQty: {
      type: Number,
      default: 0,
      min: [0, 'Min quantity cannot be negative'],
    },
    maxQty: {
      type: Number,
      default: 0,
      min: [0, 'Max quantity cannot be negative'],
    },
    leadTime: {
      type: Number,
      default: 7,
      min: [0, 'Lead time cannot be negative'],
      // Supplier lead time in days
    },
    reorderQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Reorder quantity cannot be negative'],
    },
    link: {
      type: String,
      trim: true,
      default: '',
      // Online shop link (Shopee, Lazada, etc.)
    },
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

// ── Pre-save: auto-generate materialId if missing ─────────────────────────────
materialSchema.pre('save', function (next) {
  if (!this.materialId) {
    this.materialId = `MAT-${Math.floor(Math.random() * 10000000).toString().padStart(8, '0')}`
  }
  if (this.isModified('quantity')) {
    this.quantity = Math.round(this.quantity * 100) / 100
  }
  next()
})

// ── Virtual: isLowStock ───────────────────────────────────────────────────────
materialSchema.virtual('isLowStock').get(function () {
  return this.quantity <= this.minQty
})

// ── Virtual: inventoryValue ───────────────────────────────────────────────────
materialSchema.virtual('inventoryValue').get(function () {
  return this.quantity * this.costPerUnit
})

// ── Index for fast search ─────────────────────────────────────────────────────
materialSchema.index({ name: 'text', category: 'text' })
materialSchema.index({ isArchived: 1 })
materialSchema.index({ category: 1 })

const Material = mongoose.model('Material', materialSchema)
export default Material
