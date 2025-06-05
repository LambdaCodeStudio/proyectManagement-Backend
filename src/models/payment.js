const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  debt: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Debt',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: [true, 'El monto es requerido'],
    min: [0.01, 'El monto debe ser mayor a 0'],
    validate: {
      validator: function(value) {
        return value > 0 && Number.isFinite(value);
      },
      message: 'El monto debe ser un número válido mayor a 0'
    }
  },
  currency: {
    type: String,
    default: 'ARS',
    enum: ['ARS', 'USD'],
    uppercase: true
  },
  status: {
    type: String,
    enum: [
      'pending',      // Pago iniciado
      'processing',   // En proceso con MP
      'approved',     // Aprobado por MP
      'rejected',     // Rechazado
      'cancelled',    // Cancelado por usuario
      'refunded',     // Reembolsado
      'in_mediation', // En mediación
      'charged_back'  // Contracargo
    ],
    default: 'pending',
    index: true
  },
  // Información de Mercado Pago
  mercadopago: {
    preferenceId: {
      type: String,
      index: true
    },
    paymentId: {
      type: String,
      index: true,
      sparse: true
    },
    merchantOrderId: {
      type: String,
      sparse: true
    },
    externalReference: {
      type: String,
      index: true
    },
    paymentType: String,
    paymentMethodId: String,
    paymentMethodType: String,
    transactionAmount: Number,
    netReceivedAmount: Number,
    totalPaidAmount: Number,
    currencyId: String,
    dateApproved: Date,
    dateCreated: Date,
    lastModified: Date,
    moneyReleaseDate: Date,
    operationType: String,
    issuerId: String,
    installments: Number,
    statementDescriptor: String,
    authorizationCode: String,
    processingMode: String,
    merchantAccountId: String,
    // Información del pagador
    payer: {
      id: String,
      email: String,
      identification: {
        type: String,
        number: String
      },
      type: String
    },
    // Información adicional
    additionalInfo: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    },
    // Fees y comisiones
    feeDetails: [{
      type: {
        type: String
      },
      amount: Number,
      feePayer: String
    }],
    // Datos del rechazo
    statusDetail: String,
    callForAuthorizeId: String
  },
  // URLs de retorno
  urls: {
    success: String,
    failure: String,
    pending: String,
    notification: String
  },
  // Información de la transacción
  transactionDetails: {
    ip: String,
    userAgent: String,
    sessionId: String,
    deviceId: String
  },
  // Historial de estados
  statusHistory: [{
    status: String,
    date: {
      type: Date,
      default: Date.now
    },
    reason: String,
    details: mongoose.Schema.Types.Mixed
  }],
  // Intentos de pago
  attempts: {
    type: Number,
    default: 1
  },
  // Notas y comentarios
  notes: {
    type: String,
    maxlength: [1000, 'Las notas no pueden superar los 1000 caracteres']
  },
  // Webhooks recibidos
  webhooksReceived: [{
    id: String,
    type: String,
    action: String,
    dateReceived: {
      type: Date,
      default: Date.now
    },
    data: mongoose.Schema.Types.Mixed
  }],
  // Metadata adicional
  metadata: {
    type: Map,
    of: String,
    default: new Map()
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices compuestos
paymentSchema.index({ user: 1, status: 1 });
paymentSchema.index({ debt: 1, status: 1 });
paymentSchema.index({ 'mercadopago.paymentId': 1 }, { sparse: true });
paymentSchema.index({ 'mercadopago.preferenceId': 1 });
paymentSchema.index({ createdAt: -1 });

// Virtuals
paymentSchema.virtual('isApproved').get(function() {
  return this.status === 'approved';
});

paymentSchema.virtual('isPending').get(function() {
  return ['pending', 'processing'].includes(this.status);
});

paymentSchema.virtual('isFailed').get(function() {
  return ['rejected', 'cancelled'].includes(this.status);
});

paymentSchema.virtual('canBeRetried').get(function() {
  return ['rejected', 'cancelled'].includes(this.status) && this.attempts < 3;
});

// Middleware pre-save
paymentSchema.pre('save', async function(next) {
  // Si el estado cambió, agregar al historial
  if (this.isModified('status')) {
    const previousStatus = this.status;
    this.statusHistory.push({
      status: this.status,
      date: new Date(),
      reason: this.mercadopago.statusDetail || 'Status update'
    });
  }
  
  next();
});

// Métodos de instancia
paymentSchema.methods.updateFromMercadoPago = async function(mpData) {
  // Actualizar estado
  const statusMap = {
    'approved': 'approved',
    'pending': 'processing',
    'in_process': 'processing',
    'rejected': 'rejected',
    'cancelled': 'cancelled',
    'refunded': 'refunded',
    'in_mediation': 'in_mediation',
    'charged_back': 'charged_back'
  };
  
  this.status = statusMap[mpData.status] || 'pending';
  
  // Actualizar información de MP
  this.mercadopago = {
    ...this.mercadopago,
    paymentId: mpData.id,
    paymentType: mpData.payment_type,
    paymentMethodId: mpData.payment_method_id,
    paymentMethodType: mpData.payment_method?.type,
    transactionAmount: mpData.transaction_amount,
    netReceivedAmount: mpData.net_received_amount,
    totalPaidAmount: mpData.total_paid_amount,
    currencyId: mpData.currency_id,
    dateApproved: mpData.date_approved,
    dateCreated: mpData.date_created,
    lastModified: mpData.last_modified,
    moneyReleaseDate: mpData.money_release_date,
    operationType: mpData.operation_type,
    issuerId: mpData.issuer_id,
    installments: mpData.installments,
    statementDescriptor: mpData.statement_descriptor,
    authorizationCode: mpData.authorization_code,
    processingMode: mpData.processing_mode,
    merchantAccountId: mpData.merchant_account_id,
    statusDetail: mpData.status_detail,
    callForAuthorizeId: mpData.call_for_authorize_id,
    payer: {
      id: mpData.payer?.id,
      email: mpData.payer?.email,
      identification: mpData.payer?.identification,
      type: mpData.payer?.type
    },
    feeDetails: mpData.fee_details || []
  };
  
  return this.save();
};

paymentSchema.methods.addWebhook = async function(webhookData) {
  this.webhooksReceived.push({
    id: webhookData.id,
    type: webhookData.type,
    action: webhookData.action,
    data: webhookData.data
  });
  
  return this.save();
};

paymentSchema.methods.cancel = async function(reason) {
  if (this.status === 'approved') {
    throw new Error('No se puede cancelar un pago aprobado');
  }
  
  this.status = 'cancelled';
  this.statusHistory.push({
    status: 'cancelled',
    date: new Date(),
    reason: reason || 'Cancelado por el usuario'
  });
  
  return this.save();
};

paymentSchema.methods.retry = async function() {
  if (!this.canBeRetried) {
    throw new Error('Este pago no puede ser reintentado');
  }
  
  this.attempts += 1;
  this.status = 'pending';
  
  return this.save();
};

// Métodos estáticos
paymentSchema.statics.findByUser = function(userId, options = {}) {
  const query = this.find({ user: userId });
  
  if (options.status) {
    query.where('status', options.status);
  }
  
  if (options.debt) {
    query.where('debt', options.debt);
  }
  
  return query.sort('-createdAt').populate('debt');
};

paymentSchema.statics.findByMercadoPagoId = function(paymentId) {
  return this.findOne({ 'mercadopago.paymentId': paymentId });
};

paymentSchema.statics.findByPreferenceId = function(preferenceId) {
  return this.findOne({ 'mercadopago.preferenceId': preferenceId });
};

paymentSchema.statics.findByExternalReference = function(externalReference) {
  return this.findOne({ 'mercadopago.externalReference': externalReference });
};

// CORREGIDO: El método problemático getPaymentStats
paymentSchema.statics.getPaymentStats = async function(userId, dateFrom, dateTo) {
  // CORRECCIÓN: Usar new mongoose.Types.new ObjectId() en lugar de mongoose.Types.new ObjectId()
  const match = { user: new mongoose.Types.new ObjectId(userId) }; // ← CORREGIDO
  
  if (dateFrom || dateTo) {
    match.createdAt = {};
    if (dateFrom) match.createdAt.$gte = dateFrom;
    if (dateTo) match.createdAt.$lte = dateTo;
  }
  
  console.log('📊 === CALCULANDO ESTADÍSTICAS DE PAGOS ===');
  console.log('👤 User ID:', userId);
  console.log('🔍 Match query:', match);
  
  try {
    const result = await this.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      {
        $group: {
          _id: null,
          stats: {
            $push: {
              status: '$_id',
              count: '$count',
              totalAmount: '$totalAmount'
            }
          },
          totalPayments: { $sum: '$count' },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);
    
    const stats = result[0] || { stats: [], totalPayments: 0, totalAmount: 0 };
    console.log('✅ Estadísticas calculadas:', stats);
    
    return stats;
  } catch (error) {
    console.error('❌ Error en getPaymentStats:', error);
    throw error;
  }
};

paymentSchema.statics.cleanupOldPendingPayments = async function(daysOld = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.updateMany(
    {
      status: 'pending',
      createdAt: { $lt: cutoffDate }
    },
    {
      $set: { status: 'cancelled' },
      $push: {
        statusHistory: {
          status: 'cancelled',
          date: new Date(),
          reason: 'Cancelado automáticamente por tiempo de espera'
        }
      }
    }
  );
};

module.exports = mongoose.model('Payment', paymentSchema);