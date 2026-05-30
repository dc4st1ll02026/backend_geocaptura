const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/resumen', dashboardController.getResumen);
router.get('/actividad', dashboardController.getActividad);
router.get('/por-tecnico', roleMiddleware('admin', 'supervisor'), dashboardController.getPorTecnico);
router.get('/por-estado', roleMiddleware('admin', 'supervisor'), dashboardController.getPorEstado);
router.get('/timeline', roleMiddleware('admin', 'supervisor'), dashboardController.getTimeline);

module.exports = router;
