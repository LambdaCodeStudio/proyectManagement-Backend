/**
 * facturaController.js
 * Controlador para la gestión de facturas
 * Integra operaciones directas y lógica de negocio 
 */
const Factura = require('../models/facturaSchema');
const Pago = require('../models/pagoSchema');
const Cliente = require('../models/clienteSchema');
const facturaLogic = require('../logic/facturaLogic');

/**
 * Obtener todas las facturas con filtros básicos
 * @param {Object} req - Objeto de solicitud con filtros opcionales
 * @param {Object} res - Objeto de respuesta
 */
const getFacturas = async (req, res) => {
  try {
    const { desde, hasta, estado } = req.query;
    
    const filtro = {};
    
    if (estado) filtro.estado = estado;
    
    if (desde || hasta) {
      filtro.fechaEmision = {};
      if (desde) filtro.fechaEmision.$gte = new Date(desde);
      if (hasta) filtro.fechaEmision.$lte = new Date(hasta);
    }
    
    const facturas = await Factura.find(filtro)
      .populate('cliente', 'nombre email')
      .populate('pago', 'fechaPago monto metodo')
      .sort({ fechaEmision: -1 });
    
    res.status(200).json(facturas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Obtener todas las facturas (alias para compatibilidad)
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
const getAllFacturas = async (req, res) => {
  try {
    // Si hay lógica de negocio disponible
    if (facturaLogic && typeof facturaLogic.getAllFacturas === 'function') {
      const facturas = await facturaLogic.getAllFacturas();
      return res.status(200).json(facturas);
    } else {
      // Método alternativo directo
      return getFacturas(req, res);
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Generar factura a partir de un pago
 * @param {Object} req - Objeto de solicitud con pagoId
 * @param {Object} res - Objeto de respuesta
 */
const generarFactura = async (req, res) => {
  try {
    const { pagoId } = req.params;
    
    // Verificar si el pago existe y está aprobado
    const pago = await Pago.findById(pagoId);
    if (!pago) {
      return res.status(404).json({ mensaje: 'Pago no encontrado' });
    }
    
    if (pago.estado !== 'aprobado') {
      return res.status(400).json({ mensaje: 'Solo se pueden generar facturas para pagos aprobados' });
    }
    
    if (pago.facturaGenerada) {
      return res.status(400).json({ mensaje: 'Ya existe una factura para este pago' });
    }
    
    // Obtener información del cliente
    const cliente = await Cliente.findById(pago.cliente);
    if (!cliente) {
      return res.status(404).json({ mensaje: 'Cliente no encontrado' });
    }
    
    // Crear la factura
    const nuevaFactura = new Factura({
      cliente: cliente._id,
      pago: pago._id,
      montoTotal: pago.monto,
      conceptos: [{
        descripcion: `Suscripción mensual - ${cliente.programaAdquirido}`,
        monto: pago.monto
      }]
    });
    
    const facturaGuardada = await nuevaFactura.save();
    
    // Actualizar el pago para indicar que tiene factura
    pago.facturaGenerada = true;
    await pago.save();
    
    // Aquí se podría implementar la generación del PDF de la factura y asignar la URL
    
    res.status(201).json(facturaGuardada);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Obtener facturas por cliente
 * @param {Object} req - Objeto de solicitud con clienteId
 * @param {Object} res - Objeto de respuesta
 */
const getFacturasByCliente = async (req, res) => {
  try {
    const { clienteId } = req.params;
    
    const facturas = await Factura.find({ cliente: clienteId })
      .populate('cliente', 'nombre email')
      .populate('pago', 'fechaPago monto metodo')
      .sort({ fechaEmision: -1 });
    
    res.status(200).json(facturas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Obtener facturas por cliente (alias para compatibilidad)
 * @param {Object} req - Objeto de solicitud con idCliente
 * @param {Object} res - Objeto de respuesta 
 */
const getFacturasByClienteId = async (req, res) => {
  try {
    // Si hay lógica de negocio disponible
    if (facturaLogic && typeof facturaLogic.getFacturasByClienteId === 'function') {
      const { idCliente } = req.params;
      const facturas = await facturaLogic.getFacturasByClienteId(idCliente);
      return res.status(200).json(facturas);
    } else {
      // Adaptador para el método original
      req.params.clienteId = req.params.idCliente;
      return getFacturasByCliente(req, res);
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Anular una factura
 * @param {Object} req - Objeto de solicitud con id
 * @param {Object} res - Objeto de respuesta
 */
const anularFactura = async (req, res) => {
  try {
    const { id } = req.params;
    
    const factura = await Factura.findById(id);
    if (!factura) {
      return res.status(404).json({ mensaje: 'Factura no encontrada' });
    }
    
    if (factura.estado === 'anulada') {
      return res.status(400).json({ mensaje: 'La factura ya está anulada' });
    }
    
    factura.estado = 'anulada';
    await factura.save();
    
    res.status(200).json({ mensaje: 'Factura anulada correctamente', factura });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Obtener facturas por estado
 * @param {Object} req - Objeto de solicitud con parámetro estado
 * @param {Object} res - Objeto de respuesta
 */
const getFacturasByEstado = async (req, res) => {
  try {
    const { estado } = req.params;
    
    // Si hay lógica de negocio disponible
    if (facturaLogic && typeof facturaLogic.getFacturasByEstado === 'function') {
      const facturas = await facturaLogic.getFacturasByEstado(estado);
      return res.status(200).json(facturas);
    } else {
      // Método alternativo directo
      const facturas = await Factura.find({ estado })
        .populate('cliente', 'nombre email')
        .populate('pago', 'fechaPago monto metodo')
        .sort({ fechaEmision: -1 });
      
      return res.status(200).json(facturas);
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Obtener facturas de un proyecto específico
 * @param {Object} req - Objeto de solicitud con idProyecto
 * @param {Object} res - Objeto de respuesta
 */
const getFacturasByProyectoId = async (req, res) => {
  try {
    const { idProyecto } = req.params;
    
    // Si hay lógica de negocio disponible
    if (facturaLogic && typeof facturaLogic.getFacturasByProyectoId === 'function') {
      const facturas = await facturaLogic.getFacturasByProyectoId(idProyecto);
      return res.status(200).json(facturas);
    } else {
      // Método alternativo directo
      const facturas = await Factura.find({ idProyecto })
        .populate('cliente', 'nombre email')
        .populate('pago', 'fechaPago monto metodo')
        .sort({ fechaEmision: -1 });
      
      return res.status(200).json(facturas);
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Obtener una factura por su ID
 * @param {Object} req - Objeto de solicitud con id
 * @param {Object} res - Objeto de respuesta
 */
const getFacturaById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Si hay lógica de negocio disponible
    if (facturaLogic && typeof facturaLogic.getFacturaById === 'function') {
      const factura = await facturaLogic.getFacturaById(id);
      
      if (!factura) {
        return res.status(404).json({ message: 'Factura no encontrada' });
      }
      
      return res.status(200).json(factura);
    } else {
      // Método alternativo directo
      const factura = await Factura.findById(id)
        .populate('cliente', 'nombre email')
        .populate('pago', 'fechaPago monto metodo');
      
      if (!factura) {
        return res.status(404).json({ message: 'Factura no encontrada' });
      }
      
      return res.status(200).json(factura);
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Crear una nueva factura
 * @param {Object} req - Objeto de solicitud con datos de factura
 * @param {Object} res - Objeto de respuesta
 */
const createFactura = async (req, res) => {
  try {
    const facturaData = req.body;
    
    // Si hay lógica de negocio disponible
    if (facturaLogic && typeof facturaLogic.createFactura === 'function') {
      const newFactura = await facturaLogic.createFactura(facturaData);
      return res.status(201).json(newFactura);
    } else {
      // Método alternativo directo
      const nuevaFactura = new Factura(facturaData);
      const facturaGuardada = await nuevaFactura.save();
      return res.status(201).json(facturaGuardada);
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Actualizar una factura por su ID
 * @param {Object} req - Objeto de solicitud con id y datos
 * @param {Object} res - Objeto de respuesta
 */
const updateFacturaById = async (req, res) => {
  try {
    const { id } = req.params;
    const facturaData = req.body;
    
    // Si hay lógica de negocio disponible
    if (facturaLogic && typeof facturaLogic.updateFacturaById === 'function') {
      const updatedFactura = await facturaLogic.updateFacturaById(id, facturaData);
      
      if (!updatedFactura) {
        return res.status(404).json({ message: 'Factura no encontrada' });
      }
      
      return res.status(200).json(updatedFactura);
    } else {
      // Método alternativo directo
      const factura = await Factura.findByIdAndUpdate(
        id,
        facturaData,
        { new: true, runValidators: true }
      );
      
      if (!factura) {
        return res.status(404).json({ message: 'Factura no encontrada' });
      }
      
      return res.status(200).json(factura);
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Eliminar una factura por su ID
 * @param {Object} req - Objeto de solicitud con id
 * @param {Object} res - Objeto de respuesta
 */
const deleteFacturaById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Si hay lógica de negocio disponible
    if (facturaLogic && typeof facturaLogic.deleteFacturaById === 'function') {
      const deletedFactura = await facturaLogic.deleteFacturaById(id);
      
      if (!deletedFactura) {
        return res.status(404).json({ message: 'Factura no encontrada' });
      }
      
      return res.status(200).json({ message: 'Factura eliminada correctamente' });
    } else {
      // Método alternativo directo
      const factura = await Factura.findByIdAndDelete(id);
      
      if (!factura) {
        return res.status(404).json({ message: 'Factura no encontrada' });
      }
      
      return res.status(200).json({ message: 'Factura eliminada correctamente' });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Actualizar estado de una factura
 * @param {Object} req - Objeto de solicitud con id y estado
 * @param {Object} res - Objeto de respuesta
 */
const updateFacturaEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    
    // Si hay lógica de negocio disponible
    if (facturaLogic && typeof facturaLogic.updateFacturaEstado === 'function') {
      const updatedFactura = await facturaLogic.updateFacturaEstado(id, estado);
      
      if (!updatedFactura) {
        return res.status(404).json({ message: 'Factura no encontrada' });
      }
      
      return res.status(200).json(updatedFactura);
    } else {
      // Método alternativo que usa el método anularFactura para 'anulada'
      if (estado === 'anulada') {
        return anularFactura(req, res);
      }
      
      // Para otros estados
      const factura = await Factura.findByIdAndUpdate(
        id,
        { estado },
        { new: true, runValidators: true }
      );
      
      if (!factura) {
        return res.status(404).json({ message: 'Factura no encontrada' });
      }
      
      return res.status(200).json(factura);
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Obtener facturas vencidas
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
const getFacturasVencidas = async (req, res) => {
  try {
    // Si hay lógica de negocio disponible
    if (facturaLogic && typeof facturaLogic.getFacturasVencidas === 'function') {
      const facturas = await facturaLogic.getFacturasVencidas();
      return res.status(200).json(facturas);
    } else {
      // Método alternativo directo
      const hoy = new Date();
      const facturas = await Factura.find({
        estado: { $nin: ['pagada', 'anulada', 'cancelada'] },
        fechaVencimiento: { $lt: hoy }
      })
        .populate('cliente', 'nombre email')
        .populate('pago', 'fechaPago monto metodo')
        .sort({ fechaVencimiento: 1 });
      
      return res.status(200).json(facturas);
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  // Funciones básicas
  getFacturas,
  getAllFacturas,
  generarFactura,
  getFacturasByCliente,
  anularFactura,
  
  // Funciones extendidas
  getFacturasByEstado,
  getFacturasByClienteId,
  getFacturasByProyectoId,
  getFacturaById,
  createFactura,
  updateFacturaById,
  deleteFacturaById,
  updateFacturaEstado,
  getFacturasVencidas
};