import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
  orderId: {
    type: String, // Matches JOS Order ID format (ORD-XXXXXX)
    required: true,
    index: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderName: {
    type: String,
    required: true
  },
  senderRole: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
})

// Add virtual 'id' for frontend compatibility if needed, 
// though we can map it in the controller.
messageSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

messageSchema.set('toJSON', {
  virtuals: true
});

const Message = mongoose.model('Message', messageSchema)
export default Message
