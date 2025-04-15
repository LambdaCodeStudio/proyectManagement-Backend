const mongoose = require('mongoose');

const proyectoSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    descripcion: { type: String },
    idCliente: { type: mongoose.Schema.Types.ObjectId, ref: 'clienteSchema', required: true },
    fechaInicio: { type: Date, default: Date.now },
    fechaEntrega: { type: Date },
    estado: { type: String, enum: ['pendiente', 'en_progreso', 'pausado', 'completado', 'cancelado'], default: 'pendiente' },
    monto: { type: Number, required: true },
    pagos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'pagoSchema' }],
    tareas: [{ 
      descripcion: String, 
      completada: Boolean,
      fechaCreacion: { type: Date, default: Date.now },
      fechaLimite: Date
    }]
});

module.exports = mongoose.model('proyectoSchema', proyectoSchema);