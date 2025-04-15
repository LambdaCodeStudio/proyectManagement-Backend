/**
 * pagoSchema.js
 * Esquema para registro y gestión de pagos de clientes
 */
const mongoose = require('mongoose');

const pagoSchema = new mongoose.Schema({
  // Referencias al cliente (compatibles con ambas versiones)
  cliente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cliente',
    required: true
  },
  idCliente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cliente'
  },
  
  // Información financiera
  monto: {
    type: Number,
    required: true
  },
  
  // Fechas
  fechaPago: {
    type: Date,
    default: Date.now
  },
  
  // Periodo facturado (para pagos recurrentes)
  periodoFacturado: {
    inicio: { 
      type: Date 
    },
    fin: { 
      type: Date 
    }
  },
  
  // Estado del pago
  estado: {
    type: String,
    enum: ['pendiente', 'aprobado', 'rechazado', 'reembolsado'],
    default: 'pendiente'
  },
  
  // Información transaccional
  idTransaccion: {
    type: String
  },
  metodo: {
    type: String
  },
  metodoPago: { 
    type: String, 
    enum: ['transferencia', 'tarjeta', 'efectivo', 'deposito', 'otro'],
    default: 'transferencia'
  },
  
  // Detalles adicionales
  descripcion: {
    type: String
  },
  comentarios: {
    type: String
  },
  comprobantePago: { 
    type: String // URL o referencia al comprobante
  },
  
  // Usuario que registró el pago
  registradoPor: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  
  // Información sobre facturación
  facturaGenerada: {
    type: Boolean,
    default: false
  },
  facturado: {
    type: Boolean,
    default: false
  },
  numeroFactura: { 
    type: String 
  },
  fechaFactura: { 
    type: Date 
  }
}, {
  timestamps: true
});

// Middleware para sincronizar campos duplicados antes de guardar
pagoSchema.pre('save', function(next) {
  // Sincronizar cliente/idCliente
  if (this.cliente && !this.idCliente) {
    this.idCliente = this.cliente;
  } else if (this.idCliente && !this.cliente) {
    this.cliente = this.idCliente;
  }
  
  // Sincronizar metodo/metodoPago
  if (this.metodo && !this.metodoPago) {
    this.metodoPago = this.metodo;
  } else if (this.metodoPago && !this.metodo) {
    this.metodo = this.metodoPago;
  }
  
  // Sincronizar descripcion/comentarios
  if (this.descripcion && !this.comentarios) {
    this.comentarios = this.descripcion;
  } else if (this.comentarios && !this.descripcion) {
    this.descripcion = this.comentarios;
  }
  
  // Sincronizar facturaGenerada/facturado
  if (this.facturaGenerada !== this.facturado) {
    this.facturado = this.facturaGenerada;
    this.facturaGenerada = this.facturado;
  }
  
  next();
});

// Índices para consultas eficientes
pagoSchema.index({ cliente: 1, fechaPago: -1 });
pagoSchema.index({ idCliente: 1, fechaPago: -1 });
pagoSchema.index({ fechaPago: -1 });
pagoSchema.index({ estado: 1 });

module.exports = mongoose.model('Pago', pagoSchema);