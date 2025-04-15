const express = require('express');
const router = express.Router();
const pagosController = require('../controllers/pagosController');
const auth = require('../middleware/auth');
const { body } = require('express-validator');
const { validate } = require('../middleware/security');

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

// Registrar un nuevo pago
router.post('/', auth, validarPago, pagosController.registrarPago);

// Obtener historial de pagos de un cliente
router.get('/cliente/:idCliente', auth, pagosController.obtenerHistorialPagos);

// Verificar estado de pagos (para cron o uso administrativo)
router.get('/verificar', auth, pagosController.verificarEstadoPagos);

// Generar reporte de pagos por periodo
router.get('/reporte', auth, pagosController.generarReportePagos);

// Marcar pago como facturado
router.put('/:id/facturar', auth, validarFactura, pagosController.marcarFacturado);

module.exports = router;