const router = require('express').Router();
const { toggleLike, addComment, getReactions, getBulkReactions } = require('../controllers/reactionController');
const { protect } = require('../middleware/auth');

// Public — read reactions
router.get('/:contributionId', getReactions);

// Protected — write reactions
router.post('/like/:contributionId', protect, toggleLike);
router.post('/comment/:contributionId', protect, addComment);
router.post('/bulk', protect, getBulkReactions);

module.exports = router;
