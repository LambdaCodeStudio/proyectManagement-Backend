const mongoose = require('mongoose');

const conceptoSchema = new mongoose.Schema({
  descripcion: { type: String, required: true },
  cantidad: { type: Number, default: 1 },
  precioUnitario: { type: Number, required: true },
  impuesto: { type: Number, default: 0 }
});

const facturaSchema = new mongoose.Schema({
  numeroFactura: { 
    type: String, 
    required: true, 
    unique: true 
  },
  idCliente: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'clienteSchema', 
    required: true 
  },
  idProyecto: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'proyectoSchema' 
  },
  conceptos: [conceptoSchema],
  subtotal: { type: Number, required: true },
  impuestos: { type: Number, default: 0 },
  total: { type: Number, required: true },
  fechaEmision: { type: Date, default: Date.now },
  fechaVencimiento: { type: Date, required: true },
  estado: { 
    type: String, 
    enum: ['pendiente', 'pagada', 'vencida', 'cancelada'], 
    default: 'pendiente' 
  },
  metodoPago: { type: String },
  notas: { type: String },
  // Campos para facturación legal
  razonSocialEmisor: { type: String },
  rucEmisor: { type: String },
  direccionEmisor: { type: String },
  razonSocialCliente: { type: String },
  rucCliente: { type: String },
  direccionCliente: { type: String }
}, {
  timestamps: true
});

// Método para generar número de factura automáticamente
facturaSchema.statics.generarNumeroFactura = async function() {
  const year = new Date().getFullYear();
  const count = await this.countDocuments({
    fechaEmision: {
      $gte: new Date(`${year}-01-01`),
      $lte: new Date(`${year}-12-31`)
    }
  });
  
  return `FAC-${year}-${(count + 1).toString().padStart(5, '0')}`;
};

module.exports = mongoose.model('Factura', facturaSchema);