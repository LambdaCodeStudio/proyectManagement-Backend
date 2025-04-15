const Cliente = require('../../models/clienteSchema');
const Pago = require('../../models/pagoSchema');
const { Payment, PreApproval } = require('mercadopago');
const mercadopago = require('../../config/mrecadopago');

// Procesar webhooks de MercadoPago
const procesarWebhook = async (req, res) => {
  try {
    const { type, data } = req.body;
    
    // Procesar notificación de pago
    if (type === 'payment') {
      const paymentId = data.id;
      const payment = await new Payment(mercadopago).get({ id: paymentId });
      
      // Buscar cliente por suscripción
      const cliente = await Cliente.findOne({ suscripcionId: payment.preapproval_id });
      if (!cliente) {
        return res.status(404).send('Cliente no encontrado');
      }
      
      // Registrar el pago
      const nuevoPago = new Pago({
        cliente: cliente._id,
        monto: payment.transaction_amount,
        idTransaccion: payment.id,
        metodo: 'MercadoPago - ' + payment.payment_method_id,
        estado: payment.status === 'approved' ? 'aprobado' : 'pendiente',
        descripcion: `Pago recurrente - ${cliente.programaAdquirido}`
      });
      
      await nuevoPago.save();
      
      // Actualizar estado del cliente si el pago es aprobado
      if (payment.status === 'approved') {
        cliente.estadoPagoActual = 'pagado';
        cliente.fechaUltimoPago = new Date();
        cliente.fechaProximoPago = new Date(new Date().setMonth(new Date().getMonth() + 1));
        await cliente.save();
      }
    }
    
    // Procesar notificación de suscripción
    if (type === 'preapproval') {
      const preapprovalId = data.id;
      const subscription = await new PreApproval(mercadopago).get({ id: preapprovalId });
      
      // Buscar cliente por suscripción
      const cliente = await Cliente.findOne({ suscripcionId: preapprovalId });
      if (!cliente) {
        return res.status(404).send('Cliente no encontrado');
      }
      
      // Actualizar estado del cliente según estado de la suscripción
      switch (subscription.status) {
        case 'authorized':
          cliente.estado = 'activo';
          break;
        case 'paused':
          cliente.estado = 'suspendido';
          break;
        case 'cancelled':
          cliente.estado = 'inactivo';
          break;
        default:
          break;
      }
      
      await cliente.save();
    }
    
    res.status(200).send('Webhook procesado correctamente');
  } catch (error) {
    console.error('Error procesando webhook:', error);
    res.status(500).send('Error procesando webhook');
  }
};

module.exports = {
  procesarWebhook
};