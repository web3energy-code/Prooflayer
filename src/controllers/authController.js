const User = require('../models/User');
const { verifyWalletSignature, signToken } = require('../middleware/auth');

exports.getNonce = async (req, res, next) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) return res.status(400).json({ success: false, message: 'walletAddress required' });

    let user = await User.findOne({ walletAddress });
    if (!user) user = await User.create({ walletAddress, username: walletAddress.slice(0,4) + '...' + walletAddress.slice(-4) });

    user.refreshNonce();
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      data: {
        nonce: user.nonce,
        message: `Sign this message to verify your identity on ProofLayer.\n\nNonce: ${user.nonce}`,
      },
    });
  } catch (err) { next(err); }
};

exports.verifySignature = async (req, res, next) => {
  try {
    const { walletAddress, signature } = req.body;
    if (!walletAddress || !signature) return res.status(400).json({ success: false, message: 'walletAddress and signature required' });

    const user = await User.findOne({ walletAddress });
    if (!user) return res.status(404).json({ success: false, message: 'Call /nonce first' });

    const message = `Sign this message to verify your identity on ProofLayer.\n\nNonce: ${user.nonce}`;
    const valid = verifyWalletSignature(walletAddress, message, signature);
    if (!valid) return res.status(401).json({ success: false, message: 'Signature invalid' });

    user.refreshNonce();
    user.lastSeen = Date.now();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id, user.walletAddress);
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          walletAddress: user.walletAddress,
          username: user.username,
          reputationScore: user.reputationScore,
          badges: user.badges,
        },
      },
    });
  } catch (err) { next(err); }
};

exports.getMe = (req, res) => {
  res.json({ success: true, data: req.user });
};
