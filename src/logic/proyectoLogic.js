const Proyecto = require('../models/proyectoSchema');
const Cliente = require('../models/clienteSchema');
const mongoose = require('mongoose');

// Obtener todos los proyectos
const getAllProyectos = async () => {
  try {
    return await Proyecto.find().populate('idCliente', 'nombre email');
  } catch (error) {
    throw new Error(`Error al obtener todos los proyectos: ${error.message}`);
  }
};

// Obtener proyectos de un cliente específico
const getProyectosByClienteId = async (idCliente) => {
  try {
    return await Proyecto.find({ idCliente });
  } catch (error) {
    throw new Error(`Error al obtener proyectos del cliente: ${error.message}`);
  }
};

// Obtener un proyecto por su ID
const getProyectoById = async (id) => {
  try {
    return await Proyecto.findById(id).populate('idCliente', 'nombre email telefono');
  } catch (error) {
    throw new Error(`Error al obtener el proyecto por ID: ${error.message}`);
  }
};

// Crear un nuevo proyecto
const createProyecto = async (proyectoData) => {
  try {
    // Verificar que el cliente existe
    const clienteExists = await Cliente.findById(proyectoData.idCliente);
    if (!clienteExists) {
      throw new Error('El cliente especificado no existe');
    }
    
    const newProyecto = new Proyecto(proyectoData);
    await newProyecto.save();
    
    return newProyecto;
  } catch (error) {
    throw new Error(`Error al crear el proyecto: ${error.message}`);
  }
};

// Actualizar un proyecto por su ID
const updateProyectoById = async (id, proyectoData) => {
  try {
    return await Proyecto.findByIdAndUpdate(
      id,
      proyectoData,
      { new: true, runValidators: true }
    );
  } catch (error) {
    throw new Error(`Error al actualizar el proyecto: ${error.message}`);
  }
};

// Eliminar un proyecto por su ID
const deleteProyectoById = async (id) => {
  try {
    return await Proyecto.findByIdAndDelete(id);
  } catch (error) {
    throw new Error(`Error al eliminar el proyecto: ${error.message}`);
  }
};

// Agregar una tarea a un proyecto
const addTaskToProyecto = async (id, taskData) => {
  try {
    return await Proyecto.findByIdAndUpdate(
      id,
      { $push: { tareas: taskData } },
      { new: true, runValidators: true }
    );
  } catch (error) {
    throw new Error(`Error al agregar tarea al proyecto: ${error.message}`);
  }
};

// Actualizar una tarea de un proyecto
const updateTaskInProyecto = async (id, taskId, taskData) => {
  try {
    // Convertir el ID de string a ObjectId
    const taskObjectId = new mongoose.Types.ObjectId(taskId);
    
    return await Proyecto.findOneAndUpdate(
      { _id: id, 'tareas._id': taskObjectId },
      { $set: { 'tareas.$': { _id: taskObjectId, ...taskData } } },
      { new: true, runValidators: true }
    );
  } catch (error) {
    throw new Error(`Error al actualizar tarea del proyecto: ${error.message}`);
  }
};

// Eliminar una tarea de un proyecto
const deleteTaskFromProyecto = async (id, taskId) => {
  try {
    return await Proyecto.findByIdAndUpdate(
      id,
      { $pull: { tareas: { _id: taskId } } },
      { new: true }
    );
  } catch (error) {
    throw new Error(`Error al eliminar tarea del proyecto: ${error.message}`);
  }
};

module.exports = {
  getAllProyectos,
  getProyectosByClienteId,
  getProyectoById,
  createProyecto,
  updateProyectoById,
  deleteProyectoById,
  addTaskToProyecto,
  updateTaskInProyecto,
  deleteTaskFromProyecto
};