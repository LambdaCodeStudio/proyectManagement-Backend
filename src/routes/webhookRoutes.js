const express = require('express');
const router = express.Router();
const suscripcionController = require('../controllers/suscripcionController');
const { autenticarUsuario, autorizar } = require('../middleware/auth');

// Crear una nueva suscripción
router.post(
  '/usuario/:usuarioId', 
  autenticarUsuario, 
  autorizar(['admin', 'user']), // Ajusta los roles según tu sistema
  suscripcionController.crearSuscripcion
);

// Obtener una suscripción específica
router.get(
  '/:id', 
  autenticarUsuario,
  autorizar(['admin', 'user']),
  suscripcionController.obtenerSuscripcion
);

// Obtener todas las suscripciones de un usuario
router.get(
  '/usuario/:usuarioId',
  autenticarUsuario,
  autorizar(['admin', 'user']),
  suscripcionController.obtenerSuscripcionesUsuario
);

// Cancelar una suscripción
router.put(
  '/cancelar/:id',
  autenticarUsuario,
  autorizar(['admin', 'user']),
  suscripcionController.cancelarSuscripcion
);

// Verificar si un usuario tiene una suscripción activa
router.get(
  '/verificar/:usuarioId',
  autenticarUsuario,
  autorizar(['admin', 'user']),
  suscripcionController.verificarSuscripcion
);

module.exports = router;