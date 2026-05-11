const Reaction = require('../models/Reaction');

// POST /api/reactions/like/:contributionId — toggle like
exports.toggleLike = async (req, res, next) => {
  try {
    const { contributionId } = req.params;
    const wallet = req.user.walletAddress;

    const existing = await Reaction.findOne({ contributionId, wallet, type: 'like' });

    if (existing) {
      await existing.deleteOne();
      const count = await Reaction.countDocuments({ contributionId, type: 'like' });
      return res.json({ success: true, data: { liked: false, count } });
    }

    await Reaction.create({ contributionId, wallet, username: req.user.username, type: 'like' });
    const count = await Reaction.countDocuments({ contributionId, type: 'like' });

    // Real-time notification
    const io = req.app.get('io');
    if (io) io.emit('reaction_update', { contributionId, type: 'like', count });

    res.json({ success: true, data: { liked: true, count } });
  } catch (err) { next(err); }
};

// POST /api/reactions/comment/:contributionId — add comment
exports.addComment = async (req, res, next) => {
  try {
    const { contributionId } = req.params;
    const { text } = req.body;
    const wallet = req.user.walletAddress;

    if (!text?.trim()) return res.status(400).json({ success: false, message: 'Comment text is required' });

    const comment = await Reaction.create({
      contributionId, wallet,
      username: req.user.username || wallet.slice(0,4)+'...'+wallet.slice(-4),
      type: 'comment', text: text.trim(),
    });

    const count = await Reaction.countDocuments({ contributionId, type: 'comment' });

    // Real-time broadcast
    const io = req.app.get('io');
    if (io) io.emit('new_comment', { contributionId, comment, count });

    res.status(201).json({ success: true, data: { comment, count } });
  } catch (err) { next(err); }
};

// GET /api/reactions/:contributionId — get likes + comments for a post
exports.getReactions = async (req, res, next) => {
  try {
    const { contributionId } = req.params;
    const wallet = req.user?.walletAddress; // optional — if logged in show if they liked

    const [likes, comments] = await Promise.all([
      Reaction.find({ contributionId, type: 'like' }).select('wallet username createdAt'),
      Reaction.find({ contributionId, type: 'comment' }).sort({ createdAt: 1 }).select('wallet username text createdAt'),
    ]);

    res.json({
      success: true,
      data: {
        likeCount: likes.length,
        commentCount: comments.length,
        likedByMe: wallet ? likes.some(l => l.wallet === wallet) : false,
        comments,
      }
    });
  } catch (err) { next(err); }
};

// GET /api/reactions/bulk — get reactions for multiple contributions at once
exports.getBulkReactions = async (req, res, next) => {
  try {
    const { ids } = req.body; // array of contributionIds
    const wallet = req.user?.walletAddress;
    if (!ids?.length) return res.json({ success: true, data: {} });

    const [likes, comments] = await Promise.all([
      Reaction.aggregate([
        { $match: { contributionId: { $in: ids.map(id => require('mongoose').Types.ObjectId.createFromHexString(id)) }, type: 'like' } },
        { $group: { _id: '$contributionId', count: { $sum: 1 }, wallets: { $push: '$wallet' } } }
      ]),
      Reaction.aggregate([
        { $match: { contributionId: { $in: ids.map(id => require('mongoose').Types.ObjectId.createFromHexString(id)) }, type: 'comment' } },
        { $group: { _id: '$contributionId', count: { $sum: 1 } } }
      ]),
    ]);

    const result = {};
    likes.forEach(l => {
      result[l._id] = { likeCount: l.count, likedByMe: wallet ? l.wallets.includes(wallet) : false, commentCount: 0 };
    });
    comments.forEach(c => {
      if (!result[c._id]) result[c._id] = { likeCount: 0, likedByMe: false, commentCount: 0 };
      result[c._id].commentCount = c.count;
    });

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};
