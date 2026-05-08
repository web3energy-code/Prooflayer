const router = require('express').Router();
const { createContribution, getMyContributions, deleteContribution, getTypes } = require('../controllers/contributionController');
const { protect } = require('../middleware/auth');

router.get('/types', getTypes);
router.get('/my', protect, getMyContributions);
router.post('/', protect, createContribution);
router.delete('/:id', protect, deleteContribution);

module.exports = router;
