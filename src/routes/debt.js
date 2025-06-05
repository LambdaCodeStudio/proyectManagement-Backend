const router = require('express').Router();
const { body, param, query, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { isAdmin, isOwnerOrAdmin } = require('../middleware/roleAuth');
const {
  getDebts,
  getDebtById,
  createDebt,
  updateDebt,
  cancelDebt,
  markDebtAsPaid,
  getDebtStats,
  sendDebtReminder,
  getDashboardSummary
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
    .isLength({ min: 3, max: 500 })
    .withMessage('La descripción debe tener entre 3 y 500 caracteres')
    .trim(),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('El monto debe ser mayor a 0')
    .custom((value) => {
      // Verificar que no tenga más de 2 decimales
      if (!/^\d+(\.\d{1,2})?$/.test(value.toString())) {
        throw new Error('El monto no puede tener más de 2 decimales');
      }
      return true;
    }),
  body('currency')
    .optional()
    .isIn(['ARS', 'USD'])
    .withMessage('Moneda inválida (solo ARS o USD)'),
  body('dueDate')
    .isISO8601()
    .withMessage('Fecha de vencimiento inválida')
    .custom((value) => {
      const dueDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dueDate < today) {
        throw new Error('La fecha de vencimiento no puede ser anterior a hoy');
      }
      return true;
    }),
  body('category')
    .optional()
    .isIn(['service', 'product', 'subscription', 'fine', 'other'])
    .withMessage('Categoría inválida'),
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Las notas no pueden superar los 1000 caracteres')
    .trim()
];

const validateUpdateDebt = [
  validateDebtId,
  body('description')
    .optional()
    .isLength({ min: 3, max: 500 })
    .withMessage('La descripción debe tener entre 3 y 500 caracteres')
    .trim(),
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('El monto debe ser mayor a 0')
    .custom((value) => {
      if (value && !/^\d+(\.\d{1,2})?$/.test(value.toString())) {
        throw new Error('El monto no puede tener más de 2 decimales');
      }
      return true;
    }),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de vencimiento inválida'),
  body('status')
    .optional()
    .isIn(['pending', 'processing', 'paid', 'cancelled', 'overdue'])
    .withMessage('Estado inválido'),
  body('category')
    .optional()
    .isIn(['service', 'product', 'subscription', 'fine', 'other'])
    .withMessage('Categoría inválida'),
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Las notas no pueden superar los 1000 caracteres')
    .trim()
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
  query('userId')
    .optional()
    .isMongoId()
    .withMessage('ID de usuario inválido'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página inválida'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Límite inválido (máximo 100)')
];

const validateCancelDebt = [
  validateDebtId,
  body('reason')
    .optional()
    .isString()
    .isLength({ min: 3, max: 500 })
    .withMessage('La razón debe tener entre 3 y 500 caracteres')
    .trim()
];

const validateMarkAsPaid = [
  validateDebtId,
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Las notas no pueden superar los 500 caracteres')
    .trim()
];

// Middleware para manejar errores de validación
const handleValidationErrors = (req, res, next) => {
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
};

// Función para obtener el ID del propietario de una deuda
const getDebtOwnerId = async (req) => {
  try {
    const Debt = require('../models/debt');
    const debt = await Debt.findById(req.params.id);
    return debt ? debt.user : null;
  } catch (error) {
    console.error('Error al obtener propietario de deuda:', error);
    return null;
  }
};

// ===== RUTAS PÚBLICAS (Requieren autenticación) =====

// Obtener resumen para dashboard
router.get('/dashboard', auth, getDashboardSummary);

// Obtener todas las deudas del usuario autenticado o todas (si es admin)
router.get('/', auth, validateGetDebts, handleValidationErrors, getDebts);

// Obtener estadísticas de deudas
router.get('/stats', auth, getDebtStats);

// Obtener una deuda específica
router.get('/:id', auth, validateDebtId, handleValidationErrors, getDebtById);

// Enviar recordatorio de una deuda
router.post('/:id/reminder', 
  auth, 
  isOwnerOrAdmin(getDebtOwnerId),
  validateDebtId, 
  handleValidationErrors, 
  sendDebtReminder
);

// ===== RUTAS DE ADMINISTRACIÓN (Solo Admin) =====

