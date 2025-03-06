const clienteLogic = require('../logic/clienteLogic');

// Obtener todos los clientes
const getAllClientes = async (req, res) => {
  try {
    const clientes = await clienteLogic.getAllClientes();
    return res.status(200).json(clientes);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Obtener un cliente por su ID
const getClienteById = async (req, res) => {
  try {
    const { id } = req.params;
    const cliente = await clienteLogic.getClienteById(id);
    
    if (!cliente) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    
    return res.status(200).json(cliente);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Actualizar un cliente por su ID
const updateClienteById = async (req, res) => {
  try {
    const { id } = req.params;
    const clienteData = req.body;
    
    const updatedCliente = await clienteLogic.updateClienteById(id, clienteData);
    
    if (!updatedCliente) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    
    return res.status(200).json(updatedCliente);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Eliminar un cliente por su ID
const deleteClienteById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedCliente = await clienteLogic.deleteClienteById(id);
    
    if (!deletedCliente) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    
    return res.status(200).json({ message: 'Cliente eliminado correctamente' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Obtener el estado de un cliente por su ID
const getEstadoClienteById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const estado = await clienteLogic.getEstadoClienteById(id);
    
    if (estado === null || estado === undefined) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    
    return res.status(200).json({ estado });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllClientes,
  getClienteById,
  updateClienteById,
  deleteClienteById,
  getEstadoClienteById
};