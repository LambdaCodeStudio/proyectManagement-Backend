/**
 * clienteController.js
 * Controlador para la gestión de clientes
 * Integra operaciones directas y lógica de negocio
 */
const Cliente = require('../models/clienteSchema');
const { PreApproval } = require('mercadopago');
const mercadopago = require('../config/mercadopago');
const clienteLogic = require('../logic/clienteLogic');

/**
 * Obtener todos los clientes
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
const getClientes = async (req, res) => {
  try {
    const clientes = await Cliente.find();
    res.status(200).json(clientes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Obtener todos los clientes (alias para compatibilidad)
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
const getAllClientes = async (req, res) => {
  try {
    // Si hay lógica de negocio disponible
    if (clienteLogic && typeof clienteLogic.getAllClientes === 'function') {
      const clientes = await clienteLogic.getAllClientes();
      return res.status(200).json(clientes);
    } else {
      // Usar el método base
      return getClientes(req, res);
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Obtener un cliente por ID
 * @param {Object} req - Objeto de solicitud con id
 * @param {Object} res - Objeto de respuesta
 */
const getClienteById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Si hay lógica de negocio disponible
    if (clienteLogic && typeof clienteLogic.getClienteById === 'function') {
      const cliente = await clienteLogic.getClienteById(id);
      
      if (!cliente) {
        return res.status(404).json({ message: 'Cliente no encontrado' });
      }
      
      return res.status(200).json(cliente);
    } else {
      // Método directo
      const cliente = await Cliente.findById(id);
      
      if (!cliente) {
        return res.status(404).json({ message: 'Cliente no encontrado' });
      }
      
      return res.status(200).json(cliente);
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Crear un nuevo cliente con planes personalizados
 * @param {Object} req - Objeto de solicitud con datos del cliente
 * @param {Object} res - Objeto de respuesta
 */
const createCliente = async (req, res) => {
  try {
    const { nombre, email, telefono, programaAdquirido, planesDisponibles, plan } = req.body;
    
    // Validar planes personalizados si se proporcionan
    if (planesDisponibles) {
      if (!Array.isArray(planesDisponibles) || planesDisponibles.length === 0) {
        return res.status(400).json({ mensaje: 'Debe proporcionar al menos un plan disponible' });
      }

      // Validar cada plan
      for (const plan of planesDisponibles) {
        if (!plan.tipo || !plan.precio || plan.precio <= 0) {
          return res.status(400).json({ mensaje: 'Todos los planes deben tener tipo y precio válido' });
        }
      }
    }

    // Crear el objeto cliente con todos los datos proporcionados
    const nuevoCliente = new Cliente({
      nombre,
      email,
      telefono,
      programaAdquirido,
      ...(planesDisponibles && { planesDisponibles }),
      ...(plan && { plan }) // Plan de tipo periodo (mensual, trimestral, etc.)
    });

    const clienteGuardado = await nuevoCliente.save();
    res.status(201).json(clienteGuardado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Actualizar un cliente
 * @param {Object} req - Objeto de solicitud con id y datos
 * @param {Object} res - Objeto de respuesta
 */
const updateCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const clienteActualizado = await Cliente.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!clienteActualizado) {
      return res.status(404).json({ mensaje: 'Cliente no encontrado' });
    }
    
    res.status(200).json(clienteActualizado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Actualizar un cliente (alias para compatibilidad)
 * @param {Object} req - Objeto de solicitud con id y datos
 * @param {Object} res - Objeto de respuesta
 */
const updateClienteById = async (req, res) => {
  try {
    // Si hay lógica de negocio disponible
    if (clienteLogic && typeof clienteLogic.updateClienteById === 'function') {
      const { id } = req.params;
      const clienteData = req.body;
      
      const updatedCliente = await clienteLogic.updateClienteById(id, clienteData);
      
      if (!updatedCliente) {
        return res.status(404).json({ message: 'Cliente no encontrado' });
      }
      
      return res.status(200).json(updatedCliente);
    } else {
      // Usar el método base
      return updateCliente(req, res);
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Eliminar un cliente
 * @param {Object} req - Objeto de solicitud con id
 * @param {Object} res - Objeto de respuesta
 */
const deleteCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const cliente = await Cliente.findByIdAndDelete(id);
    
    if (!cliente) {
      return res.status(404).json({ mensaje: 'Cliente no encontrado' });
    }
    
    res.status(200).json({ mensaje: 'Cliente eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Eliminar un cliente (alias para compatibilidad)
 * @param {Object} req - Objeto de solicitud con id
 * @param {Object} res - Objeto de respuesta
 */
const deleteClienteById = async (req, res) => {
  try {
    // Si hay lógica de negocio disponible
    if (clienteLogic && typeof clienteLogic.deleteClienteById === 'function') {
      const { id } = req.params;
      
      const deletedCliente = await clienteLogic.deleteClienteById(id);
      
      if (!deletedCliente) {
        return res.status(404).json({ message: 'Cliente no encontrado' });
      }
      
      return res.status(200).json({ message: 'Cliente eliminado correctamente' });
    } else {
      // Usar el método base
      return deleteCliente(req, res);
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Actualizar planes disponibles para un cliente
 * @param {Object} req - Objeto de solicitud con id y planes
 * @param {Object} res - Objeto de respuesta
 */
const actualizarPlanesCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const { planesDisponibles } = req.body;
    
    if (!planesDisponibles || !Array.isArray(planesDisponibles) || planesDisponibles.length === 0) {
      return res.status(400).json({ mensaje: 'Debe proporcionar al menos un plan válido' });
    }

    // Validar cada plan
    for (const plan of planesDisponibles) {
      if (!plan.tipo || !plan.precio || plan.precio <= 0) {
        return res.status(400).json({ mensaje: 'Todos los planes deben tener tipo y precio válido' });
      }
    }

    const cliente = await Cliente.findByIdAndUpdate(
      id,
      { planesDisponibles },
      { new: true, runValidators: true }
    );

    if (!cliente) {
      return res.status(404).json({ mensaje: 'Cliente no encontrado' });
    }

    res.status(200).json(cliente);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Obtener el estado de un cliente por su ID
 * @param {Object} req - Objeto de solicitud con id
 * @param {Object} res - Objeto de respuesta
 */
const getEstadoClienteById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Si hay lógica de negocio disponible
    if (clienteLogic && typeof clienteLogic.getEstadoClienteById === 'function') {
      const estado = await clienteLogic.getEstadoClienteById(id);
      
      if (estado === null || estado === undefined) {
        return res.status(404).json({ message: 'Cliente no encontrado' });
      }
      
      return res.status(200).json({ estado });
    } else {
      // Método directo
      const cliente = await Cliente.findById(id);
      
      if (!cliente) {
        return res.status(404).json({ message: 'Cliente no encontrado' });
      }
      
      // Calcular si está en periodo de gracia
      const enGracia = cliente.enPeriodoGracia();
      
      return res.status(200).json({ 
        estado: cliente.estado,
        estadoPagoActual: cliente.estadoPagoActual,
        enPeriodoGracia: enGracia
      });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  // Funciones básicas
  getClientes,
  getAllClientes,
  getClienteById,
  createCliente,
  updateCliente,
  updateClienteById,
  deleteCliente,
  deleteClienteById,
  
  // Funciones especializadas
  actualizarPlanesCliente,
  getEstadoClienteById
};