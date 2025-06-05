const Payment = require('../models/payment');
const Debt = require('../models/debt');
const User = require('../models/user');
const { getInstance: getMercadoPagoService } = require('../services/mercadopago');
const { validationResult } = require('express-validator');

// CRÍTICO: Importar ObjectId correctamente
const { ObjectId } = require('mongoose').Types;

// Crear preferencia de pago para una deuda
const createPaymentPreference = async (req, res) => {
  try {
    console.log('💳 === CREANDO PREFERENCIA DE PAGO ===');
    const { debtId } = req.params;
    const userId = req.user.userId;
    
    console.log('🏷️ Debt ID:', debtId);
    console.log('👤 User ID:', userId);
    
    // CORRECCIÓN: Usar new ObjectId()
    const debt = await Debt.findOne({ 
      _id: new ObjectId(debtId), 
      user: new ObjectId(userId) 
    });
    
    if (!debt) {
      console.error('❌ Deuda no encontrada');
      return res.status(404).json({
        status: 'error',
        message: 'Deuda no encontrada'
      });
    }
    
    console.log('✅ Deuda encontrada:', debt.description);
    
    // Verificar si la deuda puede ser pagada
    if (!debt.canBePaid()) {
      console.error('❌ Deuda no puede ser pagada, estado:', debt.status);
      return res.status(400).json({
        status: 'error',
        message: 'Esta deuda no puede ser pagada en su estado actual',
        currentStatus: debt.status
      });
    }
    
    // Verificar si ya hay un pago en proceso
    const pendingPayment = await Payment.findOne({
      debt: new ObjectId(debtId),
      status: { $in: ['pending', 'processing'] }
    });
    
    if (pendingPayment && pendingPayment.createdAt > new Date(Date.now() - 30 * 60 * 1000)) {
      console.log('⚠️ Ya existe un pago pendiente reciente');
      return res.json({
        status: 'success',
        message: 'Ya existe una preferencia de pago activa',
        data: {
          preferenceId: pendingPayment.mercadopago.preferenceId,
          createdAt: pendingPayment.createdAt
        }
      });
    }
    
    // Obtener datos del usuario
    const user = await User.findById(new ObjectId(userId));
    
    // Crear preferencia en Mercado Pago
    console.log('🔄 Creando preferencia en MercadoPago...');
    const mpService = getMercadoPagoService();
    const preference = await mpService.createPreference(debt, user);
    
    console.log('✅ Preferencia creada en MP:', preference.id);
    
    // Crear registro de pago
    const payment = new Payment({
      user: new ObjectId(userId),
      debt: new ObjectId(debtId),
      amount: debt.amount,
      currency: debt.currency,
      status: 'pending',
      mercadopago: {
        preferenceId: preference.id,
        externalReference: preference.external_reference
      },
      urls: {
        success: process.env.PAYMENT_SUCCESS_URL,
        failure: process.env.PAYMENT_FAILURE_URL,
        pending: process.env.PAYMENT_PENDING_URL
      },
      transactionDetails: {
        ip: req.ip,
        userAgent: req.get('user-agent')
      }
    });
    
    await payment.save();
    console.log('💾 Pago registrado:', payment._id);
    
    // Marcar la deuda como en proceso
    await debt.markAsProcessing();
    
    res.json({
      status: 'success',
      message: 'Preferencia de pago creada exitosamente',
      data: {
        preferenceId: preference.id,
        initPoint: preference.init_point,
        sandboxInitPoint: preference.sandbox_init_point,
        expirationDate: preference.expiration_date_to,
        paymentId: payment._id
      }
    });
  } catch (error) {
    console.error('❌ Error creando preferencia de pago:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al crear la preferencia de pago',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Obtener información de un pago
const getPayment = async (req, res) => {
  try {
    console.log('🔍 === OBTENIENDO PAGO ===');
    const { id } = req.params;
    const userId = req.user.userId;
    
    console.log('💳 Payment ID:', id);
    console.log('👤 User ID:', userId);
    
    // CORRECCIÓN: Usar new ObjectId()
    const payment = await Payment.findOne({ 
      _id: new ObjectId(id), 
      user: new ObjectId(userId) 
    })
    .populate('debt', 'description amount dueDate status')
    .lean();
    
    if (!payment) {
      console.error('❌ Pago no encontrado');
      return res.status(404).json({
        status: 'error',
        message: 'Pago no encontrado'
      });
    }
    
    console.log('✅ Pago encontrado:', payment._id);
    
    // Si el pago está aprobado, intentar obtener info actualizada de MP
    if (payment.mercadopago.paymentId && payment.status === 'approved') {
      try {
        const mpService = getMercadoPagoService();
        const mpPayment = await mpService.getPayment(payment.mercadopago.paymentId);
        
        // Agregar información adicional de MP
        payment.mercadopago = {
          ...payment.mercadopago,
          lastUpdated: new Date(),
          currentStatus: mpPayment.status,
          statusDetail: mpPayment.status_detail
        };
        
        console.log('✅ Información actualizada desde MercadoPago');
      } catch (mpError) {
        console.error('⚠️ Error obteniendo info de MP:', mpError);
      }
    }
    
    res.json({
      status: 'success',
      data: payment
    });
  } catch (error) {
    console.error('❌ Error obteniendo pago:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener el pago',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Obtener historial de pagos del usuario
const getPaymentHistory = async (req, res) => {
  try {
    console.log('📋 === OBTENIENDO HISTORIAL DE PAGOS ===');
    const userId = req.user.userId;
    const { status, debtId, page = 1, limit = 10 } = req.query;
    
    console.log('👤 User ID:', userId);
    console.log('🔍 Filtros:', { status, debtId, page, limit });
    
    // Construir filtros con ObjectId corregido
    const filters = { user: new ObjectId(userId) }; // CORRECCIÓN: new ObjectId()
    if (status) filters.status = status;
    if (debtId) filters.debt = new ObjectId(debtId); // CORRECCIÓN: new ObjectId()
    
    // Paginación
    const skip = (page - 1) * limit;
    
    console.log('📊 Filtros construidos:', filters);
    
    // Obtener pagos con paginación
    const [payments, total] = await Promise.all([
      Payment.find(filters)
        .populate('debt', 'description amount')
        .sort('-createdAt')
        .limit(limit * 1)
        .skip(skip)
        .lean(),
      Payment.countDocuments(filters)
    ]);
    
    console.log(`✅ Encontrados ${payments.length} pagos de ${total} totales`);
    
    // Obtener estadísticas usando el método corregido del modelo
    const stats = await Payment.getPaymentStats(userId);
    
    console.log('📈 Estadísticas:', stats);
    
    res.json({
      status: 'success',
      data: {
        payments,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        },
        stats
      }
    });
  } catch (error) {
    console.error('❌ Error obteniendo historial de pagos:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener el historial de pagos',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Verificar estado de pago (callback desde frontend)
const checkPaymentStatus = async (req, res) => {
  try {
    console.log('🔍 === VERIFICANDO ESTADO DE PAGO ===');
    const { external_reference, payment_id, status } = req.query;
    const userId = req.user.userId;
    
    console.log('📋 Parámetros:', { external_reference, payment_id, status });
    
    if (!external_reference) {
      console.error('❌ Referencia externa no proporcionada');
      return res.status(400).json({
        status: 'error',
        message: 'Referencia externa no proporcionada'
      });
    }
    
    // Buscar pago por referencia externa
    const payment = await Payment.findOne({
      'mercadopago.externalReference': external_reference,
      user: new ObjectId(userId) // CORRECCIÓN: new ObjectId()
    }).populate('debt');
    
    if (!payment) {
      console.error('❌ Pago no encontrado para referencia:', external_reference);
      return res.status(404).json({
        status: 'error',
        message: 'Pago no encontrado'
      });
    }
    
    console.log('✅ Pago encontrado:', payment._id);
    
    // Si viene con payment_id, actualizar información
    if (payment_id && status === 'approved') {
      try {
        console.log('🔄 Actualizando desde MercadoPago...');
        const mpService = getMercadoPagoService();
        const mpPayment = await mpService.getPayment(payment_id);
        
        // Actualizar pago con información de MP
        await payment.updateFromMercadoPago(mpPayment);
        
        // Si el pago fue aprobado, marcar la deuda como pagada
        if (mpPayment.status === 'approved') {
          await payment.debt.markAsPaid(payment._id);
          console.log('✅ Deuda marcada como pagada');
        }
      } catch (mpError) {
        console.error('⚠️ Error actualizando desde MP:', mpError);
      }
    }
    
    res.json({
      status: 'success',
      data: {
        payment: {
          id: payment._id,
          status: payment.status,
          amount: payment.amount,
          createdAt: payment.createdAt
        },
        debt: {
          id: payment.debt._id,
          description: payment.debt.description,
          status: payment.debt.status
        }
      }
    });
  } catch (error) {
    console.error('❌ Error verificando estado de pago:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al verificar el estado del pago',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Cancelar un pago pendiente
const cancelPayment = async (req, res) => {
  try {
    console.log('❌ === CANCELANDO PAGO ===');
    const { id } = req.params;
    const userId = req.user.userId;
    const { reason } = req.body;
    
    // CORRECCIÓN: Usar new ObjectId()
    const payment = await Payment.findOne({ 
      _id: new ObjectId(id), 
      user: new ObjectId(userId) 
    });
    
    if (!payment) {
      console.error('❌ Pago no encontrado');
      return res.status(404).json({
        status: 'error',
        message: 'Pago no encontrado'
      });
    }
    
    if (!payment.isPending) {
      console.error('❌ Pago no se puede cancelar, estado:', payment.status);
      return res.status(400).json({
        status: 'error',
        message: 'Solo se pueden cancelar pagos pendientes',
        currentStatus: payment.status
      });
    }
    
    // Cancelar el pago
    await payment.cancel(reason);
    console.log('✅ Pago cancelado');
    
    // Si hay preferencia, intentar cancelarla en MP
    if (payment.mercadopago.preferenceId) {
      try {
        const mpService = getMercadoPagoService();
        await mpService.cancelPreference(payment.mercadopago.preferenceId);
        console.log('✅ Preferencia cancelada en MercadoPago');
      } catch (mpError) {
        console.error('⚠️ Error cancelando en MP:', mpError);
      }
    }
    
    // Actualizar estado de la deuda
    const debt = await Debt.findById(new ObjectId(payment.debt)); // CORRECCIÓN: new ObjectId()
    if (debt && debt.status === 'processing') {
      debt.status = 'pending';
      await debt.save();
      console.log('✅ Estado de deuda actualizado a pending');
    }
    
    res.json({
      status: 'success',
      message: 'Pago cancelado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error cancelando pago:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al cancelar el pago',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Reintentar un pago fallido
const retryPayment = async (req, res) => {
  try {
    console.log('🔄 === REINTENTANDO PAGO ===');
    const { id } = req.params;
    const userId = req.user.userId;
    
    // CORRECCIÓN: Usar new ObjectId()
    const payment = await Payment.findOne({ 
      _id: new ObjectId(id), 
      user: new ObjectId(userId) 
    })
    .populate('debt');
    
    if (!payment) {
      console.error('❌ Pago no encontrado');
      return res.status(404).json({
        status: 'error',
        message: 'Pago no encontrado'
      });
    }
    
    if (!payment.canBeRetried) {
      console.error('❌ Pago no puede ser reintentado');
      return res.status(400).json({
        status: 'error',
        message: 'Este pago no puede ser reintentado',
        currentStatus: payment.status,
        attempts: payment.attempts
      });
    }
    
    // Verificar que la deuda aún pueda ser pagada
    if (!payment.debt.canBePaid()) {
      console.error('❌ Deuda no puede ser pagada');
      return res.status(400).json({
        status: 'error',
        message: 'La deuda asociada no puede ser pagada',
        debtStatus: payment.debt.status
      });
    }
    
    // Crear nueva preferencia
    const user = await User.findById(new ObjectId(userId)); // CORRECCIÓN: new ObjectId()
    const mpService = getMercadoPagoService();
    const preference = await mpService.createPreference(payment.debt, user);
    
    console.log('✅ Nueva preferencia creada:', preference.id);
    
    // Actualizar el pago
    payment.status = 'pending';
    payment.attempts += 1;
    payment.mercadopago.preferenceId = preference.id;
    payment.mercadopago.externalReference = preference.external_reference;
    await payment.save();
    
    // Marcar la deuda como en proceso
    await payment.debt.markAsProcessing();
    
    console.log('✅ Pago reintentado exitosamente');
    
    res.json({
      status: 'success',
      message: 'Pago reintentado exitosamente',
      data: {
        preferenceId: preference.id,
        initPoint: preference.init_point,
        attempts: payment.attempts
      }
    });
  } catch (error) {
    console.error('❌ Error reintentando pago:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al reintentar el pago',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Solicitar reembolso (solo para pagos aprobados)
const requestRefund = async (req, res) => {
  try {
    console.log('💰 === SOLICITANDO REEMBOLSO ===');
    const { id } = req.params;
    const userId = req.user.userId;
    const { reason, amount } = req.body;
    
    // CORRECCIÓN: Usar new ObjectId()
    const payment = await Payment.findOne({ 
      _id: new ObjectId(id), 
      user: new ObjectId(userId),
      status: 'approved'
    });
    
    if (!payment) {
      console.error('❌ Pago aprobado no encontrado');
      return res.status(404).json({
        status: 'error',
        message: 'Pago aprobado no encontrado'
      });
    }
    
    if (!payment.mercadopago.paymentId) {
      console.error('❌ Sin ID de pago de MercadoPago');
      return res.status(400).json({
        status: 'error',
        message: 'No se puede procesar el reembolso sin ID de pago de MP'
      });
    }
    
    // Crear reembolso en MP
    const mpService = getMercadoPagoService();
    const refund = await mpService.createRefund(
      payment.mercadopago.paymentId,
      amount
    );
    
    console.log('✅ Reembolso creado en MercadoPago:', refund.id);
    
    // Actualizar estado del pago
    payment.status = 'refunded';
    payment.statusHistory.push({
      status: 'refunded',
      date: new Date(),
      reason: reason || 'Reembolso solicitado',
      details: refund
    });
    await payment.save();
    
    // Actualizar estado de la deuda si es reembolso total
    if (!amount || amount >= payment.amount) {
      const debt = await Debt.findById(new ObjectId(payment.debt)); // CORRECCIÓN: new ObjectId()
      if (debt) {
        debt.status = 'pending';
        await debt.save();
        console.log('✅ Deuda marcada como pending tras reembolso total');
      }
    }
    
    res.json({
      status: 'success',
      message: 'Reembolso procesado exitosamente',
      data: {
        refundId: refund.id,
        amount: refund.amount,
        status: refund.status
      }
    });
  } catch (error) {
    console.error('❌ Error procesando reembolso:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al procesar el reembolso',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  createPaymentPreference,
  getPayment,
  getPaymentHistory,
  checkPaymentStatus,
  cancelPayment,
  retryPayment,
  requestRefund
};