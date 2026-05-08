const Contribution = require('../models/Contribution');

const BADGES = [
  { id: 'writer',   name: '✍️ Writer',         check: b => b.thread >= 1 },
  { id: 'designer', name: '🎨 Designer',        check: b => b.design >= 1 },
  { id: 'builder',  name: '🏗️ Builder',         check: b => b.code   >= 1 },
  { id: 'dao_star', name: '🏛️ DAO Star',        check: b => b.dao    >= 1 },
  { id: 'attender', name: '🎪 Event Goer',       check: b => b.event  >= 1 },
  { id: 'rising',   name: '🌟 Rising Star',      check: b => b._total >= 100 },
  { id: 'top',      name: '🏆 Top Contributor',  check: b => b._total >= 500 },
  { id: 'multi',    name: '🎯 Multi-Talent',     check: b => ['thread','design','code','dao','event'].filter(t=>b[t]>=1).length >= 3 },
];

exports.createContribution = async (req, res, next) => {
  try {
    const { title, type, description, proofLink } = req.body;
    if (!title || !type || !proofLink) return res.status(400).json({ success: false, message: 'title, type and proofLink required' });

    const contrib = await Contribution.create({ user: req.user._id, walletAddress: req.user.walletAddress, title, type, description, proofLink });

    const user = req.user;
    user.scoreBreakdown[type] = (user.scoreBreakdown[type] || 0) + contrib.points;
    user.reputationScore = Object.values(user.scoreBreakdown).reduce((a, b) => a + b, 0);
    user.contributionCount = (user.contributionCount || 0) + 1;

    // Badge check
    const bd = { ...user.scoreBreakdown, _total: user.reputationScore };
    const currentIds = new Set(user.badges.map(b => b.id));
    const newBadges = BADGES.filter(b => !currentIds.has(b.id) && b.check(bd)).map(b => ({ id: b.id, name: b.name, earnedAt: new Date() }));
    user.badges.push(...newBadges);

    await user.save({ validateBeforeSave: false });

    res.status(201).json({
      success: true,
      data: { contribution: contrib, pointsAwarded: contrib.points, newReputationScore: user.reputationScore, newBadges, scoreBreakdown: user.scoreBreakdown },
    });
  } catch (err) { next(err); }
};

exports.getMyContributions = async (req, res, next) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;
    const filter = { user: req.user._id, isDeleted: false, status: 'approved' };
    if (type) filter.type = type;
    const contribs = await Contribution.find(filter).sort({ createdAt: -1 }).skip((page-1)*limit).limit(+limit);
    const total = await Contribution.countDocuments(filter);
    res.json({ success: true, data: contribs, pagination: { total, page: +page, limit: +limit } });
  } catch (err) { next(err); }
};

exports.deleteContribution = async (req, res, next) => {
  try {
    const contrib = await Contribution.findOne({ _id: req.params.id, user: req.user._id, isDeleted: false });
    if (!contrib) return res.status(404).json({ success: false, message: 'Not found' });
    contrib.isDeleted = true;
    await contrib.save();
    const user = req.user;
    user.scoreBreakdown[contrib.type] = Math.max(0, (user.scoreBreakdown[contrib.type] || 0) - contrib.points);
    user.reputationScore = Object.values(user.scoreBreakdown).reduce((a, b) => a + b, 0);
    user.contributionCount = Math.max(0, user.contributionCount - 1);
    await user.save({ validateBeforeSave: false });
    res.json({ success: true, message: 'Deleted', data: { pointsDeducted: contrib.points, newReputationScore: user.reputationScore } });
  } catch (err) { next(err); }
};

exports.getTypes = (req, res) => {
  res.json({ success: true, data: [
    { id: 'thread', label: 'Thread',           emoji: '✍️', points: 10 },
    { id: 'design', label: 'Design',           emoji: '🎨', points: 15 },
    { id: 'code',   label: 'Code',             emoji: '💻', points: 20 },
    { id: 'dao',    label: 'DAO Participation', emoji: '🏛️', points: 10 },
    { id: 'event',  label: 'Event Attendance', emoji: '🎪', points: 5  },
  ]});
};
