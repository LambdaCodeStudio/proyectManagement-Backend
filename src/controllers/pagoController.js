/**
 * pagoController.js
 * Controlador para la gestión de pagos
 * Integra operaciones directas y lógica de negocio
 */
const Pago = require('../models/pagoSchema');
const Cliente = require('../models/clienteSchema');
const pagosLogic = require('../logic/pagosLogic');

/**
 * Obtener todos los pagos
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
const getPagos = async (req, res) => {
  try {
    const pagos = await Pago.find().populate('cliente', 'nombre email');
    res.status(200).json(pagos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Obtener pagos por ID de cliente
 * @param {Object} req - Objeto de solicitud con clienteId en params
 * @param {Object} res - Objeto de respuesta
 */
const getPagosByCliente = async (req, res) => {
  try {
    const pagos = await Pago.find({ cliente: req.params.clienteId })
      .populate('cliente', 'nombre email')
      .sort({ fechaPago: -1 });
    
    res.status(200).json(pagos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Obtener historial de pagos de un cliente (versión extendida)
 * @param {Object} req - Objeto de solicitud con idCliente en params
 * @param {Object} res - Objeto de respuesta
 */
const obtenerHistorialPagos = async (req, res) => {
  try {
    const { idCliente } = req.params;
    // Usar la lógica de negocio para obtener un historial más detallado
    const historial = await pagosLogic.obtenerHistorialPagos(idCliente);
    return res.status(200).json(historial);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Registrar un nuevo pago manualmente
 * @param {Object} req - Objeto de solicitud con datos del pago
 * @param {Object} res - Objeto de respuesta
 */
const registrarPago = async (req, res) => {
  try {
    // Verificar si se debe usar la lógica avanzada o el proceso simple
    if (req.body.periodoFacturado || req.body.idCliente) {
      // Añadir usuario que registra el pago si existe autenticación
      if (req.user) {
        req.body.registradoPor = req.user.id;
      }
      
      // Usar lógica avanzada que maneja periodos y más detalles
      const pago = await pagosLogic.registrarPago(req.body);
      return res.status(201).json(pago);
    } else {
      // Proceso original/simple para compatibilidad
      const { clienteId, monto, metodo, descripcion, idTransaccion } = req.body;
      
      const cliente = await Cliente.findById(clienteId);
      if (!cliente) {
        return res.status(404).json({ mensaje: 'Cliente no encontrado' });
      }

      const nuevoPago = new Pago({
        cliente: clienteId,
        monto,
        metodo,
        descripcion,
        idTransaccion,
        estado: 'aprobado'
      });

      const pagoGuardado = await nuevoPago.save();

      // Actualizar estado del cliente
      cliente.estadoPagoActual = 'pagado';
      cliente.fechaUltimoPago = new Date();
      cliente.fechaProximoPago = new Date(new Date().setMonth(new Date().getMonth() + 1));
      await cliente.save();

      res.status(201).json(pagoGuardado);
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Actualizar estado de un pago
 * @param {Object} req - Objeto de solicitud con id y estado
 * @param {Object} res - Objeto de respuesta
 */
const actualizarEstadoPago = async (req, res) => {
  try {
    const { estado } = req.body;
    
    if (!['pendiente', 'aprobado', 'rechazado', 'reembolsado'].includes(estado)) {
      return res.status(400).json({ mensaje: 'Estado no válido' });
    }

    const pago = await Pago.findByIdAndUpdate(
      req.params.id,
      { estado },
      { new: true }
    );

    if (!pago) {
      return res.status(404).json({ mensaje: 'Pago no encontrado' });
    }

    // Si el pago cambia a aprobado, actualizar el estado del cliente
    if (estado === 'aprobado') {
      const cliente = await Cliente.findById(pago.cliente);
      if (cliente) {
        cliente.estadoPagoActual = 'pagado';
        cliente.fechaUltimoPago = pago.fechaPago;
        cliente.fechaProximoPago = new Date(new Date(pago.fechaPago).setMonth(new Date(pago.fechaPago).getMonth() + 1));
        await cliente.save();
      }
    }

    res.status(200).json(pago);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Obtener historial de pagos con filtros
 * @param {Object} req - Objeto de solicitud con filtros en query
 * @param {Object} res - Objeto de respuesta
 */
const getHistorialPagos = async (req, res) => {
  try {
    const { clienteId, desde, hasta, estado } = req.query;
    
    const filtro = {};
    
    if (clienteId) filtro.cliente = clienteId;
    if (estado) filtro.estado = estado;
    
    if (desde || hasta) {
      filtro.fechaPago = {};
      if (desde) filtro.fechaPago.$gte = new Date(desde);
      if (hasta) filtro.fechaPago.$lte = new Date(hasta);
    }
    
    const pagos = await Pago.find(filtro)
      .populate('cliente', 'nombre email programaAdquirido')
      .sort({ fechaPago: -1 });
    
    res.status(200).json(pagos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Verificar estado de pagos (para uso administrativo)
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
const verificarEstadoPagos = async (req, res) => {
  try {
    const resultado = await pagosLogic.verificarEstadoPagos();
    return res.status(200).json(resultado);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Generar reporte de pagos por periodo
 * @param {Object} req - Objeto de solicitud con fechaInicio y fechaFin
 * @param {Object} res - Objeto de respuesta
 */
const generarReportePagos = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ 
        message: 'Se requieren los parámetros fechaInicio y fechaFin'
      });
    }
    
    const reporte = await pagosLogic.generarReportePagos(fechaInicio, fechaFin);
    return res.status(200).json(reporte);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Marcar pago como facturado
 * @param {Object} req - Objeto de solicitud con id y datos de factura
 * @param {Object} res - Objeto de respuesta
 */
const marcarFacturado = async (req, res) => {
  try {
    const { id } = req.params;
    const datosFactura = req.body;
    
    const pago = await pagosLogic.marcarFacturado(id, datosFactura);
    
    if (!pago) {
      return res.status(404).json({ message: 'Pago no encontrado' });
    }
    
    return res.status(200).json(pago);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  // Funciones básicas para obtener datos
  getPagos,
  getPagosByCliente,
  getHistorialPagos,
  
  // Funciones CRUD principales
  registrarPago,
  actualizarEstadoPago,
  
  // Funciones extendidas con lógica de negocio
  obtenerHistorialPagos,
  verificarEstadoPagos,
  generarReportePagos,
  marcarFacturado
};