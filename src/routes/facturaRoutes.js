const express = require('express');
const router = express.Router();
const facturaController = require('../controllers/facturaController');

// Obtener todas las facturas
router.get('/', facturaController.getAllFacturas);

// Obtener facturas vencidas
router.get('/vencidas', facturaController.getFacturasVencidas);

// Obtener facturas por estado
router.get('/estado/:estado', facturaController.getFacturasByEstado);

// Obtener facturas de un cliente específico
router.get('/cliente/:idCliente', facturaController.getFacturasByClienteId);

// Obtener facturas de un proyecto específico
router.get('/proyecto/:idProyecto', facturaController.getFacturasByProyectoId);

// Obtener una factura por su ID
router.get('/:id', facturaController.getFacturaById);

// Crear una nueva factura
router.post('/', facturaController.createFactura);

// Actualizar una factura por su ID
router.put('/:id', facturaController.updateFacturaById);

// Actualizar estado de una factura
router.patch('/:id/estado', facturaController.updateFacturaEstado);

// Eliminar una factura por su ID
router.delete('/:id', facturaController.deleteFacturaById);

module.exports = router;