const Debt = require('../models/debt');
const Payment = require('../models/payment');
const User = require('../models/user');
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
    
    // Calcular métricas mejoradas
    let summary;
    if (req.user.role === 'admin' && !queryUserId) {
      // Métricas globales para admin
      summary = await getGlobalDebtSummary();
    } else {
      // Métricas específicas del usuario
      const targetUserId = queryUserId || req.user.userId;
      summary = await getUserDebtSummary(targetUserId);
    }
    
    // Procesar deudas para agregar información adicional
    const processedDebts = debts.map(debt => ({
      ...debt,
      canBePaid: ['pending', 'overdue', 'processing'].includes(debt.status),
      totalPaid: debt.payments ? debt.payments
        .filter(payment => payment.status === 'approved')
        .reduce((sum, payment) => sum + payment.amount, 0) : 0,
      isOverdue: new Date(debt.dueDate) < new Date() && debt.status === 'pending'
    }));
    
    res.json({
      status: 'success',
      data: {
        debts: processedDebts,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        },
        summary
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

// Función para obtener métricas globales (solo admin)
const getGlobalDebtSummary = async () => {
  try {
    const summary = await Debt.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);
    
    // Procesar resultados
    const result = {
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
    
    summary.forEach(item => {
      result.totalAmount += item.totalAmount;
      result.totalDebts += item.count;
      
      switch (item._id) {
        case 'pending':
          result.pendingAmount = item.totalAmount;
          result.pendingDebts = item.count;
          break;
        case 'overdue':
          result.overdueAmount = item.totalAmount;
          result.overdueDebts = item.count;
          break;
        case 'paid':
          result.paidAmount = item.totalAmount;
          result.paidDebts = item.count;
          break;
        case 'processing':
          result.processingAmount = item.totalAmount;
          result.processingDebts = item.count;
          break;
        case 'cancelled':
          result.cancelledAmount = item.totalAmount;
          result.cancelledDebts = item.count;
          break;
      }
    });
    
    return result;
  } catch (error) {
    console.error('Error calculando métricas globales:', error);
    throw error;
  }
};

// Función para obtener métricas de un usuario específico
const getUserDebtSummary = async (userId) => {
  try {
    const summary = await Debt.aggregate([
      { $match: { user: new Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);
    
    // Procesar resultados
    const result = {
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
    
    summary.forEach(item => {
      result.totalAmount += item.totalAmount;
      result.totalDebts += item.count;
      
      switch (item._id) {
        case 'pending':
          result.pendingAmount = item.totalAmount;
          result.pendingDebts = item.count;
          break;
        case 'overdue':
          result.overdueAmount = item.totalAmount;
          result.overdueDebts = item.count;
          break;
        case 'paid':
          result.paidAmount = item.totalAmount;
          result.paidDebts = item.count;
          break;
        case 'processing':
          result.processingAmount = item.totalAmount;
          result.processingDebts = item.count;
          break;
        case 'cancelled':
          result.cancelledAmount = item.totalAmount;
          result.cancelledDebts = item.count;
          break;
      }
    });
    
    return result;
  } catch (error) {
    console.error('Error calculando métricas de usuario:', error);
    throw error;
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
      totalPaid: debt.payments.reduce((sum, p) => p.status === 'approved' ? sum + p.amount : sum, 0),
      isOverdue: new Date(debt.dueDate) < new Date() && debt.status === 'pending'
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
    
    // Verificar que el usuario existe y es cliente
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }
    
    if (user.role !== 'cliente') {
      return res.status(400).json({
        status: 'error',
        message: 'Solo se pueden crear deudas para usuarios tipo cliente'
      });
    }
    
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
    
    // Poblar datos del usuario para la respuesta
    await debt.populate('user', 'email name');
    
    res.status(201).json({
      status: 'success',
      message: 'Deuda creada exitosamente',
      data: {
        ...debt.toObject(),
        canBePaid: true,
        totalPaid: 0
      }
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
    
    // Validar datos de entrada
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array()
      });
    }
    
    // Campos que no se pueden actualizar
    delete updates.user;
    delete updates.payments;
    delete updates.createdAt;
    delete updates.createdBy;
    
    // Agregar quien actualiza
    updates.updatedBy = req.user.userId;
    updates.updatedAt = new Date();
    
    const debt = await Debt.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).populate('user', 'email name');
    
    if (!debt) {
      return res.status(404).json({
        status: 'error',
        message: 'Deuda no encontrada'
      });
    }
    
    res.json({
      status: 'success',
      message: 'Deuda actualizada exitosamente',
      data: {
        ...debt.toObject(),
        canBePaid: ['pending', 'overdue', 'processing'].includes(debt.status),
        totalPaid: 0 // Se calculará si es necesario
      }
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
    
    if (debt.status === 'cancelled') {
      return res.status(400).json({
        status: 'error',
        message: 'La deuda ya está cancelada'
      });
    }
    
    // Cancelar la deuda
    debt.status = 'cancelled';
    debt.notes = (debt.notes || '') + `\n[CANCELADA] ${reason || 'Sin razón especificada'} - ${new Date().toLocaleString()}`;
    debt.updatedBy = req.user.userId;
    await debt.save();
    
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
    
    // Poblar datos del usuario para la respuesta
    await debt.populate('user', 'email name');
    
    res.json({
      status: 'success',
      message: 'Deuda cancelada exitosamente',
      data: {
        ...debt.toObject(),
        canBePaid: false,
        totalPaid: 0
      }
    });
  } catch (error) {
    console.error('Error cancelando deuda:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al cancelar la deuda'
    });
  }
};

// Marcar deuda como pagada (solo admin)
const markDebtAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    
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
        message: 'La deuda ya está marcada como pagada'
      });
    }
    
    if (debt.status === 'cancelled') {
      return res.status(400).json({
        status: 'error',
        message: 'No se puede marcar como pagada una deuda cancelada'
      });
    }
    
    // Marcar como pagada
    debt.status = 'paid';
    debt.notes = (debt.notes || '') + `\n[PAGADA MANUALMENTE] ${notes || 'Marcada como pagada por administrador'} - ${new Date().toLocaleString()}`;
    debt.updatedBy = req.user.userId;
    await debt.save();
    
    // Poblar datos del usuario para la respuesta
    await debt.populate('user', 'email name');
    
    res.json({
      status: 'success',
      message: 'Deuda marcada como pagada exitosamente',
      data: {
        ...debt.toObject(),
        canBePaid: false,
        totalPaid: debt.amount
      }
    });
  } catch (error) {
    console.error('Error marcando deuda como pagada:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al marcar la deuda como pagada'
    });
  }
};

