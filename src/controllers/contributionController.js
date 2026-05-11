const Contribution = require('../models/Contribution');
const User = require('../models/User');
const { computeBadgeDelta } = require('../utils/badges');
const https = require('https');
const http = require('http');

// ── URL VERIFIER ─────────────────────────────────────────────
function verifyUrl(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return resolve({ ok: false, reason: 'URL must start with https://' });
      }
      const host = parsed.hostname.toLowerCase();
      if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.')) {
        return resolve({ ok: false, reason: 'Local URLs are not allowed' });
      }
      const lib = parsed.protocol === 'https:' ? https : http;
      const options = {
        method: 'HEAD',
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        timeout: 10000,
        headers: { 'User-Agent': 'ProofLayer-Verifier/1.0', 'Accept': '*/*' },
      };
      const req = lib.request(options, (res) => {
        const s = res.statusCode;
        if ([301,302,303,307,308].includes(s)) return resolve({ ok: true, status: s });
        if (s === 405) return resolve({ ok: true, status: s });
        if (s >= 200 && s < 400) return resolve({ ok: true, status: s });
        resolve({ ok: false, reason: `URL returned HTTP ${s}` });
      });
      req.on('timeout', () => { req.destroy(); resolve({ ok: true }); });
      req.on('error', (e) => {
        if (e.code === 'ENOTFOUND') return resolve({ ok: false, reason: `Domain "${parsed.hostname}" does not exist` });
        resolve({ ok: true }); // other errors — accept
      });
      req.end();
    } catch (e) {
      resolve({ ok: false, reason: 'Invalid URL: ' + e.message });
    }
  });
}

// ── POST /api/contributions — Submit with URL verification ────
exports.createContribution = async (req, res, next) => {
  try {
    const { title, type, description, proofLink } = req.body;

    if (!title || !type || !proofLink) {
      return res.status(400).json({ success: false, message: 'title, type and proofLink are required' });
    }

    // Verify URL
    const check = await verifyUrl(proofLink);
    if (!check.ok) {
      return res.status(400).json({
        success: false,
        message: `Proof link rejected: ${check.reason}. Please use a real, publicly accessible URL.`,
      });
    }

    // Create contribution
    const contribution = await Contribution.create({
      user: req.user._id,
      walletAddress: req.user.walletAddress,
      title, type, description: description || '', proofLink,
      verified: true,
      verifiedAt: new Date(),
    });

    // Update user score
    const user = req.user;
    user.scoreBreakdown = user.scoreBreakdown || {};
    user.scoreBreakdown[type] = (user.scoreBreakdown[type] || 0) + contribution.points;
    user.reputationScore = Object.values(user.scoreBreakdown).reduce((a, b) => a + b, 0);
    user.contributionCount = (user.contributionCount || 0) + 1;

    // Evaluate badges
    let breakdownForBadges = {};
    try {
      const { data } = await Contribution.getScoreBreakdownForUser(user._id);
      breakdownForBadges = data || {};
    } catch(e) {}

    const { toAdd } = computeBadgeDelta(user.badges || [], {
      breakdown: breakdownForBadges,
      totalScore: user.reputationScore,
      totalContributions: user.contributionCount,
      userRank: null,
    });
    const newBadges = [];
    for (const badge of toAdd) {
      if (user.addBadge(badge)) newBadges.push(badge);
    }

    await user.save({ validateBeforeSave: false });

    // Broadcast to feed via socket
    const io = req.app.get('io');
    if (io) {
      io.emit('new_contribution', {
        _id: contribution._id,
        title: contribution.title,
        type: contribution.type,
        description: contribution.description,
        proofLink: contribution.proofLink,
        points: contribution.points,
        verified: true,
        createdAt: contribution.createdAt,
        walletAddress: user.walletAddress,
        username: user.username,
        userScore: user.reputationScore,
      });
    }

    res.status(201).json({
      success: true,
      data: {
        contribution,
        pointsAwarded: contribution.points,
        newReputationScore: user.reputationScore,
        newBadges,
        scoreBreakdown: user.scoreBreakdown,
        verification: { verified: true },
      },
    });
  } catch (err) { next(err); }
};

// ── GET /api/contributions/feed — PUBLIC all contributions ────
exports.getFeed = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, type } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = { isDeleted: false, status: 'approved' };
    if (type) filter.type = type;

    const contributions = await Contribution.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'walletAddress username avatar reputationScore badges');

    const total = await Contribution.countDocuments(filter);

    const enriched = contributions.map(c => ({
      _id: c._id,
      title: c.title,
      type: c.type,
      description: c.description,
      proofLink: c.proofLink,
      points: c.points,
      verified: c.verified || false,
      createdAt: c.createdAt,
      walletAddress: c.walletAddress,
      username: c.user?.username || shortW(c.walletAddress),
      userScore: c.user?.reputationScore || 0,
      userBadges: c.user?.badges || [],
    }));

    res.json({ success: true, data: enriched, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) { next(err); }
};

function shortW(w) { return w ? w.slice(0,4)+'...'+w.slice(-4) : ''; }

// ── GET /api/contributions/my ─────────────────────────────────
exports.getMyContributions = async (req, res, next) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = { user: req.user._id, isDeleted: false, status: 'approved' };
    if (type) filter.type = type;
    const contributions = await Contribution.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
    const total = await Contribution.countDocuments(filter);
    res.json({ success: true, data: contributions, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) { next(err); }
};

// ── GET /api/contributions/:id ────────────────────────────────
exports.getContribution = async (req, res, next) => {
  try {
    const c = await Contribution.findOne({ _id: req.params.id, isDeleted: false })
      .populate('user', 'walletAddress username avatar reputationScore');
    if (!c) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: c });
  } catch (err) { next(err); }
};

// ── DELETE /api/contributions/:id — owner can delete ──────────
exports.deleteContribution = async (req, res, next) => {
  try {
    const c = await Contribution.findOne({ _id: req.params.id, user: req.user._id, isDeleted: false });
    if (!c) return res.status(404).json({ success: false, message: 'Contribution not found or not yours' });

    c.isDeleted = true;
    await c.save();

    // Deduct score
    const user = req.user;
    user.scoreBreakdown[c.type] = Math.max(0, (user.scoreBreakdown[c.type] || 0) - c.points);
    user.reputationScore = Object.values(user.scoreBreakdown).reduce((a, b) => a + b, 0);
    user.contributionCount = Math.max(0, user.contributionCount - 1);
    await user.save({ validateBeforeSave: false });

    // Broadcast deletion
    const io = req.app.get('io');
    if (io) io.emit('contribution_deleted', { contributionId: req.params.id });

    res.json({ success: true, message: 'Contribution deleted', data: { newReputationScore: user.reputationScore } });
  } catch (err) { next(err); }
};

// ── GET /api/contributions/types ──────────────────────────────
exports.getTypes = (req, res) => {
  res.json({ success: true, data: [
    { id: 'thread', label: 'Thread', emoji: '✍️', points: 10 },
    { id: 'design', label: 'Design', emoji: '🎨', points: 15 },
    { id: 'code',   label: 'Code',   emoji: '💻', points: 20 },
    { id: 'dao',    label: 'DAO Participation', emoji: '🏛️', points: 10 },
    { id: 'event',  label: 'Event Attendance',  emoji: '🎪', points: 5 },
  ]});
};
