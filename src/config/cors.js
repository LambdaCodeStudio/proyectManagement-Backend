const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGIN.split(',');
    
    
    if (!origin && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'X-Client-ID',
    'X-CSRF-Token'   
  ],
  exposedHeaders: [
    'Content-Range', 
    'X-Content-Range', 
    'New-Authorization'
  ],
  credentials: true,
  maxAge: 600, // 10 minutos
  preflightContinue: false,
  optionsSuccessStatus: 204
};

const corsPublicOptions = {
  ...corsOptions,
  origin: '*', // Permite todos los orígenes, es para que siertos endpoints sean públicos
};

module.exports = { corsOptions, corsPublicOptions };