// Obtener estadísticas de deudas
const getDebtStats = async (req, res) => {
  try {
    let stats;
    
    if (req.user.role === 'admin') {
      // Estadísticas globales para admin
      stats = await getGlobalDebtSummary();
      
      // Agregar estadísticas adicionales para admin
      const additionalStats = await Debt.aggregate([
        {
          $group: {
            _id: null,
            avgAmount: { $avg: '$amount' },
            maxAmount: { $max: '$amount' },
            minAmount: { $min: '$amount' }
          }
        }
      ]);
      
      if (additionalStats.length > 0) {
        stats.avgAmount = additionalStats[0].avgAmount;
        stats.maxAmount = additionalStats[0].maxAmount;
        stats.minAmount = additionalStats[0].minAmount;
      }
      
      // Obtener deudas por vencer (próximos 7 días)
      const upcomingDueDate = new Date();
      upcomingDueDate.setDate(upcomingDueDate.getDate() + 7);
      
      stats.upcomingDebts = await Debt.countDocuments({
        status: { $in: ['pending', 'overdue'] },
        dueDate: {
          $gte: new Date(),
          $lte: upcomingDueDate
        }
      });
      
    } else {
      // Estadísticas específicas del usuario
      const userId = req.user.userId;
      stats = await getUserDebtSummary(userId);
      
      // Obtener deudas por vencer (próximos 7 días)
      const upcomingDueDate = new Date();
      upcomingDueDate.setDate(upcomingDueDate.getDate() + 7);
      
      stats.upcomingDebts = await Debt.countDocuments({
        user: userId,
        status: { $in: ['pending', 'overdue'] },
        dueDate: {
          $gte: new Date(),
          $lte: upcomingDueDate
        }
      });
    }
    
    res.json({
      status: 'success',
      data: {
        ...stats,
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
    let debt;
    
    if (req.user.role === 'admin') {
      debt = await Debt.findById(id).populate('user', 'email name');
    } else {
      debt = await Debt.findOne({ _id: id, user: req.user.userId }).populate('user', 'email name');
    }
    
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
    
    if (debt.status === 'cancelled') {
      return res.status(400).json({
        status: 'error',
        message: 'No se puede enviar recordatorio de una deuda cancelada'
      });
    }
    
    // Verificar límite de recordatorios
    if (debt.remindersSent >= 5) {
      return res.status(400).json({
        status: 'error',
        message: 'Se ha alcanzado el límite máximo de recordatorios para esta deuda'
      });
    }
    
    // Verificar cooldown de 24 horas
    if (debt.lastReminderDate) {
      const hoursSinceLastReminder = (new Date() - debt.lastReminderDate) / (1000 * 60 * 60);
      if (hoursSinceLastReminder < 24) {
        return res.status(400).json({
          status: 'error',
          message: 'Debe esperar 24 horas antes de enviar otro recordatorio'
        });
      }
    }
    
    // Aquí se implementaría el envío del recordatorio
    // Por ejemplo, enviar email, SMS, notificación push, etc.
    
    // Actualizar contador de recordatorios
    debt.remindersSent = (debt.remindersSent || 0) + 1;
    debt.lastReminderDate = new Date();
    await debt.save();
    
    res.json({
      status: 'success',
      message: 'Recordatorio enviado exitosamente',
      data: {
        remindersSent: debt.remindersSent,
        lastReminderDate: debt.lastReminderDate
      }
    });
  } catch (error) {
    console.error('Error enviando recordatorio:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al enviar el recordatorio'
    });
  }
};

// Obtener resumen de deudas para dashboard
const getDashboardSummary = async (req, res) => {
  try {
    let summary;
    
    if (req.user.role === 'admin') {
      // Resumen global para admin
      summary = await getGlobalDebtSummary();
      
      // Agregar datos adicionales para admin
      const [totalUsers, usersWithDebts, recentDebts] = await Promise.all([
        User.countDocuments({ role: 'cliente', active: true }),
        Debt.distinct('user').then(users => users.length),
        Debt.find({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } })
          .countDocuments()
      ]);
      
      summary.totalUsers = totalUsers;
      summary.usersWithDebts = usersWithDebts;
      summary.recentDebts = recentDebts;
      
    } else {
      // Resumen específico del usuario
      summary = await getUserDebtSummary(req.user.userId);
    }
    
    res.json({
      status: 'success',
      data: summary
    });
  } catch (error) {
    console.error('Error obteniendo resumen del dashboard:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener el resumen'
    });
  }
};

module.exports = {
  getDebts,
  getDebtById,
  createDebt,
  updateDebt,
  cancelDebt,
  markDebtAsPaid,
  getDebtStats,
  sendDebtReminder,
  getDashboardSummary
};