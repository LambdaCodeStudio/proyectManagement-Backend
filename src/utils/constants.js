// Constantes del sistema de pagos

// Estados de deuda
const DEBT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  PAID: 'paid',
  CANCELLED: 'cancelled',
  OVERDUE: 'overdue'
};

// Estados de pago
const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  IN_MEDIATION: 'in_mediation',
  CHARGED_BACK: 'charged_back'
};

// Categorías de deuda
const DEBT_CATEGORIES = {
  SERVICE: 'service',
  PRODUCT: 'product',
  SUBSCRIPTION: 'subscription',
  FINE: 'fine',
  OTHER: 'other'
};

// Monedas soportadas
const SUPPORTED_CURRENCIES = {
  ARS: 'ARS',
  USD: 'USD'
};

// Tipos de notificación de Mercado Pago
const MP_NOTIFICATION_TYPES = {
  PAYMENT: 'payment',
  MERCHANT_ORDER: 'merchant_order',
  PLAN: 'plan',
  SUBSCRIPTION: 'subscription'
};

// Estados de Mercado Pago
const MP_PAYMENT_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  AUTHORIZED: 'authorized',
  IN_PROCESS: 'in_process',
  IN_MEDIATION: 'in_mediation',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  CHARGED_BACK: 'charged_back'
};

// Códigos de error personalizados
const ERROR_CODES = {
  // Errores de autenticación
  AUTH_REQUIRED: 'AUTH_001',
  INVALID_TOKEN: 'AUTH_002',
  EXPIRED_TOKEN: 'AUTH_003',
  INSUFFICIENT_PERMISSIONS: 'AUTH_004',
  
  // Errores de deuda
  DEBT_NOT_FOUND: 'DEBT_001',
  DEBT_ALREADY_PAID: 'DEBT_002',
  DEBT_CANNOT_BE_PAID: 'DEBT_003',
  DEBT_EXPIRED: 'DEBT_004',
  DEBT_CANCELLED: 'DEBT_005',
  
  // Errores de pago
  PAYMENT_NOT_FOUND: 'PAYMENT_001',
  PAYMENT_ALREADY_PROCESSED: 'PAYMENT_002',
  PAYMENT_CREATION_FAILED: 'PAYMENT_003',
  PAYMENT_INVALID_AMOUNT: 'PAYMENT_004',
  PAYMENT_RETRY_LIMIT: 'PAYMENT_005',
  
  // Errores de Mercado Pago
  MP_PREFERENCE_CREATION_FAILED: 'MP_001',
  MP_PAYMENT_NOT_FOUND: 'MP_002',
  MP_INVALID_WEBHOOK: 'MP_003',
  MP_API_ERROR: 'MP_004',
  MP_CONFIGURATION_ERROR: 'MP_005',
  
  // Errores generales
  VALIDATION_ERROR: 'GEN_001',
  INTERNAL_ERROR: 'GEN_002',
  RESOURCE_NOT_FOUND: 'GEN_003',
  BAD_REQUEST: 'GEN_004',
  RATE_LIMIT_EXCEEDED: 'GEN_005'
};

// Mensajes de error
const ERROR_MESSAGES = {
  [ERROR_CODES.AUTH_REQUIRED]: 'Autenticación requerida',
  [ERROR_CODES.INVALID_TOKEN]: 'Token inválido',
  [ERROR_CODES.EXPIRED_TOKEN]: 'Token expirado',
  [ERROR_CODES.INSUFFICIENT_PERMISSIONS]: 'Permisos insuficientes',
  
  [ERROR_CODES.DEBT_NOT_FOUND]: 'Deuda no encontrada',
  [ERROR_CODES.DEBT_ALREADY_PAID]: 'La deuda ya está pagada',
  [ERROR_CODES.DEBT_CANNOT_BE_PAID]: 'La deuda no puede ser pagada en su estado actual',
  [ERROR_CODES.DEBT_EXPIRED]: 'La deuda ha expirado',
  [ERROR_CODES.DEBT_CANCELLED]: 'La deuda ha sido cancelada',
  
  [ERROR_CODES.PAYMENT_NOT_FOUND]: 'Pago no encontrado',
  [ERROR_CODES.PAYMENT_ALREADY_PROCESSED]: 'El pago ya fue procesado',
  [ERROR_CODES.PAYMENT_CREATION_FAILED]: 'Error al crear el pago',
  [ERROR_CODES.PAYMENT_INVALID_AMOUNT]: 'Monto de pago inválido',
  [ERROR_CODES.PAYMENT_RETRY_LIMIT]: 'Se alcanzó el límite de reintentos',
  
  [ERROR_CODES.MP_PREFERENCE_CREATION_FAILED]: 'Error al crear preferencia en Mercado Pago',
  [ERROR_CODES.MP_PAYMENT_NOT_FOUND]: 'Pago no encontrado en Mercado Pago',
  [ERROR_CODES.MP_INVALID_WEBHOOK]: 'Webhook inválido de Mercado Pago',
  [ERROR_CODES.MP_API_ERROR]: 'Error en la API de Mercado Pago',
  [ERROR_CODES.MP_CONFIGURATION_ERROR]: 'Error de configuración de Mercado Pago',
  
  [ERROR_CODES.VALIDATION_ERROR]: 'Error de validación',
  [ERROR_CODES.INTERNAL_ERROR]: 'Error interno del servidor',
  [ERROR_CODES.RESOURCE_NOT_FOUND]: 'Recurso no encontrado',
  [ERROR_CODES.BAD_REQUEST]: 'Solicitud inválida',
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Límite de solicitudes excedido'
};

