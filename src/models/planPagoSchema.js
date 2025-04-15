const planPagoSchema = new mongoose.Schema({
    idProyecto: { type: mongoose.Schema.Types.ObjectId, ref: 'proyectoSchema', required: true },
    idCliente: { type: mongoose.Schema.Types.ObjectId, ref: 'clienteSchema', required: true },
    montoTotal: { type: Number, required: true },
    pagos: [{
      numeroPago: { type: Number, required: true },
      monto: { type: Number, required: true },
      fechaVencimiento: { type: Date, required: true },
      estado: { type: String, enum: ['pendiente', 'pagado', 'vencido'], default: 'pendiente' },
      recordatorioEnviado: { type: Boolean, default: false },
      idFactura: { type: mongoose.Schema.Types.ObjectId, ref: 'facturaSchema' }
    }]
  });