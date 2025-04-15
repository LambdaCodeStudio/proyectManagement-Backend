/**
 * db.js
 * Configuración de conexión a MongoDB
 * Compatible con múltiples versiones de Mongoose y variables de entorno
 */
const mongoose = require('mongoose');

/**
 * Establece la conexión con MongoDB
 * Soporta diferentes variables de entorno y versiones de Mongoose
 * @returns {Promise} Promise de conexión a MongoDB
 */
const connectDB = async () => {
  try {
    // Determinar la URI correcta, comprobando ambas variables de entorno
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!uri) {
      console.error('Error: No se ha definido MONGODB_URI o MONGO_URI en las variables de entorno');
      process.exit(1);
    }
    
    // Configurar opciones según la versión de Mongoose
    // En Mongoose 6+ estas opciones ya no son necesarias y están deprecadas
    const mongooseVersion = mongoose.version;
    const options = {};
    
    if (mongooseVersion && parseInt(mongooseVersion.split('.')[0]) < 6) {
      // Para versiones anteriores a Mongoose 6
      options.useNewUrlParser = true;
      options.useUnifiedTopology = true;
    }
    
    // Realizar conexión
    const conn = await mongoose.connect(uri, options);
    
    // Logging avanzado de la conexión
    console.log(`MongoDB conectado: ${conn.connection.host}`);
    console.log(`Base de datos: ${conn.connection.name}`);
    console.log(`Estado de conexión: ${mongoose.connection.readyState === 1 ? 'Conectado' : 'No conectado'}`);
    
    // Configurar manejo de errores posteriores a la conexión
    mongoose.connection.on('error', (err) => {
      console.error('Error de conexión MongoDB:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB desconectado, intentando reconectar...');
    });
    
    return conn;
  } catch (error) {
    console.error(`Error al conectar a MongoDB: ${error.message}`);
    // Para depuración extendida, descomentar la siguiente línea:
    // console.error(error.stack);
    process.exit(1);
  }
};

module.exports = connectDB;