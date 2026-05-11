const mongoose = require('mongoose');

// Stores likes AND comments for contributions
const ReactionSchema = new mongoose.Schema({
  contributionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contribution', required: true, index: true },
  wallet: { type: String, required: true }, // who did it
  username: { type: String, default: '' },
  type: { type: String, enum: ['like', 'comment'], required: true },
  text: { type: String, maxlength: 500, trim: true }, // only for comments
}, { timestamps: true });

// One like per wallet per contribution
ReactionSchema.index({ contributionId: 1, wallet: 1, type: 1 }, { unique: false });

module.exports = mongoose.model('Reaction', ReactionSchema);
