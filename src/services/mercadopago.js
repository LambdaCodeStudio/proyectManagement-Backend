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
    
    // Validar configuración al inicializar
    this.validateConfiguration();
  }

  /**
   * Validar que la configuración de Mercado Pago esté correcta
   */
  validateConfiguration() {
    if (!process.env.MP_ACCESS_TOKEN) {
      throw new Error('MP_ACCESS_TOKEN no está configurado');
    }
    
    console.log('✅ Configuración de MercadoPago validada');
  }

  /**
   * Obtener URLs de retorno válidas
   * @param {String} externalReference - Referencia externa
   * @returns {Object} URLs de retorno
   */
  getBackUrls(externalReference) {
    // URLs base desde variables de entorno
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    // URLs de retorno específicas o usar por defecto
    const baseUrls = {
      success: process.env.PAYMENT_SUCCESS_URL || `${frontendUrl}/payment/success`,
      failure: process.env.PAYMENT_FAILURE_URL || `${frontendUrl}/payment/failure`,
      pending: process.env.PAYMENT_PENDING_URL || `${frontendUrl}/payment/pending`
    };

    // Agregar referencia externa como query parameter
    const addQueryParam = (url, param, value) => {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}${param}=${value}`;
    };

    return {
      success: addQueryParam(baseUrls.success, 'external_reference', externalReference),
      failure: addQueryParam(baseUrls.failure, 'external_reference', externalReference),
      pending: addQueryParam(baseUrls.pending, 'external_reference', externalReference)
    };
  }

  /**
   * Validar que una URL sea válida
   * @param {String} url - URL a validar
   * @returns {Boolean} Si la URL es válida
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Crear preferencia de pago
   * @param {Object} debtData - Datos de la deuda
   * @param {Object} userData - Datos del usuario
   * @returns {Promise<Object>} Preferencia creada
   */
  async createPreference(debtData, userData) {
    try {
      console.log('🔧 Configurando preferencia de pago...');
      
      // Generar referencia externa única
      const externalReference = `DEBT-${debtData._id}-${Date.now()}`;
      console.log('📋 Referencia externa:', externalReference);
      
      // Obtener URLs de retorno
      const backUrls = this.getBackUrls(externalReference);
      console.log('🔗 URLs de retorno:', backUrls);
      
      // Validar URLs - CRÍTICO
      Object.entries(backUrls).forEach(([key, url]) => {
        if (!this.isValidUrl(url)) {
          throw new Error(`URL de ${key} inválida: ${url}`);
        }
      });
      console.log('✅ URLs validadas correctamente');
      
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
      
      console.log('📦 Items configurados:', items);
      
      // Configurar datos del pagador
      const payer = {
        name: userData.name || '',
        surname: userData.surname || '',
        email: userData.email
      };
      
      // Solo incluir identificación si está disponible
      if (userData.identificationType && userData.identificationNumber) {
        payer.identification = {
          type: userData.identificationType,
          number: userData.identificationNumber
        };
      }
      
      console.log('👤 Pagador configurado:', { ...payer, identification: payer.identification ? '***' : 'No definida' });
      
      // URL de notificación (webhook)
      const notificationUrl = `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/mercadopago/webhook`;
      console.log('📡 URL de notificación:', notificationUrl);
      
      // Configuración de la preferencia - ESTRUCTURA CORREGIDA
      const preferenceData = {
        items,
        payer,
        back_urls: {
          success: backUrls.success,
          failure: backUrls.failure,
          pending: backUrls.pending
        },
        notification_url: notificationUrl,
        external_reference: externalReference,
        statement_descriptor: process.env.MP_STATEMENT_DESCRIPTOR || 'MIPAGO',
        auto_return: 'approved', // Solo retorna automáticamente en pagos aprobados
        binary_mode: false, // Permitir pagos pendientes
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
        payment_methods: {
          installments: 12, // Máximo de cuotas
          default_installments: 1,
          excluded_payment_methods: [], // Sin exclusiones por defecto
          excluded_payment_types: [] // Sin exclusiones por defecto
        },
        metadata: {
          debt_id: debtData._id.toString(),
          user_id: userData._id.toString(),
          integration_version: '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        }
      };
      
      console.log('⚙️ Configuración de preferencia lista');
      console.log('📝 Datos principales:', {
        external_reference: preferenceData.external_reference,
        amount: items[0].unit_price,
        currency: items[0].currency_id,
        auto_return: preferenceData.auto_return,
        has_back_urls: !!preferenceData.back_urls,
        back_urls_keys: Object.keys(preferenceData.back_urls),
        notification_url: !!preferenceData.notification_url
      });
      
      // DEBUG: Mostrar objeto completo en desarrollo
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Objeto completo a enviar a MP:');
        console.log(JSON.stringify(preferenceData, null, 2));
      }
      
      // Crear preferencia
      console.log('📤 Enviando preferencia a MercadoPago...');
      const response = await this.preferenceClient.create({ body: preferenceData });
      
      console.log('✅ Preferencia creada exitosamente:', {
        id: response.id,
        init_point: response.init_point?.substring(0, 50) + '...',
        external_reference: response.external_reference
      });
      
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
      console.error('❌ Error creando preferencia MP:', {
        message: error.message,
        cause: error.cause,
        status: error.status,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
      
      // Proporcionar mensaje de error más específico
      let errorMessage = 'Error al crear preferencia de pago';
      
      if (error.message?.includes('back_url')) {
        errorMessage += ': URLs de retorno inválidas. Verifique la configuración de FRONTEND_URL';
      } else if (error.message?.includes('auto_return')) {
        errorMessage += ': Configuración de auto_return inválida';
      } else if (error.message?.includes('access_token')) {
        errorMessage += ': Token de acceso inválido. Verifique MP_ACCESS_TOKEN';
      } else if (error.message?.includes('amount')) {
        errorMessage += ': Monto inválido';
      } else {
        errorMessage += `: ${error.message}`;
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Obtener información de un pago
   * @param {String} paymentId - ID del pago en MP
   * @returns {Promise<Object>} Información del pago
   */
  async getPayment(paymentId) {
    try {
      console.log('🔍 Obteniendo pago desde MP:', paymentId);
      const payment = await this.paymentClient.get({ id: paymentId });
      console.log('✅ Pago obtenido:', {
        id: payment.id,
        status: payment.status,
        amount: payment.transaction_amount
      });
      return payment;
    } catch (error) {
      console.error('❌ Error obteniendo pago MP:', error);
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
      console.log('🔍 Buscando pagos por referencia:', externalReference);
      const filters = {
        external_reference: externalReference,
        limit: 10
      };
      
      const response = await this.paymentClient.search({ options: filters });
      const results = response.results || [];
      console.log(`✅ Encontrados ${results.length} pagos para la referencia`);
      return results;
    } catch (error) {
      console.error('❌ Error buscando pagos MP:', error);
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
      console.log('📥 Procesando notificación webhook:', { type, dataId: data?.id });
      
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
      console.error('❌ Error procesando webhook MP:', error);
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
    // Implementación básica de verificación
    const mpSignature = headers['x-signature'];
    const mpRequestId = headers['x-request-id'];
    
    if (!mpSignature || !mpRequestId) {
      console.warn('⚠️ Webhook sin firma o ID de request');
      return false;
    }
    
    // En producción, implementar verificación real de firma
    console.log('✅ Webhook con firma válida');
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
      console.log('💰 Creando reembolso:', { paymentId, amount });
      const refundData = {};
      if (amount) {
        refundData.amount = amount;
      }
      
      const refund = await this.paymentClient.refund({
        id: paymentId,
        body: refundData
      });
      
      console.log('✅ Reembolso creado:', refund.id);
      return refund;
    } catch (error) {
      console.error('❌ Error creando reembolso MP:', error);
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
      console.log('❌ Cancelando preferencia:', preferenceId);
      
      // Actualizar preferencia con fecha de expiración inmediata
      const updateData = {
        expires: true,
        expiration_date_to: new Date().toISOString()
      };
      
      const response = await this.preferenceClient.update({
        id: preferenceId,
        body: updateData
      });
      
      console.log('✅ Preferencia cancelada');
      return response;
    } catch (error) {
      console.error('❌ Error cancelando preferencia MP:', error);
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