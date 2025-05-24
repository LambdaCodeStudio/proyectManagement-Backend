const Payment = require('../models/payment');
const Debt = require('../models/debt');
const { getInstance: getMercadoPagoService } = require('../services/mercadopago');

// Procesar webhook de Mercado Pago
const handleWebhook = async (req, res) => {
  try {
    console.log('Webhook recibido:', {
      headers: req.headers,
      query: req.query,
      body: req.body
    });
    
    // Responder inmediatamente con 200 OK
    res.status(200).send('OK');
    
    // Procesar webhook de forma asíncrona
    processWebhookAsync(req.body, req.headers, req.query);
    
  } catch (error) {
    console.error('Error en webhook:', error);
    // Aún así responder 200 para evitar reintentos de MP
    res.status(200).send('OK');
  }
};

// Procesar webhook de forma asíncrona
const processWebhookAsync = async (body, headers, query) => {
  try {
    const mpService = getMercadoPagoService();
    
    // Verificar firma del webhook (si está implementado)
    const isValid = mpService.verifyWebhookSignature(headers, body);
    if (!isValid) {
      console.warn('Webhook con firma inválida:', { headers, body });
      // En producción, rechazar webhooks inválidos
      // return;
    }
    
    // Determinar tipo de notificación
    let notificationType, dataId;
    
    if (query.type && query['data.id']) {
      // Formato nuevo de webhooks
      notificationType = query.type;
      dataId = query['data.id'];
    } else if (body.type && body.data?.id) {
      // Formato con body
      notificationType = body.type;
      dataId = body.data.id;
    } else if (query.topic && query.id) {
      // Formato antiguo (IPN)
      notificationType = query.topic;
      dataId = query.id;
    } else {
      console.warn('Formato de webhook no reconocido:', { body, query });
      return;
    }
    
    console.log('Procesando notificación:', { type: notificationType, id: dataId });
    
    // Procesar según el tipo
    switch (notificationType) {
      case 'payment':
        await processPaymentNotification(dataId);
        break;
        
      case 'merchant_order':
        await processMerchantOrderNotification(dataId);
        break;
        
      case 'plan':
      case 'subscription':
        // Para futuras implementaciones de suscripciones
        console.log('Notificación de suscripción recibida:', dataId);
        break;
        
      default:
        console.log('Tipo de notificación no manejado:', notificationType);
    }
    
  } catch (error) {
    console.error('Error procesando webhook async:', error);
    // En producción, considerar guardar en una cola para reprocesar
  }
};

// Procesar notificación de pago
const processPaymentNotification = async (paymentId) => {
  try {
    const mpService = getMercadoPagoService();
    
    // Obtener información del pago desde MP
    const mpPayment = await mpService.getPayment(paymentId);
    
    console.log('Información del pago MP:', {
      id: mpPayment.id,
      status: mpPayment.status,
      external_reference: mpPayment.external_reference
    });
    
    // Buscar el pago en nuestra base de datos
    let payment = await Payment.findByMercadoPagoId(paymentId);
    
    // Si no se encuentra por ID, buscar por referencia externa
    if (!payment && mpPayment.external_reference) {
      payment = await Payment.findByExternalReference(mpPayment.external_reference);
    }
    
    if (!payment) {
      console.warn('Pago no encontrado en BD:', {
        mpId: paymentId,
        externalRef: mpPayment.external_reference
      });
      // Podría ser un pago creado directamente en MP
      return;
    }
    
    // Guardar información del webhook
    await payment.addWebhook({
      id: mpPayment.id,
      type: 'payment',
      action: mpPayment.status,
      data: {
        status: mpPayment.status,
        status_detail: mpPayment.status_detail,
        date_approved: mpPayment.date_approved,
        transaction_amount: mpPayment.transaction_amount
      }
    });
    
    // Actualizar el pago con la información de MP
    const previousStatus = payment.status;
    await payment.updateFromMercadoPago(mpPayment);
    
    console.log('Pago actualizado:', {
      id: payment._id,
      previousStatus,
      newStatus: payment.status
    });
    
    // Si el pago fue aprobado, actualizar la deuda
    if (payment.status === 'approved' && previousStatus !== 'approved') {
      const debt = await Debt.findById(payment.debt);
      
      if (debt) {
        // Marcar la deuda como pagada
        await debt.markAsPaid(payment._id);
        
        console.log('Deuda marcada como pagada:', debt._id);
        
        // Aquí se podrían enviar notificaciones al usuario
        // Por ejemplo: email de confirmación, SMS, push notification
        await sendPaymentConfirmation(payment, debt);
      }
    }
    
    // Si el pago fue rechazado
    if (payment.status === 'rejected' && previousStatus === 'processing') {
      const debt = await Debt.findById(payment.debt);
      
      if (debt && debt.status === 'processing') {
        // Volver la deuda a estado pendiente
        debt.status = 'pending';
        await debt.save();
        
        // Notificar al usuario del rechazo
        await sendPaymentRejectionNotification(payment, debt, mpPayment.status_detail);
      }
    }
    
  } catch (error) {
    console.error('Error procesando notificación de pago:', error);
    throw error;
  }
};

