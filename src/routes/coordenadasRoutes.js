const express = require('express');
const router = express.Router();
const coordenadasController = require('../controllers/coordenadasController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.use(authMiddleware);
router.use(roleMiddleware('admin', 'supervisor'));

router.get('/', coordenadasController.getAll);
router.get('/:id', coordenadasController.getById);

module.exports = router;
