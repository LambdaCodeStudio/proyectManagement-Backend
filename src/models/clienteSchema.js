/**
 * clienteSchema.js
 * Esquema completo para clientes con gestión de planes, pagos y suscripciones
 */
const mongoose = require('mongoose');

// Schema para planes personalizados
const planClienteSchema = new mongoose.Schema({
  tipo: { 
    type: String, 
    required: true, 
    enum: ['basico', 'avanzado', 'pro'] 
  },
  precio: { 
    type: Number, 
    required: true 
  },
  descripcion: { 
    type: String 
  }
}, { _id: false });

const clienteSchema = new mongoose.Schema({
  // Información básica del cliente
  nombre: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  telefono: { 
    type: String, 
    required: true 
  },
  
  // Información del programa y plan
  programaAdquirido: { 
    type: String, 
    required: true, 
    enum: ['odontoCare', 'cleanOrg', 'distributionAdmin'] 
  },
  fechaInicio: { 
    type: Date, 
    default: Date.now 
  },
  
  // Estado del cliente
  estado: { 
    type: String, 
    required: true, 
    enum: ['activo', 'inactivo', 'suspendido'], 
    default: 'inactivo' 
  },
  
  // Planes y configuración financiera
  plan: { 
    type: String, 
    enum: ['mensual', 'trimestral', 'semestral', 'anual'] 
  },
  planesDisponibles: [planClienteSchema],
  planActual: {
    tipo: { 
      type: String, 
      enum: ['basico', 'avanzado', 'pro'] 
    },
    precio: { 
      type: Number
    },
    fechaActivacion: {
      type: Date
    }
  },
  montoEstablecido: { 
    type: Number, 
    default: 0 
  },
  gastoRealMensual: { 
    type: Number, 
    required: true, 
    default: 0 
  },
  
  // Gestión de cobros extraordinarios
  cobrosExtraordinarios: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'ExtraOrdinario' 
  }],
  
  // Gestión de pagos y suscripciones
  suscripcionId: { 
    type: String 
  },
  estadoPagoActual: { 
    type: String, 
    enum: ['pendiente', 'pagado', 'vencido'], 
    default: 'pendiente' 
  },
  fechaProximoPago: { 
    type: Date 
  },
  fechaUltimoPago: { 
    type: Date 
  },
  historialPagos: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Pago' 
  }],
  
  // Configuración de días de gracia y avisos
  diasGracia: { 
    type: Number, 
    default: 5 
  },
  recordatorioEnviado: { 
    type: Boolean, 
    default: false 
  },
  avisoSuspensionEnviado: { 
    type: Boolean, 
    default: false 
  },
  
  // Token de acceso para servicios externos
  tokenAcceso: { 
    type: String 
  },
  tokenActivo: { 
    type: Boolean, 
    default: true 
  }
}, {
  timestamps: true // Agrega createdAt y updatedAt automáticamente
});

// Método para calcular si un cliente está en periodo de gracia
clienteSchema.methods.enPeriodoGracia = function() {
  if (!this.fechaProximoPago) return false;
  
  const hoy = new Date();
  const fechaLimite = new Date(this.fechaProximoPago);
  fechaLimite.setDate(fechaLimite.getDate() + this.diasGracia);
  
  return hoy > this.fechaProximoPago && hoy <= fechaLimite;
};

// Método para calcular si un pago está vencido
clienteSchema.methods.pagoVencido = function() {
  if (!this.fechaProximoPago) return false;
  
  const hoy = new Date();
  const fechaLimite = new Date(this.fechaProximoPago);
  fechaLimite.setDate(fechaLimite.getDate() + this.diasGracia);
  
  return hoy > fechaLimite;
};

// Método para calcular la fecha de próximo pago según el plan
clienteSchema.methods.calcularProximoPago = function(fechaBase = null) {
  if (!fechaBase) {
    fechaBase = this.fechaUltimoPago || this.fechaInicio || new Date();
  }
  
  const nuevaFecha = new Date(fechaBase);
  
  // Calcular próximo pago según el plan
  switch (this.plan) {
    case 'mensual':
      nuevaFecha.setMonth(nuevaFecha.getMonth() + 1);
      break;
    case 'trimestral':
      nuevaFecha.setMonth(nuevaFecha.getMonth() + 3);
      break;
    case 'semestral':
      nuevaFecha.setMonth(nuevaFecha.getMonth() + 6);
      break;
    case 'anual':
      nuevaFecha.setFullYear(nuevaFecha.getFullYear() + 1);
      break;
    default:
      nuevaFecha.setMonth(nuevaFecha.getMonth() + 1); // Mensual por defecto
  }
  
  return nuevaFecha;
};

// Middleware para actualizar el estado automáticamente
clienteSchema.pre('save', function(next) {
  // Si el cliente está marcado como inactivo manualmente, no alteramos
  if (this.estado === 'inactivo') return next();
  
  // Determinar estado basado en fechas de pago
  if (this.pagoVencido()) {
    this.estado = 'suspendido';
    this.tokenActivo = false;
    this.estadoPagoActual = 'vencido';
  } else if (this.enPeriodoGracia()) {
    this.estado = 'activo'; // Aún activo pero en periodo de gracia
    this.tokenActivo = true;
    this.estadoPagoActual = 'pendiente';
  } else {
    this.estado = 'activo';
    this.tokenActivo = true;
  }
  
  next();
});

module.exports = mongoose.model('Cliente', clienteSchema);