const mongoose = require('mongoose');
const { Types } = mongoose;

const paymentSchema = new mongoose.Schema({
  user: {
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  debt: {
    type: Types.ObjectId,
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
    paymentType: {
      type: String,
      default: null
    },
    paymentMethodId: {
      type: String,
      default: null
    },
    paymentMethodType: {
      type: String,
      default: null
    },
    transactionAmount: {
      type: Number,
      default: null
    },
    netReceivedAmount: {
      type: Number,
      default: null
    },
    totalPaidAmount: {
      type: Number,
      default: null
    },
    currencyId: {
      type: String,
      default: null
    },
    dateApproved: {
      type: Date,
      default: null
    },
    dateCreated: {
      type: Date,
      default: null
    },
    lastModified: {
      type: Date,
      default: null
    },
    moneyReleaseDate: {
      type: Date,
      default: null
    },
    operationType: {
      type: String,
      default: null
    },
    issuerId: {
      type: String,
      default: null
    },
    installments: {
      type: Number,
      default: null
    },
    statementDescriptor: {
      type: String,
      default: null
    },
    authorizationCode: {
      type: String,
      default: null
    },
    processingMode: {
      type: String,
      default: null
    },
    merchantAccountId: {
      type: String,
      default: null
    },
    // Información del pagador
    payer: {
      id: {
        type: String,
        default: null
      },
      email: {
        type: String,
        default: null
      },
      identification: {
        type: {
          type: String,
          default: null
        },
        number: {
          type: String,
          default: null
        }
      },
      type: {
        type: String,
        default: null
      }
    },
    // Información adicional
    additionalInfo: {
      type: Map,
      of: String,
      default: {}
    },
    // Fees y comisiones
    feeDetails: [{
      type: {
        type: String,
        default: null
      },
      amount: {
        type: Number,
        default: null
      },
      feePayer: {
        type: String,
        default: null
      }
    }],
    // Datos del rechazo
    statusDetail: {
      type: String,
      default: null
    },
    callForAuthorizeId: {
      type: String,
      default: null
    }
  },
  // URLs de retorno
  urls: {
    success: {
      type: String,
      default: null
    },
    failure: {
      type: String,
      default: null
    },
    pending: {
      type: String,
      default: null
    },
    notification: {
      type: String,
      default: null
    }
  },
  // Información de la transacción
  transactionDetails: {
    ip: {
      type: String,
      default: null
    },
    userAgent: {
      type: String,
      default: null
    },
    sessionId: {
      type: String,
      default: null
    },
    deviceId: {
      type: String,
      default: null
    }
  },
  // Historial de estados
  statusHistory: [{
    status: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    reason: {
      type: String,
      default: null
    },
    details: mongoose.Schema.Types.Mixed // Fixed: Using proper Mixed type declaration
  }],
  // Intentos de pago
  attempts: {
    type: Number,
    default: 1
  },
  // Notas y comentarios
  notes: {
    type: String,
    maxlength: [1000, 'Las notas no pueden superar los 1000 caracteres'],
    default: null
  },
  // Webhooks recibidos
  webhooksReceived: [{
    id: {
      type: String,
      default: null
    },
    type: {
      type: String,
      default: null
    },
    action: {
      type: String,
      default: null
    },
    dateReceived: {
      type: Date,
      default: Date.now
    },
    data: mongoose.Schema.Types.Mixed // Fixed: Using proper Mixed type declaration
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
    this.statusHistory.push({
      status: this.status,
      date: new Date(),
      reason: this.mercadopago?.statusDetail || 'Status update'
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
  const query = this.find({ user: new Types.ObjectId(userId) });
  
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

paymentSchema.statics.getPaymentStats = async function(userId, dateFrom, dateTo) {
  const match = { user: new Types.ObjectId(userId) };
  
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