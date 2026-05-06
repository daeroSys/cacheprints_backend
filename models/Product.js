import mongoose from 'mongoose'

// ─── Product Model ────────────────────────────────────────────────────────────
// Covers: Products page (Products.jsx - in codebase, not in sidebar nav)
// Products are the catalog items used when creating orders
// Types: full-set | upper-only | lower-only

const productStockSchema = new mongoose.Schema(
  {
    XS:  { type: Number, default: 0, min: 0 },
    S:   { type: Number, default: 0, min: 0 },
    M:   { type: Number, default: 0, min: 0 },
    L:   { type: Number, default: 0, min: 0 },
    XL:  { type: Number, default: 0, min: 0 },
    XXL: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
)

const bomMaterialSchema = new mongoose.Schema(
  {
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
    materialName: { type: String, default: '' },
    usage: {
      XS:  { type: Number, default: 0, min: 0 },
      S:   { type: Number, default: 0, min: 0 },
      M:   { type: Number, default: 0, min: 0 },
      L:   { type: Number, default: 0, min: 0 },
      XL:  { type: Number, default: 0, min: 0 },
      XXL: { type: Number, default: 0, min: 0 },
    }
  },
  { _id: false }
)

const productSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      // Format: PRD-XXXXXXXX
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    type: {
      type: String,
      required: true,
      enum: ['Sleeveless Jersey', 'Tshirt Jersey', 'Shorts', 'Full Set', 'upper-only', 'lower-only', 'full-set'],
      default: 'Sleeveless Jersey',
    },
    bom: {
      type: [bomMaterialSchema],
      default: [],
    },

    // ── Pricing ────────────────────────────────────────────────────────────────
    upperPrice: {
      type: Number,
      default: 0,
      min: 0,
      // Price per piece for jersey/shirt (used when type != lower-only)
    },
    lowerPrice: {
      type: Number,
      default: 0,
      min: 0,
      // Price per piece for shorts/pants (used when type != upper-only)
    },
    bannerAvailable: {
      type: Boolean,
      default: false,
    },
    bannerPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Stock per size ─────────────────────────────────────────────────────────
    stock: {
      type: productStockSchema,
      default: () => ({ XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 }),
    },

    // ── Image ──────────────────────────────────────────────────────────────────
    image: {
      type: String, // base64 data URI (max ~500KB)
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
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
)

// ── Virtual: totalStock ───────────────────────────────────────────────────────
productSchema.virtual('totalStock').get(function () {
  if (!this.stock) return 0
  return Object.values(this.stock).reduce((s, v) => s + (Number(v) || 0), 0)
})

// ── Indexes ───────────────────────────────────────────────────────────────────
productSchema.index({ isArchived: 1 })
productSchema.index({ name: 'text', description: 'text' })

const Product = mongoose.model('Product', productSchema)
export default Product