// Procesar notificación de orden de comerciante
const processMerchantOrderNotification = async (orderId) => {
  try {
    console.log('Procesando merchant order:', orderId);
    
    // Las merchant orders agrupan pagos
    // Por ahora solo logueamos
    // En el futuro se podría usar para manejar pagos parciales
    
  } catch (error) {
    console.error('Error procesando merchant order:', error);
  }
};

// Enviar confirmación de pago
const sendPaymentConfirmation = async (payment, debt) => {
  try {
    // Aquí implementar el envío de notificaciones
    console.log('Enviando confirmación de pago:', {
      paymentId: payment._id,
      debtId: debt._id,
      amount: payment.amount,
      userEmail: payment.mercadopago.payer?.email
    });
    
    // Ejemplo de implementación:
    // - Enviar email con recibo
    // - Enviar SMS de confirmación
    // - Enviar push notification
    // - Generar PDF de comprobante
    
  } catch (error) {
    console.error('Error enviando confirmación:', error);
  }
};

// Enviar notificación de rechazo
const sendPaymentRejectionNotification = async (payment, debt, reason) => {
  try {
    const mpService = getMercadoPagoService();
    const readableReason = mpService.getReadableRejectionReason(reason);
    
    console.log('Enviando notificación de rechazo:', {
      paymentId: payment._id,
      debtId: debt._id,
      reason: readableReason
    });
    
    // Implementar notificaciones de rechazo
    
  } catch (error) {
    console.error('Error enviando notificación de rechazo:', error);
  }
};

// Endpoint de prueba para webhooks (desarrollo)
const testWebhook = async (req, res) => {
  try {
    const { paymentId, status } = req.body;
    
    if (!paymentId || !status) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere paymentId y status'
      });
    }
    
    // Simular una notificación de pago
    const mockNotification = {
      type: 'payment',
      data: {
        id: paymentId
      }
    };
    
    // Procesar como si fuera un webhook real
    await processWebhookAsync(mockNotification, {}, {});
    
    res.json({
      status: 'success',
      message: 'Webhook de prueba procesado'
    });
  } catch (error) {
    console.error('Error en webhook de prueba:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al procesar webhook de prueba'
    });
  }
};

// Obtener logs de webhooks (para debugging)
const getWebhookLogs = async (req, res) => {
  try {
    const { paymentId, limit = 10 } = req.query;
    
    const filter = {};
    if (paymentId) {
      filter._id = paymentId;
    }
    
    const payments = await Payment.find(filter)
      .select('mercadopago.paymentId webhooksReceived')
      .sort('-updatedAt')
      .limit(parseInt(limit))
      .lean();
    
    const logs = payments.map(p => ({
      paymentId: p._id,
      mercadoPagoId: p.mercadopago?.paymentId,
      webhooks: p.webhooksReceived || []
    }));
    
    res.json({
      status: 'success',
      data: logs
    });
  } catch (error) {
    console.error('Error obteniendo logs:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener logs de webhooks'
    });
  }
};

module.exports = {
  handleWebhook,
  testWebhook,
  getWebhookLogs
};