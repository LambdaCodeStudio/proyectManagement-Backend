/**
 * facturaRoutes.js
 * Rutas para la gestión de facturas del sistema
 */
const express = require('express');
const router = express.Router();
const {
  // Rutas básicas
  getFacturas,
  generarFactura,
  getFacturasByCliente,
  anularFactura,
  
  // Rutas ampliadas
  getAllFacturas,
  getFacturasVencidas,
  getFacturasByEstado,
  getFacturasByClienteId,
  getFacturasByProyectoId,
  getFacturaById,
  createFactura,
  updateFacturaById,
  updateFacturaEstado,
  deleteFacturaById
} = require('../controllers/facturaController');

// Middleware de autenticación (si es necesario)
const auth = require('../middleware/auth');

// === Rutas básicas ===
router.route('/').get(getFacturas || getAllFacturas);
router.post('/pago/:pagoId', generarFactura);

// === Rutas ampliadas ===
// Obtener todas las facturas (completo)
router.get('/all', getAllFacturas);

// Obtener facturas vencidas
router.get('/vencidas', getFacturasVencidas);

// Obtener facturas por estado
router.get('/estado/:estado', getFacturasByEstado);

// Obtener facturas de un cliente específico
router.get('/cliente/:clienteId', getFacturasByCliente || getFacturasByClienteId);

// Obtener facturas de un proyecto específico
router.get('/proyecto/:idProyecto', getFacturasByProyectoId);

// Operaciones CRUD completas
// Obtener una factura por su ID
router.get('/:id', getFacturaById);

// Crear una nueva factura (si es diferente de generarFactura)
router.post('/', createFactura);

// Actualizar una factura por su ID
router.put('/:id', updateFacturaById);

// Actualizar estado de una factura (anular es un caso específico)
router.patch('/:id/estado', updateFacturaEstado);
router.put('/:id/anular', anularFactura);

// Eliminar una factura por su ID
router.delete('/:id', deleteFacturaById);

module.exports = router;