// Configuración de paginación
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100
};

// Configuración de tiempos
const TIMEOUTS = {
  PAYMENT_PREFERENCE_EXPIRATION: 24 * 60 * 60 * 1000, // 24 horas
  PAYMENT_RETRY_WINDOW: 30 * 60 * 1000, // 30 minutos
  WEBHOOK_PROCESSING_TIMEOUT: 5 * 60 * 1000, // 5 minutos
  OLD_PENDING_PAYMENT_DAYS: 7 // días
};

// Configuración de reintentos
const RETRY_CONFIG = {
  MAX_PAYMENT_ATTEMPTS: 3,
  RETRY_DELAY: 5 * 60 * 1000, // 5 minutos
  MAX_WEBHOOK_RETRIES: 3
};

// Expresiones regulares
const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[\d\s-()]+$/,
  MONGO_ID: /^[0-9a-fA-F]{24}$/,
  CURRENCY: /^[A-Z]{3}$/,
  AMOUNT: /^\d+(\.\d{1,2})?$/
};

// Configuración de notificaciones
const NOTIFICATION_CONFIG = {
  REMINDER_DAYS_BEFORE_DUE: [7, 3, 1],
  MAX_REMINDERS_PER_DEBT: 5,
  REMINDER_COOLDOWN_HOURS: 24
};

// Mapeo de categorías MP
const MP_CATEGORY_MAP = {
  [DEBT_CATEGORIES.SERVICE]: 'services',
  [DEBT_CATEGORIES.PRODUCT]: 'others',
  [DEBT_CATEGORIES.SUBSCRIPTION]: 'services',
  [DEBT_CATEGORIES.FINE]: 'tickets',
  [DEBT_CATEGORIES.OTHER]: 'others'
};

// Mapeo de estados MP a estados internos
const MP_STATUS_MAP = {
  [MP_PAYMENT_STATUS.APPROVED]: PAYMENT_STATUS.APPROVED,
  [MP_PAYMENT_STATUS.PENDING]: PAYMENT_STATUS.PROCESSING,
  [MP_PAYMENT_STATUS.IN_PROCESS]: PAYMENT_STATUS.PROCESSING,
  [MP_PAYMENT_STATUS.REJECTED]: PAYMENT_STATUS.REJECTED,
  [MP_PAYMENT_STATUS.CANCELLED]: PAYMENT_STATUS.CANCELLED,
  [MP_PAYMENT_STATUS.REFUNDED]: PAYMENT_STATUS.REFUNDED,
  [MP_PAYMENT_STATUS.IN_MEDIATION]: PAYMENT_STATUS.IN_MEDIATION,
  [MP_PAYMENT_STATUS.CHARGED_BACK]: PAYMENT_STATUS.CHARGED_BACK
};

// URLs de Mercado Pago
const MP_URLS = {
  API_BASE: 'https://api.mercadopago.com',
  CHECKOUT_BASE: 'https://www.mercadopago.com.ar/checkout/v1',
  SANDBOX_CHECKOUT: 'https://sandbox.mercadopago.com.ar/checkout/v1'
};

// Eventos del sistema
const SYSTEM_EVENTS = {
  // Eventos de deuda
  DEBT_CREATED: 'debt.created',
  DEBT_UPDATED: 'debt.updated',
  DEBT_PAID: 'debt.paid',
  DEBT_CANCELLED: 'debt.cancelled',
  DEBT_OVERDUE: 'debt.overdue',
  
  // Eventos de pago
  PAYMENT_CREATED: 'payment.created',
  PAYMENT_APPROVED: 'payment.approved',
  PAYMENT_REJECTED: 'payment.rejected',
  PAYMENT_CANCELLED: 'payment.cancelled',
  PAYMENT_REFUNDED: 'payment.refunded',
  
  // Eventos de webhook
  WEBHOOK_RECEIVED: 'webhook.received',
  WEBHOOK_PROCESSED: 'webhook.processed',
  WEBHOOK_FAILED: 'webhook.failed'
};

// Respuestas estándar
const STANDARD_RESPONSES = {
  SUCCESS: (message, data = null) => ({
    status: 'success',
    message,
    data,
    timestamp: new Date()
  }),
  
  ERROR: (message, code = null, details = null) => ({
    status: 'error',
    message,
    code,
    details,
    timestamp: new Date()
  }),
  
  VALIDATION_ERROR: (errors) => ({
    status: 'error',
    message: 'Error de validación',
    code: ERROR_CODES.VALIDATION_ERROR,
    errors,
    timestamp: new Date()
  })
};

module.exports = {
  DEBT_STATUS,
  PAYMENT_STATUS,
  DEBT_CATEGORIES,
  SUPPORTED_CURRENCIES,
  MP_NOTIFICATION_TYPES,
  MP_PAYMENT_STATUS,
  ERROR_CODES,
  ERROR_MESSAGES,
  PAGINATION,
  TIMEOUTS,
  RETRY_CONFIG,
  REGEX_PATTERNS,
  NOTIFICATION_CONFIG,
  MP_CATEGORY_MAP,
  MP_STATUS_MAP,
  MP_URLS,
  SYSTEM_EVENTS,
  STANDARD_RESPONSES
};