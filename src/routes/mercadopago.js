const router = require('express').Router();
const { body, query } = require('express-validator');
const auth = require('../middleware/auth');
const {
  handleWebhook,
  testWebhook,
  getWebhookLogs
} = require('../controllers/mercadopago');

// Middleware para logs de webhooks
const logWebhook = (req, res, next) => {
  console.log('[WEBHOOK] Recibido:', {
    method: req.method,
    url: req.originalUrl,
    headers: {
      'x-signature': req.headers['x-signature'],
      'x-request-id': req.headers['x-request-id'],
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent']
    },
    query: req.query,
    body: req.body,
    ip: req.ip
  });
  next();
};

// Ruta principal de webhook (NO requiere autenticación)
// Mercado Pago enviará notificaciones a esta URL
router.post('/webhook', 
  logWebhook,
  handleWebhook
);

// Ruta alternativa para IPN (Instant Payment Notification)
// Algunos sistemas de MP usan GET en lugar de POST
router.get('/webhook',
  logWebhook,
  handleWebhook
);

// Rutas de desarrollo/testing (requieren autenticación)

// Simular webhook para testing
router.post('/webhook/test',
  auth,
  [
    body('paymentId')
      .notEmpty()
      .withMessage('ID de pago requerido'),
    body('status')
      .notEmpty()
      .isIn(['approved', 'pending', 'rejected', 'cancelled'])
      .withMessage('Estado inválido')
  ],
  testWebhook
);

// Obtener logs de webhooks recibidos
router.get('/webhook/logs',
  auth,
  [
    query('paymentId')
      .optional()
      .isMongoId()
      .withMessage('ID de pago inválido'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Límite inválido')
  ],
  getWebhookLogs
);

// Endpoint de salud para verificar que el webhook esté activo
router.get('/webhook/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Webhook endpoint activo',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Información sobre la configuración del webhook
router.get('/webhook/info', auth, (req, res) => {
  res.json({
    status: 'success',
    data: {
      url: `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/mercadopago/webhook`,
      methods: ['POST', 'GET'],
      events: ['payment', 'merchant_order'],
      instructions: {
        production: 'Configure esta URL en tu aplicación de Mercado Pago',
        testing: 'Usa ngrok o similar para exponer tu localhost',
        verification: 'MP puede enviar una notificación de prueba para verificar'
      }
    }
  });
});

// Middleware de manejo de errores específico para webhooks
router.use((error, req, res, next) => {
  console.error('[WEBHOOK ERROR]:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    body: req.body
  });
  
  // Siempre responder 200 OK a webhooks para evitar reintentos
  if (req.path.includes('/webhook') && !req.path.includes('/test')) {
    return res.status(200).send('OK');
  }
  
  // Para otros endpoints, manejar normalmente
  res.status(500).json({
    status: 'error',
    message: 'Error procesando solicitud',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

module.exports = router;