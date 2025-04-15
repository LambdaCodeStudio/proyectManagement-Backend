const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middlewares/error');
const { procesarWebhook } = require('./utils/webhooks');
const { iniciarCronJobs } = require('./utils/cronJobs');

// Importar rutas
const clienteRoutes = require('./routes/clienteRoutes');
const suscripcionRoutes = require('./routes/suscripcionRoutes');
const pagoRoutes = require('./routes/pagoRoutes');
const facturaRoutes = require('./routes/facturaRoutes');

// Cargar variables de entorno
dotenv.config();

// Conectar a la base de datos
connectDB();

// Inicializar Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/clientes', clienteRoutes);
app.use('/api/suscripciones', suscripcionRoutes);
app.use('/api/pagos', pagoRoutes);
app.use('/api/facturas', facturaRoutes);

// Ruta especial para webhooks de MercadoPago
app.post('/api/webhooks/mercadopago', procesarWebhook);

// Middleware de manejo de errores
app.use(errorHandler);

// Puerto
const PORT = process.env.PORT || 5000;

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en puerto ${PORT}`);
  
  // Iniciar cron jobs para verificaciones automáticas
  iniciarCronJobs();
});