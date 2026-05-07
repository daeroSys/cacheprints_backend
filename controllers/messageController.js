import Message from '../models/Message.js'

// @desc    Get all messages for a specific order
// @route   GET /api/messages/:orderId
// @access  Protected
export const getMessagesByOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params
    // Fetch messages sorted by timestamp
    const messages = await Message.find({ orderId }).sort({ timestamp: 1 })
    
    // Map to the structure expected by the JOS frontend
    res.json(messages.map(m => ({
      id: m._id,
      orderId: m.orderId,
      senderId: m.senderId,
      senderName: m.senderName,
      senderRole: m.senderRole,
      message: m.message,
      timestamp: m.timestamp
    })))
  } catch (err) { next(err) }
}

// @desc    Post a new message to an order
// @route   POST /api/messages
// @access  Protected
export const postMessage = async (req, res, next) => {
  try {
    const { orderId, message, senderRole, senderName } = req.body
    
    if (!orderId || !message) {
      return res.status(400).json({ ok: false, error: 'Order ID and message are required' })
    }

    const newMessage = await Message.create({
      orderId,
      senderId: req.user._id,
      senderName: senderName || req.user.name || 'User',
      senderRole: senderRole || req.user.role || 'Customer',
      message
    })
    
    res.status(201).json(newMessage)
  } catch (err) { next(err) }
}
