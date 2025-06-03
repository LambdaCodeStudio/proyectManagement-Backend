const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGIN.split(',');
    
    // Permitir solicitudes sin origen (como aplicaciones móviles o herramientas API) en desarrollo
    if (!origin && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: process.env.NODE_ENV === 'development' 
    ? [
        // En desarrollo: ser muy permisivo para evitar errores de CORS constantes
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-CSRF-Token',
        'X-Client-ID',
        'Cache-Control',
        'Pragma',
        'X-Request-ID',
        // Todos los headers de desarrollo/debugging posibles
        'x-development-mode',
        'X-Development-Mode',
        'x-debug-mode',
        'X-Debug-Mode',
        'x-csrf-bypass',
        'X-CSRF-Bypass',
        'x-skip-csrf',
        'X-Skip-CSRF',
        'x-csrf-disabled',
        'X-CSRF-Disabled',
        'x-api-version',
        'X-API-Version',
        'x-timestamp',
        'X-Timestamp',
        'x-correlation-id',
        'X-Correlation-ID',
        'x-test-mode',
        'X-Test-Mode',
        'x-mock-response',
        'X-Mock-Response',
        'x-skip-auth',
        'X-Skip-Auth',
        'x-force-error',
        'X-Force-Error',
        'x-client-version',
        'X-Client-Version',
        'x-session-id',
        'X-Session-ID',
        'x-trace-id',
        'X-Trace-ID',
        // Headers de navegador
        'User-Agent',
        'Referer',
        'DNT',
        'Sec-Fetch-Site',
        'Sec-Fetch-Mode',
        'Sec-Fetch-Dest',
        'Sec-Ch-Ua',
        'Sec-Ch-Ua-Mobile',
        'Sec-Ch-Ua-Platform',
        // Headers de infraestructura
        'X-Forwarded-For',
        'X-Forwarded-Proto',
        'X-Real-IP'
      ]
    : [
        // En producción: lista específica de headers permitidos
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-CSRF-Token',         // Para protección CSRF
        'X-Client-ID',          // Para identificación del cliente
        'Cache-Control',
        'Pragma',
        'X-Request-ID',
        // Headers básicos para funcionalidad
        'User-Agent',
        'Referer',
        'DNT',
        'Sec-Fetch-Site',
        'Sec-Fetch-Mode',
        'Sec-Fetch-Dest'
      ],
  exposedHeaders: [
    'Content-Range', 
    'X-Content-Range', 
    'New-Authorization',
    'X-CSRF-Token',        // Exponer el token CSRF actualizado
    'X-Request-ID',        // Para tracking de requests
    'X-RateLimit-Limit',   // Para rate limiting
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Total-Count',       // Para paginación
    'Link'                 // Para paginación con links
  ],
  credentials: true,
  maxAge: 600, // 10 minutos
  preflightContinue: false,
  optionsSuccessStatus: 204
};

module.exports = corsOptions;