const User = require('../models/User');
const Contribution = require('../models/Contribution');

exports.getLeaderboard = async (req, res, next) => {
  try {
    const { category, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;
    const filter = {};
    if (category && category !== 'all') filter[`scoreBreakdown.${category}`] = { $gt: 0 };

    const [users, total] = await Promise.all([
      User.getLeaderboard(filter, +limit, +skip),
      User.countDocuments({ isActive: true, reputationScore: { $gt: 0 }, ...filter }),
    ]);

    const data = users.map((u, i) => ({
      rank: +skip + i + 1,
      walletAddress: u.walletAddress,
      shortWallet: u.walletAddress.slice(0,4) + '...' + u.walletAddress.slice(-4),
      username: u.username,
      reputationScore: u.reputationScore,
      scoreBreakdown: u.scoreBreakdown,
      badges: u.badges,
      contributionCount: u.contributionCount,
    }));

    res.json({ success: true, data, pagination: { total, page: +page, limit: +limit } });
  } catch (err) { next(err); }
};

exports.getPlatformStats = async (req, res, next) => {
  try {
    const [totalUsers, totalContributions, top] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Contribution.countDocuments({ isDeleted: false, status: 'approved' }),
      User.findOne({ isActive: true }).sort({ reputationScore: -1 }).select('reputationScore'),
    ]);
    res.json({ success: true, data: { totalContributors: totalUsers, totalContributions, highestScore: top?.reputationScore || 0 } });
  } catch (err) { next(err); }
};

exports.getMyRank = async (req, res, next) => {
  try {
    const rank = await User.countDocuments({ reputationScore: { $gt: req.user.reputationScore }, isActive: true });
    const total = await User.countDocuments({ isActive: true });
    res.json({ success: true, data: { rank: rank + 1, total, reputationScore: req.user.reputationScore, percentile: Math.round(((total - rank) / total) * 100) } });
  } catch (err) { next(err); }
};
