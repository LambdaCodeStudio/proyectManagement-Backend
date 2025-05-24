const router = require('express').Router();
const { body, param, query, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const {
  createPaymentPreference,
  getPayment,
  getPaymentHistory,
  checkPaymentStatus,
  cancelPayment,
  retryPayment,
  requestRefund
} = require('../controllers/payment');

// Middleware de validación
const validatePaymentId = param('id')
  .isMongoId()
  .withMessage('ID de pago inválido');

const validateDebtId = param('debtId')
  .isMongoId()
  .withMessage('ID de deuda inválido');

const validateGetPayments = [
  query('status')
    .optional()
    .isIn(['pending', 'processing', 'approved', 'rejected', 'cancelled', 'refunded', 'in_mediation', 'charged_back'])
    .withMessage('Estado inválido'),
  query('debtId')
    .optional()
    .isMongoId()
    .withMessage('ID de deuda inválido'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página inválida'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Límite inválido')
];

const validateCheckStatus = [
  query('external_reference')
    .notEmpty()
    .withMessage('Referencia externa requerida'),
  query('payment_id')
    .optional()
    .isString()
    .withMessage('ID de pago inválido'),
  query('status')
    .optional()
    .isIn(['approved', 'pending', 'rejected'])
    .withMessage('Estado inválido')
];

const validateCancelPayment = [
  validatePaymentId,
  body('reason')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('La razón no puede superar los 500 caracteres')
];

const validateRefund = [
  validatePaymentId,
  body('reason')
    .notEmpty()
    .withMessage('La razón es requerida')
    .isLength({ max: 500 })
    .withMessage('La razón no puede superar los 500 caracteres'),
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('El monto debe ser mayor a 0')
];

// Rutas principales

// Crear preferencia de pago para una deuda
router.post('/preference/:debtId', 
  auth, 
  validateDebtId,
  createPaymentPreference
);

// Obtener historial de pagos
router.get('/', 
  auth, 
  validateGetPayments,
  getPaymentHistory
);

// Obtener un pago específico
router.get('/:id', 
  auth, 
  validatePaymentId,
  getPayment
);

// Verificar estado de pago (callback desde frontend)
router.get('/status/check', 
  auth, 
  validateCheckStatus,
  checkPaymentStatus
);

// Cancelar un pago pendiente
router.post('/:id/cancel', 
  auth, 
  validateCancelPayment,
  cancelPayment
);

// Reintentar un pago fallido
router.post('/:id/retry', 
  auth, 
  validatePaymentId,
  retryPayment
);

// Solicitar reembolso
router.post('/:id/refund', 
  auth, 
  validateRefund,
  requestRefund
);

// Middleware de manejo de errores de validación
router.use((req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Datos de entrada inválidos',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
});

// Manejo de errores generales
router.use((error, req, res, next) => {
  console.error('Error en rutas de pago:', error);
  
  if (error.name === 'CastError') {
    return res.status(400).json({
      status: 'error',
      message: 'ID inválido proporcionado'
    });
  }
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      status: 'error',
      message: 'Error de validación',
      errors: Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      }))
    });
  }
  
  res.status(500).json({
    status: 'error',
    message: 'Error interno del servidor',
    requestId: req.requestId
  });
});

module.exports = router;