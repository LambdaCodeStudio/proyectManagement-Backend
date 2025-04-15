/**
 * clienteRoutes.js
 * Rutas para la gestión de clientes del sistema
 */
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Importamos todos los controladores
const {
  // Controladores del primer archivo
  getClientes,
  getClienteById,
  createCliente,
  updateCliente,
  deleteCliente,
  actualizarPlanesCliente,
  
  // Controladores del segundo archivo
  getAllClientes,
  updateClienteById,
  deleteClienteById,
  getEstadoClienteById
} = require('../controllers/clienteController');

// === Rutas básicas ===
// Obtener todos los clientes y crear un nuevo cliente
router.route('/')
  .get(auth, getClientes || getAllClientes)
  .post(auth, createCliente);

// Operaciones CRUD para un cliente específico
router.route('/:id')
  .get(auth, getClienteById)
  .put(auth, updateCliente || updateClienteById)
  .delete(auth, deleteCliente || deleteClienteById);

// === Rutas extendidas ===
// Actualizar planes del cliente
router.route('/:id/planes')
  .put(auth, actualizarPlanesCliente);

// Obtener el estado de un cliente específico
router.get('/:id/estado', auth, getEstadoClienteById);

module.exports = router;