const User = require('../models/User');
const Contribution = require('../models/Contribution');

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findOne({ walletAddress: req.params.walletAddress, isActive: true }).select('-nonce');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const rank = await User.countDocuments({ reputationScore: { $gt: user.reputationScore }, isActive: true });
    const recent = await Contribution.find({ user: user._id, isDeleted: false, status: 'approved' }).sort({ createdAt: -1 }).limit(5);
    res.json({ success: true, data: { ...user.toJSON(), rank: rank + 1, recentContributions: recent } });
  } catch (err) { next(err); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { username, bio, avatar } = req.body;
    const updates = {};
    if (username) updates.username = username.trim();
    if (bio !== undefined) updates.bio = bio.trim();
    if (avatar) updates.avatar = avatar.trim();
    const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true, runValidators: true }).select('-nonce');
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};
