const cobrosExtraordinariosLogic = require('../logic/cobrosExtraOrdinariosLogic');

// Obtener todos los cobros extraordinarios
const getAllCobrosExtraordinarios = async (req, res) => {
  try {
    const cobros = await cobrosExtraordinariosLogic.getAllCobrosExtraordinarios();
    return res.status(200).json(cobros);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Obtener un cobro extraordinario por su ID
const getCobroExtraordinarioById = async (req, res) => {
  try {
    const { id } = req.params;
    const cobro = await cobrosExtraordinariosLogic.getCobroExtraordinarioById(id);
    
    if (!cobro) {
      return res.status(404).json({ message: 'Cobro extraordinario no encontrado' });
    }
    
    return res.status(200).json(cobro);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Obtener todos los cobros extraordinarios de un cliente específico
const getCobrosExtraordinariosByClienteId = async (req, res) => {
  try {
    const { idCliente } = req.params;
    const cobros = await cobrosExtraordinariosLogic.getCobrosExtraordinariosByClienteId(idCliente);
    
    return res.status(200).json(cobros);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Actualizar un cobro extraordinario por su ID
const updateCobroExtraordinarioById = async (req, res) => {
  try {
    const { id } = req.params;
    const cobroData = req.body;
    
    const updatedCobro = await cobrosExtraordinariosLogic.updateCobroExtraordinarioById(id, cobroData);
    
    if (!updatedCobro) {
      return res.status(404).json({ message: 'Cobro extraordinario no encontrado' });
    }
    
    return res.status(200).json(updatedCobro);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Eliminar un cobro extraordinario por su ID
const deleteCobroExtraordinarioById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedCobro = await cobrosExtraordinariosLogic.deleteCobroExtraordinarioById(id);
    
    if (!deletedCobro) {
      return res.status(404).json({ message: 'Cobro extraordinario no encontrado' });
    }
    
    return res.status(200).json({ message: 'Cobro extraordinario eliminado correctamente' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllCobrosExtraordinarios,
  getCobroExtraordinarioById,
  getCobrosExtraordinariosByClienteId,
  updateCobroExtraordinarioById,
  deleteCobroExtraordinarioById
};