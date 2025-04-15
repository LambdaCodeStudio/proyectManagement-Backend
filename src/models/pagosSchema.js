const mongoose = require('mongoose');

const pagosSchema = new mongoose.Schema({
    idCliente: { type: mongoose.Schema.Types.ObjectId, ref: 'clienteSchema', required: true },
    monto: { type: Number, required: true },
    fechaPago: { type: Date, default: Date.now },
    periodoFacturado: {
        inicio: { type: Date, required: true },
        fin: { type: Date, required: true }
    },
    metodoPago: { 
        type: String, 
        enum: ['transferencia', 'tarjeta', 'efectivo', 'deposito', 'otro'],
        default: 'transferencia'
    },
    comprobantePago: { type: String }, // URL o referencia al comprobante
    comentarios: { type: String },
    registradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    // Facturación
    facturado: { type: Boolean, default: false },
    numeroFactura: { type: String },
    fechaFactura: { type: Date }
});

// Índices para consultas eficientes
pagosSchema.index({ idCliente: 1, fechaPago: -1 });
pagosSchema.index({ fechaPago: -1 });

module.exports = mongoose.model('pagosSchema', pagosSchema);