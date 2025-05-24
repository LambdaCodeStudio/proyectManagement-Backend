const mongoose = require('mongoose');

const debtSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  description: {
    type: String,
    required: [true, 'La descripción es requerida'],
    trim: true,
    maxlength: [500, 'La descripción no puede superar los 500 caracteres']
  },
  amount: {
    type: Number,
    required: [true, 'El monto es requerido'],
    min: [1, 'El monto debe ser mayor a 0'],
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
    enum: ['pending', 'processing', 'paid', 'cancelled', 'overdue'],
    default: 'pending',
    index: true
  },
  dueDate: {
    type: Date,
    required: [true, 'La fecha de vencimiento es requerida'],
    validate: {
      validator: function(value) {
        return value > new Date();
      },
      message: 'La fecha de vencimiento debe ser futura'
    }
  },
  paymentAttempts: {
    type: Number,
    default: 0,
    min: 0
  },
  lastPaymentAttempt: {
    type: Date
  },
  metadata: {
    type: Map,
    of: String,
    default: new Map()
  },
  // Referencias a pagos
  payments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  }],
  // Información adicional
  category: {
    type: String,
    enum: ['service', 'product', 'subscription', 'fine', 'other'],
    default: 'other'
  },
  notes: {
    type: String,
    maxlength: [1000, 'Las notas no pueden superar los 1000 caracteres']
  },
  // Campos para notificaciones
  remindersSent: {
    type: Number,
    default: 0
  },
  lastReminderDate: {
    type: Date
  },
  // Campos de auditoría
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices compuestos
debtSchema.index({ user: 1, status: 1 });
debtSchema.index({ dueDate: 1, status: 1 });
debtSchema.index({ createdAt: -1 });

// Virtual para verificar si está vencida
debtSchema.virtual('isOverdue').get(function() {
  return this.status === 'pending' && this.dueDate < new Date();
});

// Virtual para días hasta vencimiento
debtSchema.virtual('daysUntilDue').get(function() {
  const now = new Date();
  const diff = this.dueDate - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Virtual para monto pagado
debtSchema.virtual('paidAmount').get(function() {
  if (!this.payments || this.payments.length === 0) return 0;
  return this.payments.reduce((sum, payment) => {
    return sum + (payment.amount || 0);
  }, 0);
});

// Virtual para monto pendiente
debtSchema.virtual('pendingAmount').get(function() {
  return Math.max(0, this.amount - this.paidAmount);
});

// Middleware pre-save
debtSchema.pre('save', async function(next) {
  // Actualizar estado a vencido si corresponde
  if (this.status === 'pending' && this.dueDate < new Date()) {
    this.status = 'overdue';
  }
  
  // Validar que el monto sea positivo
  if (this.amount <= 0) {
    throw new Error('El monto debe ser mayor a 0');
  }
  
  next();
});

// Métodos de instancia
debtSchema.methods.markAsPaid = async function(paymentId) {
  this.status = 'paid';
  this.payments.push(paymentId);
  return this.save();
};

debtSchema.methods.markAsProcessing = async function() {
  this.status = 'processing';
  this.lastPaymentAttempt = new Date();
  this.paymentAttempts += 1;
  return this.save();
};

debtSchema.methods.markAsCancelled = async function() {
  if (this.status === 'paid') {
    throw new Error('No se puede cancelar una deuda pagada');
  }
  this.status = 'cancelled';
  return this.save();
};

debtSchema.methods.addPaymentAttempt = async function() {
  this.paymentAttempts += 1;
  this.lastPaymentAttempt = new Date();
  return this.save();
};

debtSchema.methods.canBePaid = function() {
  return ['pending', 'overdue', 'processing'].includes(this.status);
};

// Métodos estáticos
debtSchema.statics.findByUser = function(userId, options = {}) {
  const query = this.find({ user: userId });
  
  if (options.status) {
    query.where('status', options.status);
  }
  
  if (options.overdue) {
    query.where('dueDate').lt(new Date());
    query.where('status', 'pending');
  }
  
  return query.sort('-createdAt').populate('payments');
};

debtSchema.statics.findOverdue = function() {
  return this.find({
    status: { $in: ['pending', 'overdue'] },
    dueDate: { $lt: new Date() }
  });
};

debtSchema.statics.updateOverdueDebts = async function() {
  return this.updateMany(
    {
      status: 'pending',
      dueDate: { $lt: new Date() }
    },
    {
      $set: { status: 'overdue' }
    }
  );
};

debtSchema.statics.getTotalDebtByUser = async function(userId) {
  const result = await this.aggregate([
    { 
      $match: { 
        user: mongoose.Types.ObjectId(userId),
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

module.exports = mongoose.model('Debt', debtSchema);