require('dotenv').config();
const cron = require('node-cron');
const mongoose = require('mongoose');
const Cliente = require('../models/clienteSchema');
const pagosLogic = require('../logic/pagosLogic');
const notificacionService = require('../services/notificacionService');
const tokenService = require('../services/tokenService');

// Configurar conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB conectado para tareas programadas'))
  .catch(err => {
    console.error('Error al conectar a MongoDB:', err);
    process.exit(1);
  });

// Inicializar servicio de notificaciones
notificacionService.inicializar();

// Tarea para verificar pagos - se ejecuta todos los días a las 8:00 AM
cron.schedule('0 8 * * *', async () => {
  console.log('Ejecutando verificación diaria de pagos...');
  
  try {
    // Verificar pagos vencidos y clientes en periodo de gracia
    const { clientesProximoPago, clientesEnGracia, clientesVencidos } = await pagosLogic.verificarEstadoPagos();
    
    console.log(`Clientes con pago próximo: ${clientesProximoPago.length}`);
    console.log(`Clientes en periodo de gracia: ${clientesEnGracia.length}`);
    console.log(`Clientes con pagos vencidos: ${clientesVencidos.length}`);
    
    // Enviar recordatorios de pago
    for (const cliente of clientesProximoPago) {
      try {
        await notificacionService.enviarRecordatorioPago(cliente._id);
        console.log(`Recordatorio enviado a cliente: ${cliente._id}`);
      } catch (error) {
        console.error(`Error al enviar recordatorio a cliente ${cliente._id}:`, error);
      }
    }
    
    // Enviar avisos de suspensión a clientes en periodo de gracia
    for (const cliente of clientesEnGracia) {
      if (!cliente.avisoSuspensionEnviado) {
        try {
          await notificacionService.enviarAvisoSuspension(cliente._id);
          console.log(`Aviso de suspensión enviado a cliente: ${cliente._id}`);
        } catch (error) {
          console.error(`Error al enviar aviso de suspensión a cliente ${cliente._id}:`, error);
        }
      }
    }
    
    // Notificar a clientes suspendidos
    for (const cliente of clientesVencidos) {
      try {
        // Desactivar token de acceso
        await tokenService.desactivarToken(cliente._id);
        
        // Enviar notificación solo si no ha sido enviada ya
        // (podríamos añadir un campo para esto, pero por ahora usamos una lógica simple)
        if (cliente.estado !== 'suspendido') {
          await notificacionService.enviarNotificacionSuspension(cliente._id);
          console.log(`Notificación de suspensión enviada a cliente: ${cliente._id}`);
          
          // Actualizar estado del cliente
          await Cliente.findByIdAndUpdate(cliente._id, { estado: 'suspendido' });
        }
      } catch (error) {
        console.error(`Error al procesar cliente suspendido ${cliente._id}:`, error);
      }
    }
    
    console.log('Verificación de pagos completada');
  } catch (error) {
    console.error('Error en la verificación de pagos:', error);
  }
});

// Tarea para limpiar tokens antiguos - se ejecuta los domingos a la 1:00 AM
cron.schedule('0 1 * * 0', async () => {
  console.log('Ejecutando limpieza de tokens antiguos...');
  
  try {
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
    
    console.log(`Encontrados ${clientes.length} clientes que necesitan actualización de token`);
    
    // Generar nuevos tokens para estos clientes
    for (const cliente of clientes) {
      try {
        await tokenService.generarToken(cliente._id);
        console.log(`Token regenerado para cliente: ${cliente._id}`);
      } catch (error) {
        console.error(`Error al regenerar token para cliente ${cliente._id}:`, error);
      }
    }
    
    console.log('Limpieza de tokens completada');
  } catch (error) {
    console.error('Error en la limpieza de tokens:', error);
  }
});

// Mantener el proceso vivo
console.log('Tareas programadas iniciadas');
process.on('SIGINT', () => {
  mongoose.connection.close(() => {
    console.log('Conexión a MongoDB cerrada');
    process.exit(0);
  });
});