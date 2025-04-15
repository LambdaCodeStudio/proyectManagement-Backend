/**
 * extraOrdinarioSchema.js
 * Esquema para cobros extraordinarios o pagos adicionales fuera del plan regular
 */
const mongoose = require('mongoose');

const extraOrdinarioSchema = new mongoose.Schema({
  // Referencias al cliente (compatible con ambas versiones)
  cliente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cliente',
    required: true
  },
  idCliente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cliente'
  },
  
  // Datos financieros
  monto: {
    type: Number,
    required: true
  },
  
  // Información descriptiva
  concepto: {
    type: String,
    required: true
  },
  descripcion: {
    type: String
  },
  
  // Fechas
  fechaEmision: {
    type: Date,
    default: Date.now
  },
  fecha: {
    type: Date
  },
  
  // Estados de pago
  estado: {
    type: String,
    enum: ['pendiente', 'pagado', 'cancelado'],
    default: 'pendiente'
  },
  cobrado: {
    type: Boolean,
    default: false
  },
  
  // Referencias a pagos
  idPago: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pago'
  }
}, {
  timestamps: true
});

// Middleware para sincronizar campos duplicados antes de guardar
extraOrdinarioSchema.pre('save', function(next) {
  // Sincronizar cliente/idCliente
  if (this.cliente && !this.idCliente) {
    this.idCliente = this.cliente;
  } else if (this.idCliente && !this.cliente) {
    this.cliente = this.idCliente;
  }
  
  // Sincronizar fechaEmision/fecha
  if (this.fechaEmision && !this.fecha) {
    this.fecha = this.fechaEmision;
  } else if (this.fecha && !this.fechaEmision) {
    this.fechaEmision = this.fecha;
  }
  
  // Sincronizar concepto/descripcion si uno está vacío
  if (this.concepto && !this.descripcion) {
    this.descripcion = this.concepto;
  } else if (this.descripcion && !this.concepto) {
    this.concepto = this.descripcion;
  }
  
  // Sincronizar estado y cobrado
  if (this.estado === 'pagado' && this.cobrado === false) {
    this.cobrado = true;
  } else if (this.cobrado === true && this.estado !== 'pagado') {
    this.estado = 'pagado';
  }
  
  next();
});

module.exports = mongoose.model('ExtraOrdinario', extraOrdinarioSchema);