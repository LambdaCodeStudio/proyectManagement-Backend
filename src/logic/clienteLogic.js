const Cliente = require('../models/clienteSchema');

// Obtener todos los clientes
const getAllClientes = async () => {
  try {
    return await Cliente.find();
  } catch (error) {
    throw new Error(`Error al obtener todos los clientes: ${error.message}`);
  }
};

// Obtener un cliente por su ID
const getClienteById = async (id) => {
  try {
    return await Cliente.findById(id);
  } catch (error) {
    throw new Error(`Error al obtener el cliente por ID: ${error.message}`);
  }
};

// Actualizar un cliente por su ID
const updateClienteById = async (id, clienteData) => {
  try {
    return await Cliente.findByIdAndUpdate(
      id,
      clienteData,
      { new: true, runValidators: true }
    );
  } catch (error) {
    throw new Error(`Error al actualizar el cliente: ${error.message}`);
  }
};

// Eliminar un cliente por su ID
const deleteClienteById = async (id) => {
  try {
    return await Cliente.findByIdAndDelete(id);
  } catch (error) {
    throw new Error(`Error al eliminar el cliente: ${error.message}`);
  }
};

// Obtener el estado de un cliente por su ID
const getEstadoClienteById = async (id) => {
  try {
    const cliente = await Cliente.findById(id);
    
    if (!cliente) {
      return null;
    }
    
    return cliente.estado;
  } catch (error) {
    throw new Error(`Error al obtener el estado del cliente: ${error.message}`);
  }
};

module.exports = {
  getAllClientes,
  getClienteById,
  updateClienteById,
  deleteClienteById,
  getEstadoClienteById
};