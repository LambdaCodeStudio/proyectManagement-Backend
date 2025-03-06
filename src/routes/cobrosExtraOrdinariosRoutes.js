const express = require('express');
const router = express.Router();
const cobrosExtraordinariosController = require('../controllers/cobrosExtraOrdinariosController');

// Obtener todos los cobros extraordinarios
router.get('/', cobrosExtraordinariosController.getAllCobrosExtraordinarios);

// Obtener un cobro extraordinario por su ID
router.get('/:id', cobrosExtraordinariosController.getCobroExtraordinarioById);

// Obtener todos los cobros extraordinarios de un cliente específico
router.get('/cliente/:idCliente', cobrosExtraordinariosController.getCobrosExtraordinariosByClienteId);

// Actualizar un cobro extraordinario por su ID
router.put('/:id', cobrosExtraordinariosController.updateCobroExtraordinarioById);

// Eliminar un cobro extraordinario por su ID
router.delete('/:id', cobrosExtraordinariosController.deleteCobroExtraordinarioById);

module.exports = router;