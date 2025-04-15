/**
 * cronjob.js
 * Sistema de tareas programadas para gestión de clientes, pagos y suscripciones
 * Integra funcionalidades de gestión de pagos con MercadoPago y servicios de notificación
 */

require('dotenv').config();
const cron = require('node-cron');
const mongoose = require('mongoose');
const Cliente = require('../models/clienteSchema');
const { PreApproval } = require('mercadopago');
const mercadopago = require('../config/mercadopago');
const pagosLogic = require('../logic/pagosLogic');
const notificacionService = require('../services/notificacionService');
const tokenService = require('../services/tokenService');

/**
 * Configuración inicial de la conexión a MongoDB
 * Esta función debe ser llamada antes de iniciar las tareas programadas
 */
const inicializarConexion = () => {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB conectado para tareas programadas'))
    .catch(err => {
      console.error('Error al conectar a MongoDB:', err);
      process.exit(1);
    });

  // Inicializar servicio de notificaciones
  notificacionService.inicializar();

  // Manejar cierre de conexión al finalizar proceso
  process.on('SIGINT', () => {
    mongoose.connection.close(() => {
      console.log('Conexión a MongoDB cerrada');
      process.exit(0);
    });
  });
};

/**
 * Verifica clientes con pagos vencidos y actualiza su estado
 * Consulta directamente con MercadoPago para confirmar el estado real de la suscripción
 * @returns {Promise<Object>} Resultado de la verificación con conteo de clientes procesados
 */
const verificarPagosVencidos = async () => {
  try {
    console.log('[Cron] Iniciando verificación de pagos vencidos...');
    const hoy = new Date();
    
    // Buscar clientes activos con fecha de próximo pago anterior a hoy
    const clientesConPagosVencidos = await Cliente.find({
      estado: 'activo',
      estadoPagoActual: { $ne: 'vencido' }, // No incluir los que ya están marcados como vencidos
      fechaProximoPago: { $lt: hoy }
    });
    
    console.log(`[Cron] Encontrados ${clientesConPagosVencidos.length} clientes con pagos vencidos`);
    const clientesProcesados = [];
    
    // Actualizar estado de cada cliente con pago vencido
    for (const cliente of clientesConPagosVencidos) {
      // Verificar el estado real en MercadoPago (por si el webhook falló)
      if (cliente.suscripcionId) {
        try {
          const suscripcion = await new PreApproval(mercadopago).get({ id: cliente.suscripcionId });
          
          // Si la suscripción está pausada o cancelada en MercadoPago, actualizar estado local
          if (suscripcion.status === 'paused') {
            cliente.estado = 'suspendido';
          } else if (suscripcion.status === 'cancelled') {
            cliente.estado = 'inactivo';
          }
        } catch (mpError) {
          console.error(`[Cron] Error al consultar MercadoPago para cliente ${cliente._id}:`, mpError.message);
          // Continuar con la actualización local aunque falle la consulta a MercadoPago
        }
      }
      
      // Marcar el pago como vencido
      cliente.estadoPagoActual = 'vencido';
      
      // Si está activo por más de X días vencido, suspender la suscripción
      const diasDeGracia = 5; // Configurable: días de gracia antes de suspender
      const diasVencido = Math.floor((hoy - cliente.fechaProximoPago) / (1000 * 60 * 60 * 24));
      
      if (diasVencido > diasDeGracia && cliente.estado === 'activo') {
        console.log(`[Cron] Suspendiendo cliente ${cliente._id} por pago vencido hace ${diasVencido} días`);
        cliente.estado = 'suspendido';
        
        // Suspender suscripción en MercadoPago si existe
        if (cliente.suscripcionId) {
          try {
            await new PreApproval(mercadopago).update({
              id: cliente.suscripcionId,
              status: "paused",
            });
            
            // Desactivar token de acceso
            await tokenService.desactivarToken(cliente._id);
            
            // Enviar notificación de suspensión
            await notificacionService.enviarNotificacionSuspension(cliente._id);
          } catch (mpError) {
            console.error(`[Cron] Error al suspender suscripción en MercadoPago:`, mpError.message);
          }
        }
      }
      
      await cliente.save();
      console.log(`[Cron] Actualizado cliente ${cliente._id}: estadoPagoActual=${cliente.estadoPagoActual}, estado=${cliente.estado}`);
      clientesProcesados.push(cliente);
    }
    
    console.log('[Cron] Verificación de pagos vencidos completada');
    return {
      total: clientesProcesados.length,
      clientesProcesados
    };
  } catch (error) {
    console.error('[Cron] Error en verificación de pagos vencidos:', error);
    throw error;
  }
};

