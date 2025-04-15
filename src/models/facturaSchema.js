/**
 * facturaSchema.js
 * Esquema para facturas con soporte para distintos formatos y referencias
 */
const mongoose = require('mongoose');

// Esquema para conceptos detallados
const conceptoSchema = new mongoose.Schema({
  descripcion: { 
    type: String, 
    required: true 
  },
  cantidad: { 
    type: Number, 
    default: 1 
  },
  precioUnitario: { 
    type: Number, 
    required: true 
  },
  impuesto: { 
    type: Number, 
    default: 0 
  },
  monto: { 
    type: Number 
  }
}, { _id: false });

// Esquema principal de factura
const facturaSchema = new mongoose.Schema({
  // Identificación de factura
  numeroFactura: {
    type: String,
    required: true,
    unique: true
  },
  
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
  
  // Referencias a otras entidades
  pago: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pago'
  },
  idProyecto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Proyecto'
  },
  
  // Fechas importantes
  fechaEmision: {
    type: Date,
    default: Date.now
  },
  fechaVencimiento: {
    type: Date
  },
  
  // Información financiera
  montoTotal: {
    type: Number
  },
  subtotal: {
    type: Number
  },
  impuestos: {
    type: Number,
    default: 0
  },
  total: {
    type: Number
  },
  
  // Detalles de los conceptos facturados
  conceptos: {
    type: [conceptoSchema],
    default: []
  },
  
  // Estado de la factura
  estado: {
    type: String,
    enum: ['emitida', 'pendiente', 'pagada', 'vencida', 'anulada', 'cancelada'],
    default: 'emitida'
  },
  
  // Información adicional
  metodoPago: {
    type: String
  },
  notas: {
    type: String
  },
  urlFactura: {
    type: String
  },
  
  // Campos para facturación legal
  razonSocialEmisor: { type: String },
  rucEmisor: { type: String },
  direccionEmisor: { type: String },
  razonSocialCliente: { type: String },
  rucCliente: { type: String },
  direccionCliente: { type: String },
  
  // Configuración para generación de números
  formatoNumeroFactura: {
    type: String,
    enum: ['FACT', 'FAC-YEAR'],
    default: 'FACT'
  }
}, {
  timestamps: true
});

// Método para calcular totales antes de guardar
facturaSchema.pre('save', function(next) {
  // Calcular subtotal y total si hay conceptos
  if (this.conceptos && this.conceptos.length > 0) {
    this.subtotal = this.conceptos.reduce((sum, concepto) => {
      // Si el concepto tiene monto, usarlo directamente
      if (concepto.monto) {
        return sum + concepto.monto;
      }
      // Si no, calcularlo desde precioUnitario * cantidad
      return sum + (concepto.precioUnitario * concepto.cantidad);
    }, 0);
    
    this.impuestos = this.conceptos.reduce((sum, concepto) => {
      return sum + (concepto.impuesto || 0);
    }, 0);
    
    this.total = this.subtotal + this.impuestos;
    
    // Asegurar que montoTotal esté sincronizado con total para compatibilidad
    this.montoTotal = this.total;
  } else if (this.montoTotal && !this.total) {
    // Si solo tenemos montoTotal, usarlo para total
    this.total = this.montoTotal;
  } else if (this.total && !this.montoTotal) {
    // Si solo tenemos total, usarlo para montoTotal
    this.montoTotal = this.total;
  }
  
  // Sincronizar cliente/idCliente
  if (this.cliente && !this.idCliente) {
    this.idCliente = this.cliente;
  } else if (this.idCliente && !this.cliente) {
    this.cliente = this.idCliente;
  }
  
  // Generar fechaVencimiento si no está definida (30 días por defecto)
  if (!this.fechaVencimiento && this.fechaEmision) {
    const fechaVenc = new Date(this.fechaEmision);
    fechaVenc.setDate(fechaVenc.getDate() + 30);
    this.fechaVencimiento = fechaVenc;
  }
  
  next();
});

// Generar número de factura automáticamente usando el formato configurado
facturaSchema.pre('save', async function(next) {
  if (!this.numeroFactura) {
    if (this.formatoNumeroFactura === 'FAC-YEAR') {
      // Formato FAC-YEAR-XXXXX
      const year = new Date().getFullYear();
      const count = await this.constructor.countDocuments({
        fechaEmision: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`)
        }
      });
      
      this.numeroFactura = `FAC-${year}-${(count + 1).toString().padStart(5, '0')}`;
    } else {
      // Formato FACT-XXXXXX (valor por defecto)
      const ultimaFactura = await this.constructor.findOne().sort({ createdAt: -1 });
      let numero = 1;
      
      if (ultimaFactura && ultimaFactura.numeroFactura) {
        const partes = ultimaFactura.numeroFactura.split('-');
        if (partes.length > 1) {
          const ultimoNumero = parseInt(partes[partes.length - 1]);
          if (!isNaN(ultimoNumero)) {
            numero = ultimoNumero + 1;
          }
        }
      }
      
      this.numeroFactura = `FACT-${numero.toString().padStart(6, '0')}`;
    }
  }
  
  next();
});

// Método estático para generar número de factura (compatibilidad)
facturaSchema.statics.generarNumeroFactura = async function(formato = 'FACT') {
  if (formato === 'FAC-YEAR') {
    const year = new Date().getFullYear();
    const count = await this.countDocuments({
      fechaEmision: {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31`)
      }
    });
    
    return `FAC-${year}-${(count + 1).toString().padStart(5, '0')}`;
  } else {
    const ultimaFactura = await this.findOne().sort({ createdAt: -1 });
    const numero = ultimaFactura ? parseInt(ultimaFactura.numeroFactura.split('-')[1]) + 1 : 1;
    return `FACT-${numero.toString().padStart(6, '0')}`;
  }
};

module.exports = mongoose.model('Factura', facturaSchema);