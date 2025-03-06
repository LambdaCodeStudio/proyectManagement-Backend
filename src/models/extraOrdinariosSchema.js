const moongoose = require('mongoose');

const extraOrdinariosSchema = new moongoose.Schema({
    idCliente: {type: mongoose.Schema.Types.ObjectId,ref: 'clienteSchema'},
    monto : {type: Number, required: true},
    fecha: {type: Date, default: Date.now},
    descripcion: {type: String, required: true},
    cobrado: {type: Boolean, default: false}
});

module.exports = mongoose.model('extraOrdinariosSchema', extraOrdinariosSchema);