/**
 * Envía recordatorios de pago a clientes con pagos próximos a vencer
 * @param {Number} diasAnticipacion - Días de anticipación para enviar el recordatorio
 * @returns {Promise<Object>} Resultado del envío con conteo de notificaciones
 */
const enviarRecordatoriosPago = async (diasAnticipacion = 3) => {
  try {
    console.log('[Cron] Iniciando envío de recordatorios de pago...');
    const hoy = new Date();
    
    // Calcular la fecha límite para enviar recordatorios (hoy + días de anticipación)
    const fechaLimite = new Date();
    fechaLimite.setDate(hoy.getDate() + diasAnticipacion);
    
    // Buscar clientes con próximo pago entre hoy y la fecha límite
    const clientesProximoVencimiento = await Cliente.find({
      estado: 'activo',
      estadoPagoActual: { $ne: 'pagado' }, // No recordar a los que ya pagaron
      fechaProximoPago: { 
        $gte: hoy,
        $lte: fechaLimite
      }
    });
    
    console.log(`[Cron] Encontrados ${clientesProximoVencimiento.length} clientes con pagos próximos a vencer`);
    const notificacionesEnviadas = [];
    
    // Enviar notificaciones usando el servicio de notificaciones
    for (const cliente of clientesProximoVencimiento) {
      try {
        console.log(`[Cron] Enviando recordatorio a cliente ${cliente._id} (${cliente.nombre})`);
        await notificacionService.enviarRecordatorioPago(cliente._id);
        notificacionesEnviadas.push(cliente._id);
      } catch (error) {
        console.error(`[Cron] Error al enviar recordatorio a cliente ${cliente._id}:`, error);
      }
    }
    
    console.log('[Cron] Envío de recordatorios de pago completado');
    return {
      total: notificacionesEnviadas.length,
      notificacionesEnviadas
    };
  } catch (error) {
    console.error('[Cron] Error en envío de recordatorios:', error);
    throw error;
  }
};

/**
 * Verifica el estado completo de pagos para todos los clientes
 * Integra la lógica del servicio de pagos con la verificación directa en MercadoPago
 * @returns {Promise<Object>} Resultado con clientes en diferentes estados
 */
const verificarEstadoPagosCompleto = async () => {
  try {
    console.log('[Cron] Ejecutando verificación completa de estado de pagos...');
    
    // Obtener clasificación de clientes desde la lógica de pagos
    const { clientesProximoPago, clientesEnGracia, clientesVencidos } = await pagosLogic.verificarEstadoPagos();
    
    console.log(`[Cron] Clientes con pago próximo: ${clientesProximoPago.length}`);
    console.log(`[Cron] Clientes en periodo de gracia: ${clientesEnGracia.length}`);
    console.log(`[Cron] Clientes con pagos vencidos: ${clientesVencidos.length}`);
    
    // Procesar clientes con pagos próximos
    for (const cliente of clientesProximoPago) {
      try {
        await notificacionService.enviarRecordatorioPago(cliente._id);
        console.log(`[Cron] Recordatorio enviado a cliente: ${cliente._id}`);
      } catch (error) {
        console.error(`[Cron] Error al enviar recordatorio a cliente ${cliente._id}:`, error);
      }
    }
    
    // Procesar clientes en periodo de gracia
    for (const cliente of clientesEnGracia) {
      if (!cliente.avisoSuspensionEnviado) {
        try {
          await notificacionService.enviarAvisoSuspension(cliente._id);
          console.log(`[Cron] Aviso de suspensión enviado a cliente: ${cliente._id}`);
          
          // Marcar que se envió el aviso de suspensión
          await Cliente.findByIdAndUpdate(cliente._id, { avisoSuspensionEnviado: true });
        } catch (error) {
          console.error(`[Cron] Error al enviar aviso de suspensión a cliente ${cliente._id}:`, error);
        }
      }
    }
    
    // Procesar clientes vencidos
    for (const cliente of clientesVencidos) {
      try {
        // Verificar en MercadoPago si tiene suscripción
        if (cliente.suscripcionId) {
          try {
            // Suspender suscripción en MercadoPago
            await new PreApproval(mercadopago).update({
              id: cliente.suscripcionId,
              status: "paused",
            });
          } catch (mpError) {
            console.error(`[Cron] Error al suspender suscripción en MercadoPago para cliente ${cliente._id}:`, mpError.message);
          }
        }
        
        // Desactivar token de acceso
        await tokenService.desactivarToken(cliente._id);
        
        // Enviar notificación solo si no ha sido enviada ya
        if (cliente.estado !== 'suspendido') {
          await notificacionService.enviarNotificacionSuspension(cliente._id);
          console.log(`[Cron] Notificación de suspensión enviada a cliente: ${cliente._id}`);
          
          // Actualizar estado del cliente
          await Cliente.findByIdAndUpdate(cliente._id, { 
            estado: 'suspendido',
            estadoPagoActual: 'vencido'
          });
        }
      } catch (error) {
        console.error(`[Cron] Error al procesar cliente suspendido ${cliente._id}:`, error);
      }
    }
    
    console.log('[Cron] Verificación completa de estado de pagos finalizada');
    return {
      clientesProximoPago,
      clientesEnGracia,
      clientesVencidos
    };
  } catch (error) {
    console.error('[Cron] Error en verificación completa de estado de pagos:', error);
    throw error;
  }
};

