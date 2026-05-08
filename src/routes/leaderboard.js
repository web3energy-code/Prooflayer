const router = require('express').Router();
const { getLeaderboard, getPlatformStats, getMyRank } = require('../controllers/leaderboardController');
const { protect } = require('../middleware/auth');

router.get('/', getLeaderboard);
router.get('/stats', getPlatformStats);
router.get('/my-rank', protect, getMyRank);

module.exports = router;
