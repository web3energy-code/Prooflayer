const Message = require('../models/Message');
const User = require('../models/User');

// POST /api/messages — send a message
exports.sendMessage = async (req, res, next) => {
  try {
    const { to, text } = req.body;
    const from = req.user.walletAddress;

    if (!to || !text?.trim()) {
      return res.status(400).json({ success: false, message: 'to and text are required' });
    }
    if (to === from) {
      return res.status(400).json({ success: false, message: 'Cannot message yourself' });
    }

    const msg = await Message.create({ from, to, text: text.trim() });

    // Emit real-time via socket if recipient is online
    const io = req.app.get('io');
    if (io) {
      io.to(to).emit('new_message', {
        _id: msg._id,
        from,
        to,
        text: msg.text,
        createdAt: msg.createdAt,
        fromUsername: req.user.username,
      });
    }

    res.status(201).json({ success: true, data: msg });
  } catch (err) { next(err); }
};

// GET /api/messages/inbox — list all conversations
exports.getInbox = async (req, res, next) => {
  try {
    const wallet = req.user.walletAddress;
    const inbox = await Message.getInbox(wallet);

    // Enrich with usernames
    const wallets = inbox.map(i => i._id);
    const users = await User.find({ walletAddress: { $in: wallets } }).select('walletAddress username');
    const userMap = {};
    users.forEach(u => { userMap[u.walletAddress] = u.username; });

    const enriched = inbox.map(i => ({
      contactWallet: i._id,
      contactUsername: userMap[i._id] || i._id.slice(0,4)+'...'+i._id.slice(-4),
      lastMessage: i.lastMessage,
      unread: i.unread,
    }));

    res.json({ success: true, data: enriched });
  } catch (err) { next(err); }
};

// GET /api/messages/:walletAddress — get conversation
exports.getConversation = async (req, res, next) => {
  try {
    const myWallet = req.user.walletAddress;
    const theirWallet = req.params.walletAddress;

    const msgs = await Message.getConversation(myWallet, theirWallet);

    // Mark messages as read
    await Message.updateMany(
      { from: theirWallet, to: myWallet, read: false },
      { $set: { read: true } }
    );

    res.json({ success: true, data: msgs });
  } catch (err) { next(err); }
};

// GET /api/messages/unread-count
exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await Message.countDocuments({ to: req.user.walletAddress, read: false });
    res.json({ success: true, data: { count } });
  } catch (err) { next(err); }
};