/**
 * Limpia y regenera tokens antiguos para clientes activos
 * @returns {Promise<Array>} Lista de clientes con tokens actualizados
 */
const limpiarTokensAntiguos = async () => {
  try {
    console.log('[Cron] Ejecutando limpieza de tokens antiguos...');
    
    // Buscar clientes activos sin token o con token generado hace más de 90 días
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - 90);
    
    const clientes = await Cliente.find({
      estado: 'activo',
      $or: [
        { tokenAcceso: { $exists: false } },
        { tokenAcceso: null },
        { tokenAcceso: '' },
        { $where: function() {
          // Este enfoque solo funciona si el token incluye un timestamp o similar
          // En una implementación real, podríamos agregar un campo tokenGeneradoEn
          return this.tokenAcceso && this.tokenAcceso.length > 0 && this.fechaUltimoPago < fechaLimite;
        }}
      ]
    });
    
    console.log(`[Cron] Encontrados ${clientes.length} clientes que necesitan actualización de token`);
    const clientesActualizados = [];
    
    // Generar nuevos tokens para estos clientes
    for (const cliente of clientes) {
      try {
        const nuevoToken = await tokenService.generarToken(cliente._id);
        console.log(`[Cron] Token regenerado para cliente: ${cliente._id}`);
        clientesActualizados.push({
          id: cliente._id,
          nombre: cliente.nombre,
          nuevoToken
        });
      } catch (error) {
        console.error(`[Cron] Error al regenerar token para cliente ${cliente._id}:`, error);
      }
    }
    
    console.log('[Cron] Limpieza de tokens completada');
    return clientesActualizados;
  } catch (error) {
    console.error('[Cron] Error en la limpieza de tokens:', error);
    throw error;
  }
};

/**
 * Inicializa todas las tareas programadas del sistema
 */
const iniciarCronJobs = () => {
  // Inicializar conexión a MongoDB
  inicializarConexion();
  
  // Verificar pagos vencidos todos los días a las 00:05 AM
  cron.schedule('5 0 * * *', verificarPagosVencidos);
  
  // Verificación completa de estado de pagos diariamente a las 8:00 AM
  cron.schedule('0 8 * * *', verificarEstadoPagosCompleto);
  
  // Enviar recordatorios de pago todos los días a las 10:00 AM
  cron.schedule('0 10 * * *', enviarRecordatoriosPago);
  
  // Limpiar tokens antiguos los domingos a la 1:00 AM
  cron.schedule('0 1 * * 0', limpiarTokensAntiguos);
  
  console.log('[Cron] Todas las tareas programadas han sido iniciadas');
};

/**
 * Ejecuta todas las verificaciones y tareas de mantenimiento en un solo paso
 * Útil para ejecutar manualmente y hacer pruebas
 */
const ejecutarTodasLasTareas = async () => {
  try {
    console.log('[Cron] Iniciando ejecución manual de todas las tareas...');
    
    // Ejecutar todas las tareas secuencialmente
    await verificarPagosVencidos();
    await enviarRecordatoriosPago();
    await verificarEstadoPagosCompleto();
    await limpiarTokensAntiguos();
    
    console.log('[Cron] Ejecución manual de todas las tareas completada');
    return { status: 'success' };
  } catch (error) {
    console.error('[Cron] Error en ejecución manual de tareas:', error);
    return { 
      status: 'error',
      error: error.message
    };
  }
};

module.exports = {
  iniciarCronJobs,
  verificarPagosVencidos,
  enviarRecordatoriosPago,
  verificarEstadoPagosCompleto,
  limpiarTokensAntiguos,
  ejecutarTodasLasTareas
};