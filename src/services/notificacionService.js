const nodemailer = require('nodemailer');
const Cliente = require('../models/clienteSchema');

// Configuración del transporte de correo
let transporter;

// Inicializar el servicio de notificaciones
const inicializar = () => {
  // Crear transporter con configuración desde variables de entorno
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// Enviar recordatorio de pago próximo
const enviarRecordatorioPago = async (idCliente) => {
  try {
    if (!transporter) inicializar();
    
    const cliente = await Cliente.findById(idCliente);
    
    if (!cliente) {
      throw new Error(`Cliente con ID ${idCliente} no encontrado`);
    }
    
    // Formatear fecha de pago
    const fechaPago = cliente.fechaProximoPago.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    // Enviar correo de recordatorio
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: cliente.email,
      subject: 'Recordatorio de Pago Próximo',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Recordatorio de Pago</h2>
          <p>Estimado/a ${cliente.nombre},</p>
          <p>Le recordamos que su próximo pago está programado para el <strong>${fechaPago}</strong>.</p>
          <p>Detalles del pago:</p>
          <ul>
            <li>Programa: ${cliente.programaAdquirido}</li>
            <li>Plan: ${cliente.plan}</li>
            <li>Monto: $${cliente.montoEstablecido.toFixed(2)}</li>
          </ul>
          <p>Por favor, asegúrese de realizar el pago antes de la fecha indicada para evitar interrupciones en su servicio.</p>
          <p>Si ya ha realizado el pago, por favor ignore este mensaje.</p>
          <p>Gracias por su preferencia.</p>
        </div>
      `
    });
    
    // Marcar recordatorio como enviado
    cliente.recordatorioEnviado = true;
    await cliente.save();
    
    return {
      enviado: true,
      messageId: info.messageId,
      cliente: {
        id: cliente._id,
        email: cliente.email,
        nombre: cliente.nombre
      }
    };
  } catch (error) {
    console.error('Error al enviar recordatorio:', error);
    return {
      enviado: false,
      error: error.message
    };
  }
};

// Enviar aviso de pago vencido y suspensión inminente
const enviarAvisoSuspension = async (idCliente) => {
  try {
    if (!transporter) inicializar();
    
    const cliente = await Cliente.findById(idCliente);
    
    if (!cliente) {
      throw new Error(`Cliente con ID ${idCliente} no encontrado`);
    }
    
    // Calcular fecha límite (fin del periodo de gracia)
    const fechaLimite = new Date(cliente.fechaProximoPago);
    fechaLimite.setDate(fechaLimite.getDate() + cliente.diasGracia);
    
    const fechaLimiteStr = fechaLimite.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    // Enviar correo de aviso
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: cliente.email,
      subject: 'IMPORTANTE: Pago vencido - Riesgo de suspensión de servicio',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #cc0000;">Aviso de Pago Vencido</h2>
          <p>Estimado/a ${cliente.nombre},</p>
          <p>Nuestro sistema ha detectado que su pago programado no ha sido registrado y actualmente se encuentra <strong>vencido</strong>.</p>
          <p>Detalles del servicio:</p>
          <ul>
            <li>Programa: ${cliente.programaAdquirido}</li>
            <li>Plan: ${cliente.plan}</li>
            <li>Monto pendiente: $${cliente.montoEstablecido.toFixed(2)}</li>
          </ul>
          <p style="color: #cc0000; font-weight: bold;">Si no recibimos su pago antes del ${fechaLimiteStr}, su servicio será suspendido automáticamente.</p>
          <p>Por favor, realice su pago lo antes posible para evitar interrupciones.</p>
          <p>Si ya ha realizado el pago, por favor comuníquese con nosotros para verificar el estado de su cuenta.</p>
          <p>Gracias por su atención inmediata a este asunto.</p>
        </div>
      `
    });
    
    // Marcar aviso como enviado
    cliente.avisoSuspensionEnviado = true;
    await cliente.save();
    
    return {
      enviado: true,
      messageId: info.messageId,
      cliente: {
        id: cliente._id,
        email: cliente.email,
        nombre: cliente.nombre
      }
    };
  } catch (error) {
    console.error('Error al enviar aviso de suspensión:', error);
    return {
      enviado: false,
      error: error.message
    };
  }
};

