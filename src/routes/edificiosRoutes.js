const express = require('express');
const router = express.Router();
const edificiosController = require('../controllers/edificiosController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', roleMiddleware('admin', 'supervisor'), edificiosController.getAll);
router.get('/mis-edificios', edificiosController.getMisEdificios);
router.get('/tecnico/:tecnico_id', roleMiddleware('admin', 'supervisor'), edificiosController.getEdificiosPorTecnico);
router.get('/:codigo', edificiosController.getById);
router.post('/', roleMiddleware('admin'), edificiosController.create);
router.put('/asignar-lote', roleMiddleware('admin'), edificiosController.asignarLote);
router.put('/:codigo', roleMiddleware('admin'), edificiosController.update);
router.delete('/:codigo', roleMiddleware('admin'), edificiosController.remove);
router.put('/:codigo/asignar', roleMiddleware('admin'), edificiosController.asignarEdificio);
router.put('/:codigo/coordenada', roleMiddleware('tecnico', 'supervisor'), edificiosController.updateCoordenada);
router.post('/:codigo/sincronizar', roleMiddleware('tecnico', 'supervisor'), edificiosController.sincronizar);

module.exports = router;
