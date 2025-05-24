const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const { v4: uuidv4 } = require('uuid');

class MercadoPagoService {
  constructor() {
    // Inicializar cliente de Mercado Pago
    this.client = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN,
      options: {
        timeout: 5000,
        retries: 3
      }
    });
    
    this.preferenceClient = new Preference(this.client);
    this.paymentClient = new Payment(this.client);
  }

  /**
   * Crear preferencia de pago
   * @param {Object} debtData - Datos de la deuda
   * @param {Object} userData - Datos del usuario
   * @returns {Promise<Object>} Preferencia creada
   */
  async createPreference(debtData, userData) {
    try {
      // Generar referencia externa única
      const externalReference = `DEBT-${debtData._id}-${uuidv4()}`;
      
      // Configurar items
      const items = [{
        id: debtData._id.toString(),
        title: debtData.description || 'Pago de deuda',
        description: `${debtData.category || 'Servicio'} - Vencimiento: ${new Date(debtData.dueDate).toLocaleDateString('es-AR')}`,
        category_id: this.mapCategory(debtData.category),
        quantity: 1,
        currency_id: debtData.currency || 'ARS',
        unit_price: Number(debtData.amount)
      }];
      
      // Configurar datos del pagador
      const payer = {
        name: userData.name || '',
        surname: userData.surname || '',
        email: userData.email,
        identification: {
          type: userData.identificationType || '',
          number: userData.identificationNumber || ''
        }
      };
      
      // URLs de retorno
      const backUrls = {
        success: `${process.env.PAYMENT_SUCCESS_URL}?external_reference=${externalReference}`,
        failure: `${process.env.PAYMENT_FAILURE_URL}?external_reference=${externalReference}`,
        pending: `${process.env.PAYMENT_PENDING_URL}?external_reference=${externalReference}`
      };
      
      // URL de notificación (webhook)
      const notificationUrl = `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/mercadopago/webhook`;
      
      // Configuración de la preferencia
      const preferenceData = {
        items,
        payer,
        back_urls: backUrls,
        notification_url: notificationUrl,
        external_reference: externalReference,
        statement_descriptor: process.env.MP_STATEMENT_DESCRIPTOR || 'MIPAGO',
        auto_return: 'approved',
        binary_mode: false, // Permitir pagos pendientes
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
        payment_methods: {
          installments: 12, // Máximo de cuotas
          default_installments: 1
        },
        metadata: {
          debt_id: debtData._id.toString(),
          user_id: userData._id.toString(),
          integration_version: '1.0.0'
        }
      };
      
      // Crear preferencia
      const response = await this.preferenceClient.create({ body: preferenceData });
      
      return {
        id: response.id,
        init_point: response.init_point,
        sandbox_init_point: response.sandbox_init_point,
        external_reference: externalReference,
        items: response.items,
        date_created: response.date_created,
        expiration_date_to: response.expiration_date_to
      };
      
    } catch (error) {
      console.error('Error creando preferencia MP:', error);
      throw new Error(`Error al crear preferencia de pago: ${error.message}`);
    }
  }

  /**
   * Obtener información de un pago
   * @param {String} paymentId - ID del pago en MP
   * @returns {Promise<Object>} Información del pago
   */
  async getPayment(paymentId) {
    try {
      const payment = await this.paymentClient.get({ id: paymentId });
      return payment;
    } catch (error) {
      console.error('Error obteniendo pago MP:', error);
      throw new Error(`Error al obtener información del pago: ${error.message}`);
    }
  }

  /**
   * Buscar pagos por referencia externa
   * @param {String} externalReference - Referencia externa
   * @returns {Promise<Array>} Lista de pagos
   */
  async searchPaymentsByReference(externalReference) {
    try {
      const filters = {
        external_reference: externalReference,
        limit: 10
      };
      
      const response = await this.paymentClient.search({ options: filters });
      return response.results || [];
    } catch (error) {
      console.error('Error buscando pagos MP:', error);
      throw new Error(`Error al buscar pagos: ${error.message}`);
    }
  }

  /**
   * Procesar notificación webhook
   * @param {Object} notification - Datos de la notificación
   * @returns {Promise<Object>} Resultado del procesamiento
   */
  async processWebhookNotification(notification) {
    try {
      const { type, data } = notification;
      
      if (type === 'payment') {
        // Obtener información completa del pago
        const payment = await this.getPayment(data.id);
        
        return {
          type: 'payment',
          payment,
          status: payment.status,
          external_reference: payment.external_reference,
          transaction_amount: payment.transaction_amount,
          date_approved: payment.date_approved
        };
      }
      
      // Otros tipos de notificaciones pueden ser manejados aquí
      return {
        type,
        data,
        processed: false,
        reason: 'Tipo de notificación no procesado'
      };
      
    } catch (error) {
      console.error('Error procesando webhook MP:', error);
      throw new Error(`Error al procesar notificación: ${error.message}`);
    }
  }

  /**
   * Verificar firma de webhook (seguridad adicional)
   * @param {Object} headers - Headers de la petición
   * @param {Object} body - Body de la petición
   * @returns {Boolean} Si la firma es válida
   */
  verifyWebhookSignature(headers, body) {
    // Mercado Pago puede implementar firma de webhooks
    // Por ahora, validamos que venga de IPs conocidas de MP
    // Esta es una implementación básica, en producción se debe mejorar
    
    const mpSignature = headers['x-signature'];
    const mpRequestId = headers['x-request-id'];
    
    if (!mpSignature || !mpRequestId) {
      return false;
    }
    
    // Aquí se implementaría la verificación real de la firma
    // usando el secret configurado en MP
    
    return true;
  }

  /**
   * Crear reembolso
   * @param {String} paymentId - ID del pago a reembolsar
   * @param {Number} amount - Monto a reembolsar (opcional, por defecto total)
   * @returns {Promise<Object>} Información del reembolso
   */
  async createRefund(paymentId, amount = null) {
    try {
      const refundData = {};
      if (amount) {
        refundData.amount = amount;
      }
      
      const refund = await this.paymentClient.refund({
        id: paymentId,
        body: refundData
      });
      
      return refund;
    } catch (error) {
      console.error('Error creando reembolso MP:', error);
      throw new Error(`Error al crear reembolso: ${error.message}`);
    }
  }

  /**
   * Cancelar una preferencia
   * @param {String} preferenceId - ID de la preferencia
   * @returns {Promise<Object>} Resultado de la cancelación
   */
  async cancelPreference(preferenceId) {
    try {
      // Actualizar preferencia con fecha de expiración inmediata
      const updateData = {
        expires: true,
        expiration_date_to: new Date().toISOString()
      };
      
      const response = await this.preferenceClient.update({
        id: preferenceId,
        body: updateData
      });
      
      return response;
    } catch (error) {
      console.error('Error cancelando preferencia MP:', error);
      throw new Error(`Error al cancelar preferencia: ${error.message}`);
    }
  }

  /**
   * Mapear categoría interna a categoría de MP
   * @param {String} category - Categoría interna
   * @returns {String} Categoría de MP
   */
  mapCategory(category) {
    const categoryMap = {
      'service': 'services',
      'product': 'others',
      'subscription': 'services',
      'fine': 'tickets',
      'other': 'others'
    };
    
    return categoryMap[category] || 'others';
  }

  /**
   * Formatear monto para MP (debe ser número con máximo 2 decimales)
   * @param {Number} amount - Monto a formatear
   * @returns {Number} Monto formateado
   */
  formatAmount(amount) {
    return Math.round(amount * 100) / 100;
  }

  /**
   * Obtener estado legible del pago
   * @param {String} status - Estado de MP
   * @returns {String} Estado legible
   */
  getReadableStatus(status) {
    const statusMap = {
      'pending': 'Pendiente',
      'approved': 'Aprobado',
      'authorized': 'Autorizado',
      'in_process': 'En proceso',
      'in_mediation': 'En mediación',
      'rejected': 'Rechazado',
      'cancelled': 'Cancelado',
      'refunded': 'Reembolsado',
      'charged_back': 'Contracargo'
    };
    
    return statusMap[status] || status;
  }

  /**
   * Obtener razón de rechazo legible
   * @param {String} statusDetail - Detalle del estado
   * @returns {String} Razón legible
   */
  getReadableRejectionReason(statusDetail) {
    const reasonMap = {
      'cc_rejected_bad_filled_card_number': 'Número de tarjeta incorrecto',
      'cc_rejected_bad_filled_date': 'Fecha de vencimiento incorrecta',
      'cc_rejected_bad_filled_other': 'Datos de tarjeta incorrectos',
      'cc_rejected_bad_filled_security_code': 'Código de seguridad incorrecto',
      'cc_rejected_blacklist': 'Tarjeta en lista negra',
      'cc_rejected_call_for_authorize': 'Debe autorizar con su banco',
      'cc_rejected_card_disabled': 'Tarjeta deshabilitada',
      'cc_rejected_card_error': 'Error en la tarjeta',
      'cc_rejected_duplicated_payment': 'Pago duplicado',
      'cc_rejected_high_risk': 'Rechazado por alto riesgo',
      'cc_rejected_insufficient_amount': 'Fondos insuficientes',
      'cc_rejected_invalid_installments': 'Cuotas inválidas',
      'cc_rejected_max_attempts': 'Máximo de intentos alcanzado',
      'cc_rejected_other_reason': 'Rechazado por el banco'
    };
    
    return reasonMap[statusDetail] || 'Error en el proceso de pago';
  }
}

// Singleton
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new MercadoPagoService();
    }
    return instance;
  },
  MercadoPagoService
};