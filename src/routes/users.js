const router = require('express').Router();
const { getProfile, updateProfile } = require('../controllers/userController');
const { protect } = require('../middleware/auth');

router.patch('/profile', protect, updateProfile);
router.get('/:walletAddress', getProfile);

module.exports = router;
