const express = require('express');
const router = express.Router();
const proyectoController = require('../controllers/proyectoController');

// Obtener todos los proyectos
router.get('/', proyectoController.getAllProyectos);

// Obtener proyectos de un cliente específico
router.get('/cliente/:idCliente', proyectoController.getProyectosByClienteId);

// Obtener un proyecto por su ID
router.get('/:id', proyectoController.getProyectoById);

// Crear un nuevo proyecto
router.post('/', proyectoController.createProyecto);

// Actualizar un proyecto por su ID
router.put('/:id', proyectoController.updateProyectoById);

// Eliminar un proyecto por su ID
router.delete('/:id', proyectoController.deleteProyectoById);

// Agregar una tarea a un proyecto
router.post('/:id/tareas', proyectoController.addTaskToProyecto);

// Actualizar una tarea de un proyecto
router.put('/:id/tareas/:taskId', proyectoController.updateTaskInProyecto);

// Eliminar una tarea de un proyecto
router.delete('/:id/tareas/:taskId', proyectoController.deleteTaskFromProyecto);

module.exports = router;