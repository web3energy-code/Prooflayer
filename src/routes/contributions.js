const router = require('express').Router();
const {
  createContribution, getFeed, getMyContributions,
  getContribution, deleteContribution, getTypes,
} = require('../controllers/contributionController');
const { protect } = require('../middleware/auth');

router.get('/feed',  getFeed);        // public
router.get('/types', getTypes);       // public
router.get('/my',    protect, getMyContributions);
router.post('/',     protect, createContribution);
router.delete('/:id', protect, deleteContribution);
router.get('/:id',   getContribution); // public

module.exports = router;
