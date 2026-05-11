const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  from: { type: String, required: true }, // wallet address
  to:   { type: String, required: true }, // wallet address
  text: { type: String, required: true, maxlength: 1000, trim: true },
  read: { type: Boolean, default: false },
}, { timestamps: true });

MessageSchema.index({ from: 1, to: 1, createdAt: -1 });
MessageSchema.index({ to: 1, read: 1 });

// Get conversation between two wallets
MessageSchema.statics.getConversation = function(walletA, walletB, limit = 50) {
  return this.find({
    $or: [
      { from: walletA, to: walletB },
      { from: walletB, to: walletA },
    ]
  }).sort({ createdAt: 1 }).limit(limit);
};

// Get all conversations for a user (latest message per contact)
MessageSchema.statics.getInbox = async function(wallet) {
  const msgs = await this.aggregate([
    { $match: { $or: [{ from: wallet }, { to: wallet }] } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: {
          $cond: [{ $eq: ['$from', wallet] }, '$to', '$from']
        },
        lastMessage: { $first: '$$ROOT' },
        unread: { $sum: { $cond: [{ $and: [{ $eq: ['$to', wallet] }, { $eq: ['$read', false] }] }, 1, 0] } }
      }
    },
    { $sort: { 'lastMessage.createdAt': -1 } },
    { $limit: 30 }
  ]);
  return msgs;
};

module.exports = mongoose.model('Message', MessageSchema);
