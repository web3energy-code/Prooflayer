const router = require('express').Router();
const { sendMessage, getInbox, getConversation, getUnreadCount } = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

router.use(protect); // all message routes require auth

router.post('/', sendMessage);
router.get('/inbox', getInbox);
router.get('/unread', getUnreadCount);
router.get('/:walletAddress', getConversation);

module.exports = router;