// Crear una nueva deuda
router.post('/', 
  auth, 
  isAdmin, 
  validateCreateDebt, 
  handleValidationErrors, 
  createDebt
);

// Actualizar una deuda
router.put('/:id', 
  auth, 
  isAdmin, 
  validateUpdateDebt, 
  handleValidationErrors, 
  updateDebt
);

// Marcar deuda como pagada
router.post('/:id/mark-paid', 
  auth, 
  isAdmin, 
  validateMarkAsPaid, 
  handleValidationErrors, 
  markDebtAsPaid
);

// Cancelar una deuda
router.post('/:id/cancel', 
  auth, 
  isOwnerOrAdmin(getDebtOwnerId), 
  validateCancelDebt, 
  handleValidationErrors, 
  cancelDebt
);

// ===== RUTAS DE INFORMACIÓN Y UTILIDADES =====

// Obtener información sobre categorías y estados disponibles
router.get('/meta/options', auth, (req, res) => {
  res.json({
    status: 'success',
    data: {
      categories: [
        { value: 'service', label: 'Servicio' },
        { value: 'product', label: 'Producto' },
        { value: 'subscription', label: 'Suscripción' },
        { value: 'fine', label: 'Multa' },
        { value: 'other', label: 'Otro' }
      ],
      statuses: [
        { value: 'pending', label: 'Pendiente', color: 'yellow' },
        { value: 'processing', label: 'En proceso', color: 'blue' },
        { value: 'paid', label: 'Pagada', color: 'green' },
        { value: 'cancelled', label: 'Cancelada', color: 'gray' },
        { value: 'overdue', label: 'Vencida', color: 'red' }
      ],
      currencies: [
        { value: 'ARS', label: 'Peso Argentino', symbol: '$' },
        { value: 'USD', label: 'Dólar Estadounidense', symbol: 'US$' }
      ]
    }
  });
});

// Endpoint para obtener resumen de deudas por usuario (solo admin)
router.get('/users/:userId/summary', 
  auth, 
  isAdmin,
  [param('userId').isMongoId().withMessage('ID de usuario inválido')],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Verificar que el usuario existe
      const User = require('../models/user');
      const user = await User.findById(userId).select('email name');
      
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'Usuario no encontrado'
        });
      }
      
      // Obtener estadísticas específicas del usuario
      const { getUserDebtSummary } = require('../controllers/debt');
      const summary = await getUserDebtSummary(userId);
      
      res.json({
        status: 'success',
        data: {
          user: {
            id: user._id,
            email: user.email,
            name: user.name
          },
          summary
        }
      });
    } catch (error) {
      console.error('Error obteniendo resumen de usuario:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error al obtener el resumen del usuario'
      });
    }
  }
);

// Endpoint para obtener deudas próximas a vencer
router.get('/alerts/upcoming', auth, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const Debt = require('../models/debt');
    
    // Calcular fecha límite
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() + parseInt(days));
    
    // Construir filtros según el rol
    const filters = {
      status: { $in: ['pending', 'overdue'] },
      dueDate: { $lte: limitDate }
    };
    
    if (req.user.role !== 'admin') {
      filters.user = req.user.userId;
    }
    
    const upcomingDebts = await Debt.find(filters)
      .populate('user', 'email name')
      .sort('dueDate')
      .lean();
    
    res.json({
      status: 'success',
      data: {
        upcomingDebts,
        totalAmount: upcomingDebts.reduce((sum, debt) => sum + debt.amount, 0),
        count: upcomingDebts.length
      }
    });
  } catch (error) {
    console.error('Error obteniendo deudas próximas a vencer:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener las deudas próximas a vencer'
    });
  }
});

// ===== MIDDLEWARE DE MANEJO DE ERRORES =====

// Manejo de errores específicos de deudas
router.use((error, req, res, next) => {
  console.error('Error en rutas de deudas:', error);
  
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
  
  if (error.name === 'CastError') {
    return res.status(400).json({
      status: 'error',
      message: 'ID inválido proporcionado'
    });
  }
  
  if (error.code === 11000) {
    return res.status(400).json({
      status: 'error',
      message: 'Datos duplicados detectados'
    });
  }
  
  res.status(500).json({
    status: 'error',
    message: 'Error interno del servidor',
    requestId: req.requestId
  });
});

module.exports = router;