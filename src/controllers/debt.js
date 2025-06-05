const Debt = require('../models/debt');
const Payment = require('../models/payment');
const { Types } = require('mongoose');
const { validationResult } = require('express-validator');

// Obtener todas las deudas del usuario
const getDebts = async (req, res) => {
  try {
    const { status, overdue, page = 1, limit = 10, userId: queryUserId } = req.query;
    let filters = {};
    
    // Si es admin y se proporciona un ID de usuario específico
    if (req.user.role === 'admin' && queryUserId) {
      filters.user = queryUserId;
    } 
    // Si es admin y no se proporciona un ID de usuario, puede ver todas las deudas
    else if (req.user.role === 'admin') {
      // No aplicar filtro de usuario para que pueda ver todas las deudas
    } 
    // Si es cliente, solo puede ver sus propias deudas
    else {
      filters.user = req.user.userId;
    }
    
    // Aplicar filtros adicionales
    if (status) {
      filters.status = status;
    }
    
    // Si se solicitan solo deudas vencidas
    if (overdue === 'true') {
      filters.dueDate = { $lt: new Date() };
      filters.status = { $in: ['pending', 'overdue'] };
    }
    
    // Paginación
    const skip = (page - 1) * limit;
    
    // Obtener deudas con paginación
    const [debts, total] = await Promise.all([
      Debt.find(filters)
        .populate('payments', 'amount status createdAt')
        .populate('user', 'email name') // Incluir información básica del usuario
        .sort('-createdAt')
        .limit(limit * 1)
        .skip(skip)
        .lean(),
      Debt.countDocuments(filters)
    ]);
    
    // Actualizar estados de deudas vencidas
    await Debt.updateOverdueDebts();
    
    // Calcular totales (si es cliente, solo sus deudas; si es admin, según el filtro)
    const summaryUserId = req.user.role === 'admin' && queryUserId ? queryUserId : req.user.userId;
    const summary = req.user.role === 'admin' && !queryUserId 
      ? await Debt.getTotalDebtAll() // Método que debe implementarse para obtener totales generales
      : await Debt.getTotalDebtByUser(summaryUserId);
    
    res.json({
      status: 'success',
      data: {
        debts,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        },
        summary: {
          totalAmount: summary.totalAmount,
          totalDebts: summary.count,
          currency: 'ARS'
        }
      }
    });
  } catch (error) {
    console.error('Error obteniendo deudas:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener las deudas'
    });
  }
};

// Obtener una deuda específica
const getDebtById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Construir la consulta según el rol
    let query = { _id: id };
    
    // Si es cliente, solo puede ver sus propias deudas
    if (req.user.role !== 'admin') {
      query.user = req.user.userId;
    }
    
    const debt = await Debt.findOne(query)
      .populate({
        path: 'payments',
        select: 'amount status mercadopago.paymentId createdAt',
        options: { sort: { createdAt: -1 } }
      })
      .populate('user', 'email name') // Incluir información del usuario
      .lean();
    
    if (!debt) {
      return res.status(404).json({
        status: 'error',
        message: 'Deuda no encontrada'
      });
    }
    
    // Agregar información adicional
    const debtWithInfo = {
      ...debt,
      canBePaid: ['pending', 'overdue', 'processing'].includes(debt.status),
      totalPaid: debt.payments.reduce((sum, p) => p.status === 'approved' ? sum + p.amount : sum, 0)
    };
    
    res.json({
      status: 'success',
      data: debtWithInfo
    });
  } catch (error) {
    console.error('Error obteniendo deuda:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener la deuda'
    });
  }
};

// Crear una nueva deuda (solo para admins)
const createDebt = async (req, res) => {
  try {
    // Validar datos de entrada
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array()
      });
    }
    
    const {
      userId,
      description,
      amount,
      currency = 'ARS',
      dueDate,
      category = 'other',
      notes
    } = req.body;
    
    // Crear la deuda
    const debt = new Debt({
      user: userId,
      description,
      amount,
      currency,
      dueDate: new Date(dueDate),
      category,
      notes,
      createdBy: req.user.userId,
      status: 'pending'
    });
    
    await debt.save();
    
    res.status(201).json({
      status: 'success',
      message: 'Deuda creada exitosamente',
      data: debt
    });
  } catch (error) {
    console.error('Error creando deuda:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al crear la deuda',
      details: error.message
    });
  }
};

