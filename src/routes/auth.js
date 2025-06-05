const router = require('express').Router();
const { body, param, query, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleAuth');
const { 
  register, 
  login, 
  getCurrentUser,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  toggleUserStatus,
  deleteUser,
  getUserStats,
  changePassword
} = require('../controllers/auth');

// Middleware de validación para registro
const validateRegister = [
  body('email')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('name')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres')
    .trim(),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Teléfono inválido'),
  body('role')
    .optional()
    .isIn(['admin', 'cliente'])
    .withMessage('Rol inválido')
];

// Middleware de validación para login
const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('La contraseña es requerida')
];

// Middleware de validación para actualizar usuario
const validateUpdateUser = [
  param('id')
    .isMongoId()
    .withMessage('ID de usuario inválido'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('name')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres')
    .trim(),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Teléfono inválido'),
  body('role')
    .optional()
    .isIn(['admin', 'cliente'])
    .withMessage('Rol inválido'),
  body('active')
    .optional()
    .isBoolean()
    .withMessage('El estado activo debe ser booleano')
];

// Middleware de validación para cambio de contraseña
const validateChangePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('La contraseña actual es requerida'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('La nueva contraseña debe tener al menos 6 caracteres'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Las contraseñas no coinciden');
      }
      return true;
    })
];

// Middleware de validación para búsqueda de usuarios
const validateGetUsers = [
  query('role')
    .optional()
    .isIn(['admin', 'cliente', 'all'])
    .withMessage('Rol inválido'),
  query('active')
    .optional()
    .isBoolean()
    .withMessage('El filtro activo debe ser booleano'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página inválida'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Límite inválido'),
  query('search')
    .optional()
    .isLength({ min: 2 })
    .withMessage('La búsqueda debe tener al menos 2 caracteres')
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

// ===== RUTAS PÚBLICAS =====

// Registro de usuarios
router.post('/register', validateRegister, handleValidationErrors, register);

// Inicio de sesión
router.post('/login', validateLogin, handleValidationErrors, login);

// ===== RUTAS PROTEGIDAS =====

// Obtener información del usuario actual
router.get('/me', auth, getCurrentUser);

// Cambiar contraseña del usuario actual
router.post('/change-password', auth, validateChangePassword, handleValidationErrors, changePassword);

// ===== RUTAS DE ADMINISTRACIÓN (Solo Admin) =====

// Obtener lista de usuarios
router.get('/users', auth, isAdmin, validateGetUsers, handleValidationErrors, getUsers);

// Obtener estadísticas de usuarios
router.get('/users/stats', auth, isAdmin, getUserStats);

// Crear nuevo usuario
router.post('/users', auth, isAdmin, validateRegister, handleValidationErrors, createUser);

// Obtener usuario específico
router.get('/users/:id', auth, isAdmin, [
  param('id').isMongoId().withMessage('ID de usuario inválido')
], handleValidationErrors, getUserById);

// Actualizar usuario
router.put('/users/:id', auth, validateUpdateUser, handleValidationErrors, updateUser);

// Cambiar estado activo de usuario
router.patch('/users/:id/status', auth, isAdmin, [
  param('id').isMongoId().withMessage('ID de usuario inválido'),
  body('active').isBoolean().withMessage('El estado activo debe ser booleano')
], handleValidationErrors, toggleUserStatus);

// Eliminar usuario (soft delete)
router.delete('/users/:id', auth, isAdmin, [
  param('id').isMongoId().withMessage('ID de usuario inválido')
], handleValidationErrors, deleteUser);

// ===== MIDDLEWARE DE MANEJO DE ERRORES =====

// Manejo de errores específicos de autenticación
router.use((error, req, res, next) => {
  console.error('Error en rutas de autenticación:', error);
  
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
  
  if (error.code === 11000) {
    // Error de duplicado (email único)
    return res.status(400).json({
      status: 'error',
      message: 'El email ya está registrado'
    });
  }
  
  if (error.name === 'CastError') {
    return res.status(400).json({
      status: 'error',
      message: 'ID inválido proporcionado'
    });
  }
  
  res.status(500).json({
    status: 'error',
    message: 'Error interno del servidor',
    requestId: req.requestId
  });
});

module.exports = router;