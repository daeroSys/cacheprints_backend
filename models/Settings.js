import mongoose from 'mongoose'

// ─── Settings Model ───────────────────────────────────────────────────────────
// Covers: Settings page
// Single-document collection — only ONE settings record exists per deployment
// Use Settings.findOne() to get it, upsert to update it

const settingsSchema = new mongoose.Schema(
  {
    shopName: {
      type: String,
      default: "CachePrint's",
      trim: true,
    },
    adminEmail: {
      type: String,
      default: 'admin@cacheprints.com',
      trim: true,
      lowercase: true,
    },
    version: {
      type: String,
      default: '5.0',
    },
    framework: {
      type: String,
      default: 'React + Vite',
    },
    database: {
      type: String,
      default: 'MongoDB',
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
)

const Settings = mongoose.model('Settings', settingsSchema)
export default Settings
