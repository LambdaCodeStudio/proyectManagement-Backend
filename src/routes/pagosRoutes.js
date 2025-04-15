/**
 * pagoRoutes.js
 * Rutas para la gestión de pagos del sistema
 */
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/security');
const auth = require('../middleware/auth');

// Importamos todos los controladores
const {
  // Controladores básicos
  getPagos,
  getPagosByCliente,
  registrarPago,
  actualizarEstadoPago,
  getHistorialPagos,
  
  // Controladores ampliados
  obtenerHistorialPagos,
  verificarEstadoPagos,
  generarReportePagos,
  marcarFacturado
} = require('../controllers/pagoController');

// Middleware para validar datos del pago
const validarPago = [
  body('idCliente').isMongoId().withMessage('ID de cliente inválido'),
  body('monto').isNumeric().withMessage('El monto debe ser un número válido'),
  body('periodoFacturado.inicio').isISO8601().withMessage('Fecha de inicio inválida'),
  body('periodoFacturado.fin').isISO8601().withMessage('Fecha de fin inválida'),
  body('metodoPago').isIn(['transferencia', 'tarjeta', 'efectivo', 'deposito', 'otro']).withMessage('Método de pago inválido'),
  validate
];

// Middleware para validar datos de factura
const validarFactura = [
  body('numeroFactura').notEmpty().withMessage('El número de factura es requerido'),
  body('fechaFactura').optional().isISO8601().withMessage('Fecha de factura inválida'),
  validate
];

// === Rutas básicas ===
// Obtener todos los pagos y registrar un nuevo pago (versión básica)
router.route('/')
  .get(auth, getPagos)
  .post(auth, validarPago, registrarPago);

// Actualizar estado de un pago
router.route('/:id')
  .put(auth, actualizarEstadoPago);

// Obtener pagos por cliente (versión básica)
router.get('/cliente/:clienteId', auth, getPagosByCliente || obtenerHistorialPagos);

// Obtener historial de pagos general
router.get('/historial', auth, getHistorialPagos);

// === Rutas ampliadas ===
// Historial de pagos por cliente (versión ampliada con más detalles)
router.get('/cliente/:idCliente/historial', auth, obtenerHistorialPagos);

// Verificar estado de pagos (para cron o uso administrativo)
router.get('/verificar', auth, verificarEstadoPagos);

// Generar reporte de pagos por periodo
router.get('/reporte', auth, generarReportePagos);

// Marcar pago como facturado
router.put('/:id/facturar', auth, validarFactura, marcarFacturado);

module.exports = router;