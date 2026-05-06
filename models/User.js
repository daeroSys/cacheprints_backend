import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

// ─── User Model ───────────────────────────────────────────────────────────────
// Covers: Login, Signup, Account, Users pages
// Roles: Admin (full access) | Staff (limited access)

const userSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    username: {
      type: String,
      unique: true,
      sparse: true, // allow null/missing values while keeping unique index
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      match: [/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores allowed'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // never returned in queries by default
    },
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address'],
    },
    contact: {
      type: String,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    role: {
      type: String,
      enum: ['Admin', 'Staff', 'Customer', 'customer', 'staff', 'admin'],
      default: 'Customer',
    },
    approvedBy: {
      type: String, // username of the admin who approved
      default: null,
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

// ── Hash password before saving ──────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)
  next()
})

// ── Instance method: compare password ────────────────────────────────────────
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password)
}

// ── Virtual: avatarInitials ───────────────────────────────────────────────────
userSchema.virtual('avatarInitials').get(function () {
  return (this.name || this.username || 'U').slice(0, 2).toUpperCase()
})

const User = mongoose.model('User', userSchema)
export default User
