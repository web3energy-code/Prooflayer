const nacl = require('tweetnacl');
const bs58 = require('bs58');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function verifyWalletSignature(walletAddress, message, signature) {
  try {
    const pub = bs58.decode(walletAddress);
    const msg = new TextEncoder().encode(message);
    const sig = bs58.decode(signature);
    return nacl.sign.detached.verify(msg, sig, pub);
  } catch {
    return false;
  }
}

function signToken(userId, walletAddress) {
  return jwt.sign({ id: userId, walletAddress }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

async function protect(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

module.exports = { verifyWalletSignature, signToken, protect };
