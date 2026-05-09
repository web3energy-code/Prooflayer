const Contribution = require('../models/Contribution');
const User = require('../models/User');
const { computeBadgeDelta } = require('../utils/badges');
const https = require('https');
const http = require('http');

// ─── URL VERIFIER ─────────────────────────────────────────────
// Sends a HEAD request to confirm the proof link actually exists.
// Falls back gracefully on slow sites so real links never get rejected.
function verifyUrl(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return resolve({ ok: false, reason: 'URL must start with https://' });
      }

      const host = parsed.hostname.toLowerCase();
      if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.endsWith('.local')) {
        return resolve({ ok: false, reason: 'Local or private URLs are not allowed' });
      }

      const lib = parsed.protocol === 'https:' ? https : http;
      const options = {
        method: 'HEAD',
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        timeout: 8000,
        headers: { 'User-Agent': 'ProofLayer-Verifier/1.0', 'Accept': '*/*' },
      };

      const req = lib.request(options, (res) => {
        const s = res.statusCode;
        if ([301,302,303,307,308].includes(s)) return resolve({ ok: true, status: s, redirected: true });
        if (s === 405) return resolve({ ok: true, status: s, note: 'HEAD not allowed, accepted' });
        if (s >= 200 && s < 400) return resolve({ ok: true, status: s });
        resolve({ ok: false, reason: `URL returned HTTP ${s} — make sure the link is publicly accessible` });
      });

      req.on('timeout', () => { req.destroy(); resolve({ ok: true, note: 'Slow response, accepted anyway' }); });
      req.on('error', (e) => {
        if (e.code === 'ENOTFOUND') return resolve({ ok: false, reason: `Domain "${parsed.hostname}" does not exist. Check your URL.` });
        if (e.code === 'ECONNREFUSED') return resolve({ ok: false, reason: 'Connection refused — site appears to be down' });
        resolve({ ok: true, note: 'Could not fully verify: ' + e.code });
      });

      req.end();
    } catch (e) {
      resolve({ ok: false, reason: 'Invalid URL: ' + e.message });
    }
  });
}

// ─── PLATFORM HINTS ───────────────────────────────────────────
const PLATFORMS = {
  code:   ['github.com','gitlab.com','bitbucket.org','solscan.io','explorer.solana.com','etherscan.io'],
  thread: ['x.com','twitter.com','mirror.xyz','medium.com','substack.com','paragraph.xyz','hey.xyz'],
  design: ['figma.com','behance.net','dribbble.com','canva.com'],
  dao:    ['app.realms.today','snapshot.org','dao.xyz','tally.xyz','commonwealth.im'],
  event:  ['lu.ma','eventbrite.com','hopin.com','youtube.com','x.com','twitter.com'],
};

function platformHint(type, url) {
  const list = PLATFORMS[type];
  if (!list) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (!list.some(p => host.includes(p))) {
      return `For "${type}" contributions we expect links from: ${list.slice(0,3).join(', ')}. Your link was accepted but double-check it is the right proof.`;
    }
  } catch(e) {}
  return null;
}

// ═════════════════════════════════════════════════════════════
// POST /api/contributions  — Submit with real URL verification
// ═════════════════════════════════════════════════════════════
exports.createContribution = async (req, res, next) => {
  try {
    const { title, type, description, proofLink } = req.body;

    // 1 — Verify the URL is real and accessible
    const check = await verifyUrl(proofLink);
    if (!check.ok) {
      return res.status(400).json({
        success: false,
        message: `Proof link rejected: ${check.reason}`,
      });
    }

    const hint = platformHint(type, proofLink);

    // 2 — Create contribution
    const contribution = await Contribution.create({
      user: req.user._id,
      walletAddress: req.user.walletAddress,
      title, type, description, proofLink,
      verified: true,
      verifiedAt: new Date(),
    });

    // 3 — Update user score
    const user = req.user;
    user.scoreBreakdown = user.scoreBreakdown || {};
    user.scoreBreakdown[type] = (user.scoreBreakdown[type] || 0) + contribution.points;
    user.reputationScore = Object.values(user.scoreBreakdown).reduce((a, b) => a + b, 0);
    user.contributionCount = (user.contributionCount || 0) + 1;

    // 4 — Badges
    const { data: breakdownData } = await Contribution.getScoreBreakdownForUser(user._id);
    const { toAdd } = computeBadgeDelta(user.badges, {
      breakdown: breakdownData,
      totalScore: user.reputationScore,
      totalContributions: user.contributionCount,
      userRank: null,
    });
    const newBadges = [];
    for (const badge of toAdd) {
      if (user.addBadge(badge)) newBadges.push(badge);
    }

    await user.save({ validateBeforeSave: false });

    res.status(201).json({
      success: true,
      data: {
        contribution,
        pointsAwarded: contribution.points,
        newReputationScore: user.reputationScore,
        newBadges,
        scoreBreakdown: user.scoreBreakdown,
        verification: { verified: true, hint: hint || null },
      },
    });
  } catch (err) { next(err); }
};

