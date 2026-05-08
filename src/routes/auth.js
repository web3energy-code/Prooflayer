const router = require('express').Router();
const { getNonce, verifySignature, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/nonce', getNonce);
router.post('/verify', verifySignature);
router.get('/me', protect, getMe);

module.exports = router;
