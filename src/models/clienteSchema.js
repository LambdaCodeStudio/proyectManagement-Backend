
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
    cobrosExtraordinarios: [{ type: mongoose.Schema.Types.ObjectId, ref: 'extraOrdinariosSchema' }]
    
});

module.exports = mongoose.model('clienteSchema', clienteSchema);