const router = require('express').Router();
const {
  createContribution,
  getFeed,
  getMyContributions,
  getContribution,
  deleteContribution,
  getTypes,
} = require('../controllers/contributionController');
const { protect } = require('../middleware/auth');

// PUBLIC — no auth needed
router.get('/feed', getFeed);          // ← ALL contributions from ALL users
router.get('/types', getTypes);

// PROTECTED — requires JWT
router.get('/my', protect, getMyContributions);
router.post('/', protect, createContribution);
router.delete('/:id', protect, deleteContribution);

// PUBLIC — single contribution
router.get('/:id', getContribution);

module.exports = router;