// Actualizar una deuda (solo para admins)
const updateDebt = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Campos que no se pueden actualizar
    delete updates.user;
    delete updates.payments;
    delete updates.createdAt;
    
    // Agregar quien actualiza
    updates.updatedBy = req.user.userId;
    
    const debt = await Debt.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );
    
    if (!debt) {
      return res.status(404).json({
        status: 'error',
        message: 'Deuda no encontrada'
      });
    }
    
    res.json({
      status: 'success',
      message: 'Deuda actualizada exitosamente',
      data: debt
    });
  } catch (error) {
    console.error('Error actualizando deuda:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar la deuda'
    });
  }
};

// Cancelar una deuda
const cancelDebt = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const debt = await Debt.findById(id);
    
    if (!debt) {
      return res.status(404).json({
        status: 'error',
        message: 'Deuda no encontrada'
      });
    }
    
    if (debt.status === 'paid') {
      return res.status(400).json({
        status: 'error',
        message: 'No se puede cancelar una deuda pagada'
      });
    }
    
    // Cancelar la deuda
    await debt.markAsCancelled();
    
    // Cancelar pagos pendientes asociados
    await Payment.updateMany(
      {
        debt: id,
        status: { $in: ['pending', 'processing'] }
      },
      {
        status: 'cancelled',
        $push: {
          statusHistory: {
            status: 'cancelled',
            date: new Date(),
            reason: reason || 'Deuda cancelada'
          }
        }
      }
    );
    
    res.json({
      status: 'success',
      message: 'Deuda cancelada exitosamente',
      data: debt
    });
  } catch (error) {
    console.error('Error cancelando deuda:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al cancelar la deuda'
    });
  }
};

// Obtener estadísticas de deudas
const getDebtStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const stats = await Debt.aggregate([
       { $match: { user: new Types.ObjectId(userId) } },
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
          statusBreakdown: {
            $push: {
              status: '$_id',
              count: '$count',
              totalAmount: '$totalAmount'
            }
          },
          totalDebts: { $sum: '$count' },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      {
        $project: {
          _id: 0,
          statusBreakdown: 1,
          totalDebts: 1,
          totalAmount: 1
        }
      }
    ]);
    
    // Obtener deudas por vencer (próximos 7 días)
    const upcomingDueDate = new Date();
    upcomingDueDate.setDate(upcomingDueDate.getDate() + 7);
    
    const upcomingDebts = await Debt.countDocuments({
      user: userId,
      status: { $in: ['pending', 'overdue'] },
      dueDate: {
        $gte: new Date(),
        $lte: upcomingDueDate
      }
    });
    
    res.json({
      status: 'success',
      data: {
        ...stats[0],
        upcomingDebts,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener las estadísticas'
    });
  }
};

// Enviar recordatorio de deuda
const sendDebtReminder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    const debt = await Debt.findOne({ _id: id, user: userId });
    
    if (!debt) {
      return res.status(404).json({
        status: 'error',
        message: 'Deuda no encontrada'
      });
    }
    
    if (debt.status === 'paid') {
      return res.status(400).json({
        status: 'error',
        message: 'La deuda ya está pagada'
      });
    }
    
    // Aquí se implementaría el envío del recordatorio
    // Por ejemplo, enviar email, SMS, notificación push, etc.
    
    // Actualizar contador de recordatorios
    debt.remindersSent += 1;
    debt.lastReminderDate = new Date();
    await debt.save();
    
    res.json({
      status: 'success',
      message: 'Recordatorio enviado exitosamente'
    });
  } catch (error) {
    console.error('Error enviando recordatorio:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al enviar el recordatorio'
    });
  }
};

module.exports = {
  getDebts,
  getDebtById,
  createDebt,
  updateDebt,
  cancelDebt,
  getDebtStats,
  sendDebtReminder
};