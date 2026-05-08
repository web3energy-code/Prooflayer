const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, unique: true, trim: true },
  username: { type: String, trim: true, maxlength: 32, default: 'Anonymous' },
  bio: { type: String, maxlength: 280, default: '' },
  avatar: { type: String, default: '' },
  reputationScore: { type: Number, default: 0, min: 0 },
  scoreBreakdown: {
    thread: { type: Number, default: 0 },
    design: { type: Number, default: 0 },
    code: { type: Number, default: 0 },
    dao: { type: Number, default: 0 },
    event: { type: Number, default: 0 },
  },
  badges: { type: Array, default: [] },
  contributionCount: { type: Number, default: 0 },
  nonce: { type: String, default: () => Math.floor(Math.random() * 1000000).toString() },
  isActive: { type: Boolean, default: true },
  lastSeen: { type: Date, default: Date.now },
}, { timestamps: true });

UserSchema.virtual('shortWallet').get(function () {
  return this.walletAddress.slice(0, 4) + '...' + this.walletAddress.slice(-4);
});

UserSchema.methods.refreshNonce = function () {
  this.nonce = Math.floor(Math.random() * 1000000).toString();
};

UserSchema.statics.getLeaderboard = async function (filter, limit, skip) {
  return this.find({ isActive: true, reputationScore: { $gt: 0 }, ...filter })
    .sort({ reputationScore: -1 })
    .skip(skip || 0)
    .limit(limit || 50)
    .select('walletAddress username bio avatar reputationScore scoreBreakdown badges contributionCount createdAt');
};

UserSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('User', UserSchema);
