const Cliente = require('../models/clienteSchema');
const Pago = require('../models/pagoSchema');
const { PreApproval } = require('mercadopago');
const mercadopago = require('../config/mercadopago');

// Crear una suscripción para un cliente con plan específico
const crearSuscripcion = async (req, res) => {
  try {
    const { tipoPlan } = req.body;
    
    if (!tipoPlan) {
      return res.status(400).json({ mensaje: 'Debe especificar el tipo de plan' });
    }

    const cliente = await Cliente.findById(req.params.id);
    if (!cliente) {
      return res.status(404).json({ mensaje: 'Cliente no encontrado' });
    }

    // Verificar que el plan seleccionado exista en los planes disponibles del cliente
    const planSeleccionado = cliente.planesDisponibles.find(plan => plan.tipo === tipoPlan);
    if (!planSeleccionado) {
      return res.status(400).json({ mensaje: `El plan "${tipoPlan}" no está disponible para este cliente` });
    }

    // Crear suscripción en MercadoPago
    const suscripcion = await new PreApproval(mercadopago).create({
      body: {
        back_url: process.env.APP_URL,
        reason: `Suscripción ${tipoPlan} - ${cliente.programaAdquirido}`,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: planSeleccionado.precio,
          currency_id: "ARS",
        },
        payer_email: cliente.email,
        status: "pending",
      },
    });

    // Actualizar el cliente con la información de la suscripción y el plan seleccionado
    cliente.suscripcionId = suscripcion.id;
    cliente.estado = 'activo';
    cliente.estadoPagoActual = 'pendiente';
    cliente.fechaProximoPago = new Date(new Date().setMonth(new Date().getMonth() + 1));
    cliente.planActual = {
      tipo: planSeleccionado.tipo,
      precio: planSeleccionado.precio,
      fechaActivacion: new Date()
    };
    await cliente.save();

    res.status(200).json({
      mensaje: 'Suscripción creada correctamente',
      urlPago: suscripcion.init_point,
      suscripcionId: suscripcion.id,
      plan: cliente.planActual
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Cancelar suscripción
const cancelarSuscripcion = async (req, res) => {
  try {
    const cliente = await Cliente.findById(req.params.id);
    if (!cliente) {
      return res.status(404).json({ mensaje: 'Cliente no encontrado' });
    }

    if (!cliente.suscripcionId) {
      return res.status(400).json({ mensaje: 'El cliente no tiene una suscripción activa' });
    }

    // Cancelar suscripción en MercadoPago
    await new PreApproval(mercadopago).update({
      id: cliente.suscripcionId,
      status: "cancelled",
    });

    // Actualizar estado del cliente
    cliente.estado = 'inactivo';
    await cliente.save();

    res.status(200).json({ mensaje: 'Suscripción cancelada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar suscripción (cambio de plan o precio)
const actualizarSuscripcion = async (req, res) => {
  try {
    const { tipoPlan, nuevoPrecio } = req.body;
    
    if (!tipoPlan && !nuevoPrecio) {
      return res.status(400).json({ mensaje: 'Debe proporcionar un nuevo plan o un nuevo precio' });
    }

    const cliente = await Cliente.findById(req.params.id);
    if (!cliente) {
      return res.status(404).json({ mensaje: 'Cliente no encontrado' });
    }

    if (!cliente.suscripcionId) {
      return res.status(400).json({ mensaje: 'El cliente no tiene una suscripción activa' });
    }

    let precioActualizado;

    // Si se especifica un nuevo plan, verificar que esté disponible
    if (tipoPlan) {
      const nuevoPlan = cliente.planesDisponibles.find(plan => plan.tipo === tipoPlan);
      if (!nuevoPlan) {
        return res.status(400).json({ mensaje: `El plan "${tipoPlan}" no está disponible para este cliente` });
      }
      
      // Actualizar al nuevo plan
      cliente.planActual = {
        tipo: nuevoPlan.tipo,
        precio: nuevoPrecio || nuevoPlan.precio,
        fechaActivacion: new Date()
      };
      
      precioActualizado = cliente.planActual.precio;
    } else if (nuevoPrecio) {
      // Solo actualizar el precio del plan actual
      cliente.planActual.precio = nuevoPrecio;
      precioActualizado = nuevoPrecio;
    }

    // Actualizar suscripción en MercadoPago
    await new PreApproval(mercadopago).update({
      id: cliente.suscripcionId,
      auto_recurring: {
        transaction_amount: precioActualizado
      }
    });

    await cliente.save();

    res.status(200).json({ 
      mensaje: 'Suscripción actualizada correctamente',
      planActual: cliente.planActual 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Consultar estado de suscripción
const consultarEstadoSuscripcion = async (req, res) => {
  try {
    const cliente = await Cliente.findById(req.params.id);
    if (!cliente) {
      return res.status(404).json({ mensaje: 'Cliente no encontrado' });
    }

    if (!cliente.suscripcionId) {
      return res.status(400).json({ mensaje: 'El cliente no tiene una suscripción registrada' });
    }

    // Consultar estado en MercadoPago
    const suscripcion = await new PreApproval(mercadopago).get({ id: cliente.suscripcionId });

    res.status(200).json({
      clienteId: cliente._id,
      nombre: cliente.nombre,
      email: cliente.email,
      programa: cliente.programaAdquirido,
      estadoInterno: cliente.estado,
      estadoPagoActual: cliente.estadoPagoActual,
      fechaProximoPago: cliente.fechaProximoPago,
      fechaUltimoPago: cliente.fechaUltimoPago,
      planActual: cliente.planActual,
      suscripcion: {
        id: suscripcion.id,
        estado: suscripcion.status,
        montoRecurrente: suscripcion.auto_recurring.transaction_amount,
        frecuencia: `${suscripcion.auto_recurring.frequency} ${suscripcion.auto_recurring.frequency_type}`
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Reactivar suscripción pausada
const reactivarSuscripcion = async (req, res) => {
  try {
    const cliente = await Cliente.findById(req.params.id);
    if (!cliente) {
      return res.status(404).json({ mensaje: 'Cliente no encontrado' });
    }

    if (cliente.estado !== 'suspendido') {
      return res.status(400).json({ mensaje: 'La suscripción no está suspendida' });
    }

    // Reactivar en MercadoPago
    await new PreApproval(mercadopago).update({
      id: cliente.suscripcionId,
      status: "authorized",
    });

    // Actualizar estado del cliente
    cliente.estado = 'activo';
    await cliente.save();

    res.status(200).json({ mensaje: 'Suscripción reactivada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  crearSuscripcion,
  cancelarSuscripcion,
  actualizarSuscripcion,
  consultarEstadoSuscripcion,
  reactivarSuscripcion
};