const mongoose = require('mongoose');
const { Types } = mongoose;

const debtSchema = new mongoose.Schema({
  user: {
    type: Types.ObjectId,
    ref: 'User',
    required: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'ARS',
    enum: ['ARS', 'USD', 'EUR']
  },
  dueDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'overdue', 'paid', 'cancelled', 'processing'],
    default: 'pending'
  },
  category: {
    type: String,
    default: 'other',
    enum: ['rent', 'services', 'loan', 'credit-card', 'other']
  },
  notes: {
    type: String,
    trim: true
  },
  payments: [{
    type: Types.ObjectId,
    ref: 'Payment'
  }],
  createdBy: {
    type: Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: Types.ObjectId,
    ref: 'User'
  },
  remindersSent: {
    type: Number,
    default: 0
  },
  lastReminderDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Method to mark debt as cancelled
debtSchema.methods.markAsCancelled = async function() {
  this.status = 'cancelled';
  await this.save();
};

// Static method to update overdue debts
debtSchema.statics.updateOverdueDebts = async function() {
  await this.updateMany(
    {
      status: { $in: ['pending', 'processing'] },
      dueDate: { $lt: new Date() }
    },
    {
      $set: { status: 'overdue' }
    }
  );
};

// Static method to get total debt for a user
debtSchema.statics.getTotalDebtByUser = async function(userId) {
  const result = await this.aggregate([
    { $match: { 
      user: new Types.ObjectId(userId),
      status: { $in: ['pending', 'overdue', 'processing'] } 
    }},
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

// Static method to get total debt across all users (for admin)
debtSchema.statics.getTotalDebtAll = async function() {
  const result = await this.aggregate([
    { $match: { 
      status: { $in: ['pending', 'overdue', 'processing'] } 
    }},
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

const Debt = mongoose.model('Debt', debtSchema);

module.exports = Debt;