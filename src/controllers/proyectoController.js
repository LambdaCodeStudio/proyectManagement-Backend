const proyectoLogic = require('../logic/proyectoLogic');

// Obtener todos los proyectos
const getAllProyectos = async (req, res) => {
  try {
    const proyectos = await proyectoLogic.getAllProyectos();
    return res.status(200).json(proyectos);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Obtener proyectos de un cliente específico
const getProyectosByClienteId = async (req, res) => {
  try {
    const { idCliente } = req.params;
    const proyectos = await proyectoLogic.getProyectosByClienteId(idCliente);
    return res.status(200).json(proyectos);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Obtener un proyecto por su ID
const getProyectoById = async (req, res) => {
  try {
    const { id } = req.params;
    const proyecto = await proyectoLogic.getProyectoById(id);
    
    if (!proyecto) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }
    
    return res.status(200).json(proyecto);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Crear un nuevo proyecto
const createProyecto = async (req, res) => {
  try {
    const proyectoData = req.body;
    
    const newProyecto = await proyectoLogic.createProyecto(proyectoData);
    return res.status(201).json(newProyecto);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Actualizar un proyecto por su ID
const updateProyectoById = async (req, res) => {
  try {
    const { id } = req.params;
    const proyectoData = req.body;
    
    const updatedProyecto = await proyectoLogic.updateProyectoById(id, proyectoData);
    
    if (!updatedProyecto) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }
    
    return res.status(200).json(updatedProyecto);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Eliminar un proyecto por su ID
const deleteProyectoById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedProyecto = await proyectoLogic.deleteProyectoById(id);
    
    if (!deletedProyecto) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }
    
    return res.status(200).json({ message: 'Proyecto eliminado correctamente' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Agregar una tarea a un proyecto
const addTaskToProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const taskData = req.body;
    
    const updatedProyecto = await proyectoLogic.addTaskToProyecto(id, taskData);
    
    if (!updatedProyecto) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }
    
    return res.status(200).json(updatedProyecto);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Actualizar una tarea de un proyecto
const updateTaskInProyecto = async (req, res) => {
  try {
    const { id, taskId } = req.params;
    const taskData = req.body;
    
    const updatedProyecto = await proyectoLogic.updateTaskInProyecto(id, taskId, taskData);
    
    if (!updatedProyecto) {
      return res.status(404).json({ message: 'Proyecto o tarea no encontrado' });
    }
    
    return res.status(200).json(updatedProyecto);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Eliminar una tarea de un proyecto
const deleteTaskFromProyecto = async (req, res) => {
  try {
    const { id, taskId } = req.params;
    
    const updatedProyecto = await proyectoLogic.deleteTaskFromProyecto(id, taskId);
    
    if (!updatedProyecto) {
      return res.status(404).json({ message: 'Proyecto o tarea no encontrado' });
    }
    
    return res.status(200).json(updatedProyecto);
  } catch (error) {
    return res.status(500).json({ message: error.message });
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