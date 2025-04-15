const Suscripcion = require('../models/suscripcion');
const Usuario = require('../models/usuario'); // Suponiendo que tienes un modelo Usuario
const mercadopago = require('mercadopago');
const { logError } = require('../utils/logger'); // Suponiendo que tienes un logger

// Configurar Mercado Pago con las credenciales de tu .env
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN
});

/**
 * Crear una nueva suscripción sin plan asociado (con pago pendiente)
 */
exports.crearSuscripcion = async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const { email } = req.body;

    if (!usuarioId || !email) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere el ID del usuario y el email'
      });
    }

    // Verificar que el usuario existe
    const usuario = await Usuario.findById(usuarioId);
    if (!usuario) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }

    // Crear suscripción en MercadoPago
    const preapprovalData = {
      back_url: process.env.APP_URL,
      reason: "Suscripción mensual",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: 100, // Ajusta el monto según tus necesidades
        currency_id: "ARS"
      },
      payer_email: email,
      status: "pending"
    };

    const response = await mercadopago.preapproval.create(preapprovalData);

    // Guardar la suscripción en nuestra base de datos
    const suscripcion = new Suscripcion({
      usuario: usuarioId,
      mercadopagoId: response.body.id,
      estado: 'pending',
      monto: preapprovalData.auto_recurring.transaction_amount,
      moneda: preapprovalData.auto_recurring.currency_id,
      frecuencia: preapprovalData.auto_recurring.frequency,
      tipoFrecuencia: preapprovalData.auto_recurring.frequency_type
    });

    await suscripcion.save();

    return res.status(201).json({
      status: 'success',
      data: {
        id: suscripcion._id,
        init_point: response.body.init_point
      }
    });
  } catch (error) {
    logError('Error al crear suscripción:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error al crear la suscripción',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

/**
 * Obtener los detalles de una suscripción
 */
exports.obtenerSuscripcion = async (req, res) => {
  try {
    const { id } = req.params;

    const suscripcion = await Suscripcion.findById(id);
    
    if (!suscripcion) {
      return res.status(404).json({
        status: 'error',
        message: 'Suscripción no encontrada'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: suscripcion
    });
  } catch (error) {
    logError('Error al obtener suscripción:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error al obtener la suscripción',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

/**
 * Obtener todas las suscripciones de un usuario
 */
exports.obtenerSuscripcionesUsuario = async (req, res) => {
  try {
    const { usuarioId } = req.params;

    const suscripciones = await Suscripcion.find({ usuario: usuarioId });

    return res.status(200).json({
      status: 'success',
      data: suscripciones
    });
  } catch (error) {
    logError('Error al obtener suscripciones del usuario:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error al obtener las suscripciones del usuario',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

/**
 * Cancelar una suscripción
 */
exports.cancelarSuscripcion = async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar la suscripción en nuestra base de datos
    const suscripcion = await Suscripcion.findById(id);
    
    if (!suscripcion) {
      return res.status(404).json({
        status: 'error',
        message: 'Suscripción no encontrada'
      });
    }

    // Cancelar la suscripción en Mercado Pago
    await mercadopago.preapproval.update({
      id: suscripcion.mercadopagoId,
      status: "cancelled"
    });

    // Actualizar el estado en nuestra base de datos
    suscripcion.estado = 'cancelled';
    suscripcion.activa = false;
    suscripcion.ultimaActualizacion = Date.now();
    await suscripcion.save();

    return res.status(200).json({
      status: 'success',
      message: 'Suscripción cancelada correctamente'
    });
  } catch (error) {
    logError('Error al cancelar suscripción:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error al cancelar la suscripción',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

/**
 * Verificar si un usuario tiene una suscripción activa
 */
exports.verificarSuscripcion = async (req, res) => {
  try {
    const { usuarioId } = req.params;

    const suscripcion = await Suscripcion.findOne({ 
      usuario: usuarioId,
      activa: true,
      estado: 'authorized'
    });

    return res.status(200).json({
      status: 'success',
      data: {
        tieneSuscripcion: !!suscripcion,
        suscripcion: suscripcion || null
      }
    });
  } catch (error) {
    logError('Error al verificar suscripción:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error al verificar la suscripción',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

/**
 * Actualiza una suscripción con información de Mercado Pago
 * Esta función se utiliza internamente desde el webhook
 */
exports.actualizarSuscripcion = async (mercadopagoId, estado) => {
  try {
    const suscripcion = await Suscripcion.findOne({ mercadopagoId });
    
    if (!suscripcion) {
      logError(`Suscripción con ID de MercadoPago ${mercadopagoId} no encontrada`);
      return false;
    }

    suscripcion.estado = estado;
    suscripcion.activa = estado === 'authorized';
    
    if (estado === 'authorized' && !suscripcion.fechaInicio) {
      suscripcion.fechaInicio = Date.now();
    }
    
    suscripcion.ultimaActualizacion = Date.now();
    await suscripcion.save();

    return true;
  } catch (error) {
    logError('Error al actualizar suscripción:', error);
    return false;
  }
};