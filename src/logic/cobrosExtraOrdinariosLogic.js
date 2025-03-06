const CobroExtraordinario = require('../models/extraOrdinariosSchema');

// Obtener todos los cobros extraordinarios
const getAllCobrosExtraordinarios = async () => {
  try {
    return await CobroExtraordinario.find();
  } catch (error) {
    throw new Error(`Error al obtener todos los cobros extraordinarios: ${error.message}`);
  }
};

// Obtener un cobro extraordinario por su ID
const getCobroExtraordinarioById = async (id) => {
  try {
    return await CobroExtraordinario.findById(id);
  } catch (error) {
    throw new Error(`Error al obtener el cobro extraordinario por ID: ${error.message}`);
  }
};

// Obtener todos los cobros extraordinarios de un cliente específico
const getCobrosExtraordinariosByClienteId = async (idCliente) => {
  try {
    return await CobroExtraordinario.find({ idCliente });
  } catch (error) {
    throw new Error(`Error al obtener cobros extraordinarios del cliente: ${error.message}`);
  }
};

// Actualizar un cobro extraordinario por su ID
const updateCobroExtraordinarioById = async (id, cobroData) => {
  try {
    return await CobroExtraordinario.findByIdAndUpdate(
      id,
      cobroData,
      { new: true, runValidators: true }
    );
  } catch (error) {
    throw new Error(`Error al actualizar el cobro extraordinario: ${error.message}`);
  }
};

// Eliminar un cobro extraordinario por su ID
const deleteCobroExtraordinarioById = async (id) => {
  try {
    return await CobroExtraordinario.findByIdAndDelete(id);
  } catch (error) {
    throw new Error(`Error al eliminar el cobro extraordinario: ${error.message}`);
  }
};

module.exports = {
  getAllCobrosExtraordinarios,
  getCobroExtraordinarioById,
  getCobrosExtraordinariosByClienteId,
  updateCobroExtraordinarioById,
  deleteCobroExtraordinarioById
};