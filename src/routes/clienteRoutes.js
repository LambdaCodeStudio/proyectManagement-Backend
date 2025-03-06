const express = require('express');
const router = express.Router();
const clienteController = require('../controllers/clienteController');

// Obtener todos los clientes
router.get('/', clienteController.getAllClientes);

// Obtener un cliente por su ID
router.get('/:id', clienteController.getClienteById);

// Actualizar un cliente por su ID
router.put('/:id', clienteController.updateClienteById);

// Eliminar un cliente por su ID
router.delete('/:id', clienteController.deleteClienteById);

// Obtener el estado de un cliente por su ID
router.get('/:id/estado', clienteController.getEstadoClienteById);

module.exports = router;