// Enviar notificación de suspensión de servicio
const enviarNotificacionSuspension = async (idCliente) => {
  try {
    if (!transporter) inicializar();
    
    const cliente = await Cliente.findById(idCliente);
    
    if (!cliente) {
      throw new Error(`Cliente con ID ${idCliente} no encontrado`);
    }
    
    // Enviar correo de suspensión
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: cliente.email,
      subject: 'URGENTE: Servicio suspendido por falta de pago',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #cc0000;">Servicio Suspendido</h2>
          <p>Estimado/a ${cliente.nombre},</p>
          <p>Lamentamos informarle que su servicio de <strong>${cliente.programaAdquirido}</strong> ha sido <strong>suspendido</strong> debido a la falta de pago.</p>
          <p>Para reactivar su servicio, por favor realice el pago pendiente a la brevedad posible:</p>
          <ul>
            <li>Programa: ${cliente.programaAdquirido}</li>
            <li>Plan: ${cliente.plan}</li>
            <li>Monto a pagar: $${cliente.montoEstablecido.toFixed(2)}</li>
          </ul>
          <p>Una vez realizado el pago, su servicio será reactivado en un plazo máximo de 24 horas.</p>
          <p>Si tiene alguna duda o necesita asistencia, por favor comuníquese con nuestro equipo de soporte.</p>
        </div>
      `
    });
    
    return {
      enviado: true,
      messageId: info.messageId,
      cliente: {
        id: cliente._id,
        email: cliente.email,
        nombre: cliente.nombre
      }
    };
  } catch (error) {
    console.error('Error al enviar notificación de suspensión:', error);
    return {
      enviado: false,
      error: error.message
    };
  }
};

// Enviar notificación de pago recibido
const enviarConfirmacionPago = async (idCliente, datosPago) => {
  try {
    if (!transporter) inicializar();
    
    const cliente = await Cliente.findById(idCliente);
    
    if (!cliente) {
      throw new Error(`Cliente con ID ${idCliente} no encontrado`);
    }
    
    // Formatear fechas
    const fechaPago = new Date(datosPago.fechaPago).toLocaleDateString('es-ES');
    const fechaInicio = new Date(datosPago.periodoFacturado.inicio).toLocaleDateString('es-ES');
    const fechaFin = new Date(datosPago.periodoFacturado.fin).toLocaleDateString('es-ES');
    
    // Enviar correo de confirmación
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: cliente.email,
      subject: 'Confirmación de Pago Recibido',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">Pago Recibido</h2>
          <p>Estimado/a ${cliente.nombre},</p>
          <p>Hemos recibido su pago correctamente. ¡Gracias!</p>
          <p>Detalles de la transacción:</p>
          <ul>
            <li>Fecha de pago: ${fechaPago}</li>
            <li>Monto: $${datosPago.monto.toFixed(2)}</li>
            <li>Método de pago: ${datosPago.metodoPago}</li>
            <li>Periodo facturado: ${fechaInicio} al ${fechaFin}</li>
          </ul>
          <p>Su servicio de <strong>${cliente.programaAdquirido}</strong> continuará activo hasta su próximo pago.</p>
          <p>Le agradecemos su preferencia.</p>
        </div>
      `
    });
    
    return {
      enviado: true,
      messageId: info.messageId,
      cliente: {
        id: cliente._id,
        email: cliente.email,
        nombre: cliente.nombre
      }
    };
  } catch (error) {
    console.error('Error al enviar confirmación de pago:', error);
    return {
      enviado: false,
      error: error.message
    };
  }
};

module.exports = {
  inicializar,
  enviarRecordatorioPago,
  enviarAvisoSuspension,
  enviarNotificacionSuspension,
  enviarConfirmacionPago
};