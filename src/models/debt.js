const mongoose = require('mongoose');
const { Types } = mongoose;

const debtSchema = new mongoose.Schema({
  user: {
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  description: {
    type: String,
    required: [true, 'La descripción es requerida'],
    trim: true,
    minlength: [3, 'La descripción debe tener al menos 3 caracteres'],
    maxlength: [500, 'La descripción no puede superar los 500 caracteres']
  },
  amount: {
    type: Number,
    required: [true, 'El monto es requerido'],
    min: [0.01, 'El monto debe ser mayor a 0'],
    validate: {
      validator: function(value) {
        // Verificar que no tenga más de 2 decimales
        return /^\d+(\.\d{1,2})?$/.test(value.toString());
      },
      message: 'El monto no puede tener más de 2 decimales'
    }
  },
  currency: {
    type: String,
    default: 'ARS',
    enum: {
      values: ['ARS', 'USD'],
      message: 'Moneda inválida, solo se permiten ARS o USD'
    },
    uppercase: true
  },
  dueDate: {
    type: Date,
    required: [true, 'La fecha de vencimiento es requerida'],
    validate: {
      validator: function(value) {
        // No validar fecha en actualizaciones si no se está modificando
        if (!this.isModified('dueDate')) return true;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return value >= today;
      },
      message: 'La fecha de vencimiento no puede ser anterior a hoy'
    },
    index: true
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'overdue', 'paid', 'cancelled', 'processing'],
      message: 'Estado inválido'
    },
    default: 'pending',
    index: true
  },
  category: {
    type: String,
    default: 'other',
    enum: {
      values: ['service', 'product', 'subscription', 'fine', 'other'],
      message: 'Categoría inválida'
    }
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Las notas no pueden superar los 1000 caracteres']
  },
  payments: [{
    type: Types.ObjectId,
    ref: 'Payment'
  }],
  createdBy: {
    type: Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: Types.ObjectId,
    ref: 'User'
  },
  remindersSent: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  lastReminderDate: {
    type: Date
  },
  // Historial de cambios de estado
  statusHistory: [{
    status: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    changedBy: {
      type: Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      maxlength: 500
    }
  }],
  // Metadatos adicionales
  metadata: {
    originalAmount: {
      type: Number
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'transfer', 'card', 'mercadopago', 'other']
    },
    tags: [{
      type: String,
      trim: true
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices compuestos para optimizar consultas
debtSchema.index({ user: 1, status: 1 });
debtSchema.index({ status: 1, dueDate: 1 });
debtSchema.index({ createdAt: -1 });
debtSchema.index({ dueDate: 1, status: 1 });

// Virtuals
debtSchema.virtual('isOverdue').get(function() {
  return this.dueDate < new Date() && this.status === 'pending';
});

debtSchema.virtual('isPaid').get(function() {
  return this.status === 'paid';
});

debtSchema.virtual('isPending').get(function() {
  return ['pending', 'overdue'].includes(this.status);
});

debtSchema.virtual('daysUntilDue').get(function() {
  const today = new Date();
  const dueDate = new Date(this.dueDate);
  const diffTime = dueDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

debtSchema.virtual('formattedAmount').get(function() {
  return this.amount.toLocaleString('es-AR', {
    style: 'currency',
    currency: this.currency
  });
});

// Middleware pre-save
debtSchema.pre('save', async function(next) {
  // Agregar al historial de estados si cambió el estado
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      date: new Date(),
      changedBy: this.updatedBy || this.createdBy,
      reason: `Estado cambiado a ${this.status}`
    });
  }
  
  // Guardar monto original si es nuevo documento
  if (this.isNew) {
    this.metadata.originalAmount = this.amount;
  }
  
  // Actualizar estado a vencida si corresponde
  if (this.status === 'pending' && this.dueDate < new Date()) {
    this.status = 'overdue';
  }
  
  next();
});

// Middleware post-save
debtSchema.post('save', function(doc) {
  // Log para auditoría
  console.log(`Deuda ${doc._id} guardada con estado: ${doc.status}`);
});

// Métodos de instancia
debtSchema.methods.canBePaid = function() {
  return ['pending', 'overdue', 'processing'].includes(this.status);
};

debtSchema.methods.markAsPaid = async function(paymentId = null) {
  if (this.status === 'paid') {
    throw new Error('La deuda ya está pagada');
  }
  
  if (this.status === 'cancelled') {
    throw new Error('No se puede marcar como pagada una deuda cancelada');
  }
  
  this.status = 'paid';
  this.statusHistory.push({
    status: 'paid',
    date: new Date(),
    reason: paymentId ? `Pagada mediante payment ${paymentId}` : 'Marcada como pagada manualmente'
  });
  
  return this.save();
};

debtSchema.methods.markAsProcessing = async function() {
  if (!['pending', 'overdue'].includes(this.status)) {
    throw new Error('Solo se pueden procesar deudas pendientes o vencidas');
  }
  
  this.status = 'processing';
  this.statusHistory.push({
    status: 'processing',
    date: new Date(),
    reason: 'Pago en proceso'
  });
  
  return this.save();
};

debtSchema.methods.markAsCancelled = async function(reason = null) {
  if (this.status === 'paid') {
    throw new Error('No se puede cancelar una deuda pagada');
  }
  
  if (this.status === 'cancelled') {
    throw new Error('La deuda ya está cancelada');
  }
  
  this.status = 'cancelled';
  this.statusHistory.push({
    status: 'cancelled',
    date: new Date(),
    reason: reason || 'Deuda cancelada'
  });
  
  return this.save();
};

debtSchema.methods.sendReminder = async function() {
  if (this.status === 'paid') {
    throw new Error('No se puede enviar recordatorio de una deuda pagada');
  }
  
  if (this.status === 'cancelled') {
    throw new Error('No se puede enviar recordatorio de una deuda cancelada');
  }
  
  if (this.remindersSent >= 5) {
    throw new Error('Se ha alcanzado el límite máximo de recordatorios');
  }
  
  // Verificar cooldown de 24 horas
  if (this.lastReminderDate) {
    const hoursSinceLastReminder = (new Date() - this.lastReminderDate) / (1000 * 60 * 60);
    if (hoursSinceLastReminder < 24) {
      throw new Error('Debe esperar 24 horas antes de enviar otro recordatorio');
    }
  }
  
  this.remindersSent += 1;
  this.lastReminderDate = new Date();
  
  return this.save();
};

debtSchema.methods.addPayment = async function(paymentId) {
  if (!this.payments.includes(paymentId)) {
    this.payments.push(paymentId);
    await this.save();
  }
};

debtSchema.methods.getTotalPaid = async function() {
  await this.populate({
    path: 'payments',
    match: { status: 'approved' }
  });
  
  return this.payments.reduce((total, payment) => total + payment.amount, 0);
};

debtSchema.methods.getRemainingAmount = async function() {
  const totalPaid = await this.getTotalPaid();
  return Math.max(0, this.amount - totalPaid);
};

// Métodos estáticos
debtSchema.statics.updateOverdueDebts = async function() {
  const result = await this.updateMany(
    {
      status: 'pending',
      dueDate: { $lt: new Date() }
    },
    {
      $set: { status: 'overdue' },
      $push: {
        statusHistory: {
          status: 'overdue',
          date: new Date(),
          reason: 'Fecha de vencimiento alcanzada'
        }
      }
    }
  );
  
  console.log(`${result.modifiedCount} deudas marcadas como vencidas`);
  return result;
};

debtSchema.statics.getTotalDebtByUser = async function(userId) {
  const result = await this.aggregate([
    { 
      $match: { 
        user: new Types.ObjectId(userId),
        status: { $in: ['pending', 'overdue', 'processing'] } 
      }
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  return result[0] || { totalAmount: 0, count: 0 };
};

debtSchema.statics.getTotalDebtAll = async function() {
  const result = await this.aggregate([
    { 
      $match: { 
        status: { $in: ['pending', 'overdue', 'processing'] } 
      }
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  return result[0] || { totalAmount: 0, count: 0 };
};

debtSchema.statics.getDebtsByStatus = async function(status, userId = null) {
  const match = { status };
  if (userId) {
    match.user = new Types.ObjectId(userId);
  }
  
  return this.find(match)
    .populate('user', 'email name')
    .sort('-createdAt');
};

debtSchema.statics.getUpcomingDebts = async function(days = 7, userId = null) {
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() + days);
  
  const match = {
    status: { $in: ['pending', 'overdue'] },
    dueDate: { $lte: limitDate }
  };
  
  if (userId) {
    match.user = new Types.ObjectId(userId);
  }
  
  return this.find(match)
    .populate('user', 'email name')
    .sort('dueDate');
};

debtSchema.statics.getOverdueDebts = async function(userId = null) {
  const match = {
    $or: [
      { status: 'overdue' },
      {
        status: 'pending',
        dueDate: { $lt: new Date() }
      }
    ]
  };
  
  if (userId) {
    match.user = new Types.ObjectId(userId);
  }
  
  return this.find(match)
    .populate('user', 'email name')
    .sort('dueDate');
};

debtSchema.statics.getDebtSummaryByUser = async function(userId) {
  const result = await this.aggregate([
    { $match: { user: new Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);
  
  // Procesar y estructurar los resultados
  const summary = {
    totalAmount: 0,
    totalDebts: 0,
    pendingAmount: 0,
    pendingDebts: 0,
    overdueAmount: 0,
    overdueDebts: 0,
    paidAmount: 0,
    paidDebts: 0,
    processingAmount: 0,
    processingDebts: 0,
    cancelledAmount: 0,
    cancelledDebts: 0,
    currency: 'ARS'
  };
  
  result.forEach(item => {
    summary.totalAmount += item.totalAmount;
    summary.totalDebts += item.count;
    
    switch (item._id) {
      case 'pending':
        summary.pendingAmount = item.totalAmount;
        summary.pendingDebts = item.count;
        break;
      case 'overdue':
        summary.overdueAmount = item.totalAmount;
        summary.overdueDebts = item.count;
        break;
      case 'paid':
        summary.paidAmount = item.totalAmount;
        summary.paidDebts = item.count;
        break;
      case 'processing':
        summary.processingAmount = item.totalAmount;
        summary.processingDebts = item.count;
        break;
      case 'cancelled':
        summary.cancelledAmount = item.totalAmount;
        summary.cancelledDebts = item.count;
        break;
    }
  });
  
  return summary;
};

debtSchema.statics.cleanupCancelledDebts = async function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  // No eliminar, solo agregar metadata para identificar deudas antiguas canceladas
  const result = await this.updateMany(
    {
      status: 'cancelled',
      updatedAt: { $lt: cutoffDate },
      'metadata.archived': { $ne: true }
    },
    {
      $set: {
        'metadata.archived': true,
        'metadata.archivedDate': new Date()
      }
    }
  );
  
  return result;
};

// Crear el modelo
const Debt = mongoose.model('Debt', debtSchema);

module.exports = Debt;