const mongoose = require('mongoose');

const SuscripcionSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  mercadopagoId: {
    type: String,
    unique: true,
    sparse: true
  },
  estado: {
    type: String,
    enum: ['pending', 'authorized', 'cancelled', 'paused', 'expired'],
    default: 'pending'
  },
  fechaInicio: {
    type: Date
  },
  fechaFin: {
    type: Date
  },
  monto: {
    type: Number,
    required: true
  },
  moneda: {
    type: String,
    default: 'ARS'
  },
  frecuencia: {
    type: Number,
    default: 1
  },
  tipoFrecuencia: {
    type: String,
    enum: ['days', 'months'],
    default: 'months'
  },
  ultimaActualizacion: {
    type: Date,
    default: Date.now
  },
  activa: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Suscripcion', SuscripcionSchema);