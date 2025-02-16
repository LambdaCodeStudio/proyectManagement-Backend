const router = require('express').Router();
const { register, login } = require('../controllers/auth');
const auth = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', auth, (req, res) => res.json(req.user));

module.exports = router;