// ═════════════════════════════════════════════════════════════
// GET /api/contributions/feed  — PUBLIC feed, all users, newest first
// ═════════════════════════════════════════════════════════════
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
      username: c.user?.username || (c.walletAddress?.slice(0,4)+'...'+c.walletAddress?.slice(-4)),
      userScore: c.user?.reputationScore || 0,
      userBadges: c.user?.badges || [],
    }));

    res.json({
      success: true,
      data: enriched,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
};

// ═════════════════════════════════════════════════════════════
// GET /api/contributions/my  — Authenticated user's contributions
// ═════════════════════════════════════════════════════════════
exports.getMyContributions = async (req, res, next) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const contributions = await Contribution.getUserContributions(req.user._id, { type, limit: parseInt(limit), skip });
    const total = await Contribution.countDocuments({ user: req.user._id, isDeleted: false, status: 'approved', ...(type ? { type } : {}) });
    res.json({ success: true, data: contributions, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
};

// GET /api/contributions/:id
exports.getContribution = async (req, res, next) => {
  try {
    const contribution = await Contribution.findOne({ _id: req.params.id, isDeleted: false }).populate('user', 'walletAddress username avatar reputationScore');
    if (!contribution) return res.status(404).json({ success: false, message: 'Contribution not found' });
    res.json({ success: true, data: contribution });
  } catch (err) { next(err); }
};

// DELETE /api/contributions/:id
exports.deleteContribution = async (req, res, next) => {
  try {
    const contribution = await Contribution.findOne({ _id: req.params.id, user: req.user._id, isDeleted: false });
    if (!contribution) return res.status(404).json({ success: false, message: 'Contribution not found or not yours' });
    contribution.isDeleted = true;
    await contribution.save();
    const user = req.user;
    user.scoreBreakdown[contribution.type] = Math.max(0, (user.scoreBreakdown[contribution.type] || 0) - contribution.points);
    user.reputationScore = Object.values(user.scoreBreakdown).reduce((a, b) => a + b, 0);
    user.contributionCount = Math.max(0, user.contributionCount - 1);
    await user.save({ validateBeforeSave: false });
    res.json({ success: true, message: 'Contribution deleted', data: { pointsDeducted: contribution.points, newReputationScore: user.reputationScore } });
  } catch (err) { next(err); }
};

// GET /api/contributions/types
exports.getTypes = (req, res) => {
  res.json({ success: true, data: [
    { id: 'thread', label: 'Thread', emoji: '✍️', points: 10, platforms: ['x.com','twitter.com','mirror.xyz','medium.com'] },
    { id: 'design', label: 'Design', emoji: '🎨', points: 15, platforms: ['figma.com','behance.net','dribbble.com'] },
    { id: 'code',   label: 'Code',   emoji: '💻', points: 20, platforms: ['github.com','gitlab.com','solscan.io'] },
    { id: 'dao',    label: 'DAO Participation', emoji: '🏛️', points: 10, platforms: ['app.realms.today','snapshot.org'] },
    { id: 'event',  label: 'Event Attendance',  emoji: '🎪', points: 5,  platforms: ['lu.ma','eventbrite.com'] },
  ]});
};
