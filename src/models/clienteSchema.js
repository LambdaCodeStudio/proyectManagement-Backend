const mongoose = require('mongoose');

const clienteSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    email: { type: String, required: true },
    telefono: { type: String, required: true },
    programaAdquirido: { type: String, required: true, enum : ['odontoCare', 'cleanOrg', 'distributionAdmin'] },
    fechaInicio: { type: Date, default: Date.now },
    plan: { type: String, required: true, enum : ['mensual', 'trimestral', 'semestral', 'anual'] },
    estado: { type: String, required: true, enum : ['activo', 'inactivo'] },
    montoEstablecido: { type: Number, required: true, default: 0 },
    gastoRealMensual: { type: Number, required: true, default: 0 },
    
    // Campos nuevos para gestión de pagos
    fechaProximoPago: { type: Date },
    fechaUltimoPago: { type: Date },
    diasGracia: { type: Number, default: 5 },
    recordatorioEnviado: { type: Boolean, default: false },
    avisoSuspensionEnviado: { type: Boolean, default: false },
    
    // Token de acceso para servicios externos
    tokenAcceso: { type: String },
    tokenActivo: { type: Boolean, default: true },
    
    // Referencias a otros modelos
    cobrosExtraordinarios: [{ type: mongoose.Schema.Types.ObjectId, ref: 'extraOrdinariosSchema' }],
    historialPagos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'pagosSchema' }]
});

// Método para calcular si un cliente está en estado de gracia
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

// Middleware para actualizar estado automáticamente basado en pagos
clienteSchema.pre('save', function(next) {
    // Si el cliente está marcado como inactivo manualmente, no alteramos
    if (this.estado === 'inactivo') return next();
    
    // Determinar estado basado en fechas de pago
    if (this.pagoVencido()) {
        this.estado = 'suspendido';
        this.tokenActivo = false;
    } else {
        this.estado = 'activo';
        this.tokenActivo = true;
    }
    
    next();
});

module.exports = mongoose.model('clienteSchema', clienteSchema);