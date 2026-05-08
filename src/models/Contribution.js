const mongoose = require('mongoose');

const POINTS = { thread: 10, design: 15, code: 20, dao: 10, event: 5 };

const ContributionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  walletAddress: { type: String, required: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  type: { type: String, required: true, enum: Object.keys(POINTS) },
  description: { type: String, maxlength: 1000, default: '' },
  proofLink: { type: String, required: true, trim: true },
  points: { type: Number },
  status: { type: String, enum: ['pending','approved','rejected'], default: 'approved' },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

ContributionSchema.pre('save', function (next) {
  if (this.isNew || this.isModified('type')) {
    this.points = POINTS[this.type] || 0;
  }
  next();
});

ContributionSchema.statics.POINTS = POINTS;
ContributionSchema.statics.TYPES = Object.keys(POINTS);

module.exports = mongoose.model('Contribution', ContributionSchema);
