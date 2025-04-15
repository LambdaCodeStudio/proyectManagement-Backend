const express = require('express');
const router = express.Router();
const {
  crearSuscripcion,
  cancelarSuscripcion,
  actualizarSuscripcion,
  consultarEstadoSuscripcion,
  reactivarSuscripcion
} = require('../controllers/suscripcionController');

router.post('/cliente/:id', crearSuscripcion);
router.delete('/cliente/:id', cancelarSuscripcion);
router.put('/cliente/:id', actualizarSuscripcion);
router.get('/cliente/:id', consultarEstadoSuscripcion);
router.post('/cliente/:id/reactivar', reactivarSuscripcion);

module.exports = router;