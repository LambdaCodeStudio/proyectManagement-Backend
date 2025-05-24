const router = require('express').Router();
const { body, param, query, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const {
  getDebts,
  getDebtById,
  createDebt,
  updateDebt,
  cancelDebt,
  getDebtStats,
  sendDebtReminder
} = require('../controllers/debt');

// Middleware de validación
const validateDebtId = param('id')
  .isMongoId()
  .withMessage('ID de deuda inválido');

const validateCreateDebt = [
  body('userId')
    .isMongoId()
    .withMessage('ID de usuario inválido'),
  body('description')
    .notEmpty()
    .withMessage('La descripción es requerida')
    .isLength({ max: 500 })
    .withMessage('La descripción no puede superar los 500 caracteres'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('El monto debe ser mayor a 0'),
  body('currency')
    .optional()
    .isIn(['ARS', 'USD'])
    .withMessage('Moneda inválida'),
  body('dueDate')
    .isISO8601()
    .withMessage('Fecha de vencimiento inválida')
    .custom((value) => new Date(value) > new Date())
    .withMessage('La fecha de vencimiento debe ser futura'),
  body('category')
    .optional()
    .isIn(['service', 'product', 'subscription', 'fine', 'other'])
    .withMessage('Categoría inválida')
];

const validateUpdateDebt = [
  validateDebtId,
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede superar los 500 caracteres'),
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('El monto debe ser mayor a 0'),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de vencimiento inválida'),
  body('status')
    .optional()
    .isIn(['pending', 'processing', 'paid', 'cancelled', 'overdue'])
    .withMessage('Estado inválido')
];

const validateGetDebts = [
  query('status')
    .optional()
    .isIn(['pending', 'processing', 'paid', 'cancelled', 'overdue'])
    .withMessage('Estado inválido'),
  query('overdue')
    .optional()
    .isBoolean()
    .withMessage('El parámetro overdue debe ser booleano'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página inválida'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Límite inválido')
];

// Rutas públicas (requieren autenticación)

// Obtener todas las deudas del usuario autenticado
router.get('/', auth, validateGetDebts, getDebts);

// Obtener estadísticas de deudas
router.get('/stats', auth, getDebtStats);

// Obtener una deuda específica
router.get('/:id', auth, validateDebtId, getDebtById);

// Enviar recordatorio de una deuda
router.post('/:id/reminder', auth, validateDebtId, sendDebtReminder);

// Rutas de administración (requieren permisos especiales)

// Middleware para verificar si es admin
const isAdmin = (req, res, next) => {
  // Aquí implementar lógica de verificación de admin
  // Por ahora, solo verificamos que esté autenticado
  if (!req.user) {
    return res.status(403).json({
      status: 'error',
      message: 'Acceso denegado: se requieren permisos de administrador'
    });
  }
  next();
};

// Crear una nueva deuda (solo admin)
router.post('/', auth, isAdmin, validateCreateDebt, createDebt);

// Actualizar una deuda (solo admin)
router.put('/:id', auth, isAdmin, validateUpdateDebt, updateDebt);

// Cancelar una deuda (admin o usuario dueño)
router.post('/:id/cancel', auth, validateDebtId, [
  body('reason')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('La razón no puede superar los 500 caracteres')
], cancelDebt);

// Manejo de errores de validación
router.use((req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  next();
});

module.exports = router;